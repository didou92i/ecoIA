import { describe, expect, it } from "vitest";

import type { ExtensionStorageArea } from "../../src/browser/browser-api";
import type { NumericInteractionEvent, PlatformId } from "../../src/shared/contracts";
import { AggregateStore } from "../../src/storage/aggregate-store";
import { testUuid } from "../helpers/test-uuid";

const uuidBySeed = new Map<string, string>();

function uuidFor(kind: "event" | "session", seed: string): string {
  const key = `${kind}:${seed}`;
  const existing = uuidBySeed.get(key);
  if (existing) return existing;
  const uuid = testUuid(uuidBySeed.size + 1);
  uuidBySeed.set(key, uuid);
  return uuid;
}

function eventUuid(seed: string): string {
  return uuidFor("event", seed);
}

function sessionUuid(seed: string): string {
  return uuidFor("session", seed);
}

class MemoryStorageArea implements ExtensionStorageArea {
  readonly values: Record<string, unknown> = {};
  readonly setCalls: Array<Record<string, unknown>> = [];

  async get(keys: string | string[] | null = null): Promise<Record<string, unknown>> {
    await Promise.resolve();
    if (keys === null) return structuredClone(this.values);
    const requested = typeof keys === "string" ? [keys] : keys;
    return Object.fromEntries(
      requested.filter((key) => key in this.values).map((key) => [key, this.values[key]]),
    );
  }

  async set(values: Record<string, unknown>): Promise<void> {
    await Promise.resolve();
    this.setCalls.push(structuredClone(values));
    Object.assign(this.values, structuredClone(values));
  }

  async remove(keys: string | string[]): Promise<void> {
    const requested = typeof keys === "string" ? [keys] : keys;
    for (const key of requested) delete this.values[key];
  }
}

class FailOnceStorageArea extends MemoryStorageArea {
  private failNextWrite = true;

  override async set(values: Record<string, unknown>): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("SIMULATED_SESSION_WRITE_FAILURE");
    }
    await super.set(values);
  }
}

function event(
  eventId: string,
  tabSessionId: string,
  sequence: number,
  outputTokens: number,
  platform: PlatformId = "chatgpt",
  phase: NumericInteractionEvent["phase"] = "streaming",
): NumericInteractionEvent {
  return {
    version: 1,
    eventId: eventUuid(eventId),
    tabSessionId: sessionUuid(tabSessionId),
    sequence,
    platform,
    modelProfileId: platform === "chatgpt" ? "openai-gpt-4o-v1" : "generic-assistant-v1",
    phase,
    tokens: {
      input: { low: 90, central: 100, high: 110 },
      output: {
        low: outputTokens * 0.9,
        central: outputTokens,
        high: outputTokens * 1.1,
      },
      source: "estimated",
    },
    generatedAt: 1_721_318_400_000 + sequence,
  };
}

function createStore(localDate = "2026-07-18") {
  const local = new MemoryStorageArea();
  const session = new MemoryStorageArea();
  let date = localDate;
  const store = new AggregateStore({
    local,
    session,
    now: () => 1_721_318_400_000,
    localDate: () => date,
  });
  return { local, session, store, setDate: (nextDate: string) => (date = nextDate) };
}

describe("aggregate store", () => {
  it("stores the first event as numeric day and session totals", async () => {
    const { store } = createStore();
    await expect(store.processEvent(event("event-1", "tab-1", 1, 100))).resolves.toEqual({
      status: "accepted",
    });

    const day = await store.getDayAggregate();
    const session = await store.getSessionAggregate(sessionUuid("tab-1"));
    expect(day.interactionCount).toBe(1);
    expect(day.platformCounts.chatgpt).toBe(1);
    expect(day.tokens.output.central).toBe(100);
    expect(session).toMatchObject({ interactionCount: 1, tokens: { output: { central: 100 } } });
  });

  it("replaces streaming contribution instead of double-counting it", async () => {
    const { store } = createStore();
    await store.processEvent(event("event-1", "tab-1", 1, 100));
    await store.processEvent(event("event-1", "tab-1", 2, 240, "chatgpt", "completed"));

    const day = await store.getDayAggregate();
    expect(day.interactionCount).toBe(1);
    expect(day.tokens.input.central).toBe(100);
    expect(day.tokens.output.central).toBe(240);
  });

  it("replaces one interaction when a manual model recalculation changes its profile", async () => {
    const { store } = createStore();
    const automatic = event("event-1", "tab-1", 1, 100);
    const manual = {
      ...event("event-1", "tab-1", 2, 100, "chatgpt", "streaming"),
      modelProfileId: "openai-gpt-4-1-v1",
    };
    await store.processEvent(automatic);
    await store.processEvent(manual);

    const day = await store.getDayAggregate();
    expect(day.interactionCount).toBe(1);
    expect(day.tokens.output.central).toBe(100);
  });

  it("ignores duplicates and out-of-order events", async () => {
    const { store } = createStore();
    await store.processEvent(event("event-1", "tab-1", 2, 200));
    await expect(store.processEvent(event("event-1", "tab-1", 2, 500))).resolves.toEqual({
      status: "ignored",
      reason: "DUPLICATE_OR_OUT_OF_ORDER",
    });
    await expect(store.processEvent(event("event-1", "tab-1", 1, 500))).resolves.toEqual({
      status: "ignored",
      reason: "DUPLICATE_OR_OUT_OF_ORDER",
    });
    expect((await store.getDayAggregate()).tokens.output.central).toBe(200);
  });

  it("serializes concurrent events from multiple tabs", async () => {
    const { store } = createStore();
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.processEvent(
          event(
            `event-${index}`,
            `tab-${index % 2}`,
            1,
            10,
            index % 2 === 0 ? "chatgpt" : "claude",
            "completed",
          ),
        ),
      ),
    );
    const day = await store.getDayAggregate();
    expect(day.interactionCount).toBe(20);
    expect(day.platformCounts.chatgpt).toBe(10);
    expect(day.platformCounts.claude).toBe(10);
    expect(day.tokens.output.central).toBe(200);
  });

  it("replaces the previous day instead of retaining history", async () => {
    const { local, setDate, store } = createStore();
    await store.processEvent(event("event-1", "tab-1", 1, 100, "chatgpt", "completed"));
    setDate("2026-07-19");
    await store.processEvent(event("event-2", "tab-1", 1, 50, "chatgpt", "completed"));

    const day = await store.getDayAggregate();
    expect(day.localDate).toBe("2026-07-19");
    expect(day.interactionCount).toBe(1);
    expect(day.tokens.output.central).toBe(50);
    expect(JSON.stringify(local.values)).not.toContain("2026-07-18");
  });

  it("resets a tab session without changing the day", async () => {
    const { store } = createStore();
    await store.processEvent(event("event-1", "tab-1", 1, 100, "chatgpt", "completed"));
    await store.resetSession(sessionUuid("tab-1"));
    expect(await store.getSessionAggregate(sessionUuid("tab-1"))).toBeNull();
    expect((await store.getDayAggregate()).interactionCount).toBe(1);
  });

  it("persists only allowlisted numeric aggregate structures", async () => {
    const { local, session, store } = createStore();
    await store.processEvent(event("event-1", "tab-1", 1, 100, "chatgpt", "completed"));

    expect(Object.keys(local.values).sort()).toEqual(["ecoia.day.v1", "ecoia.dedupe.v1"]);
    expect(Object.keys(session.values).sort()).toEqual([
      `ecoia.events.${sessionUuid("tab-1")}.v1`,
      `ecoia.session.${sessionUuid("tab-1")}.v1`,
      "ecoia.sessions.v1",
    ]);
    const serialized = JSON.stringify({ local: local.values, session: session.values });
    expect(serialized).not.toMatch(/prompt|response|conversationId|https?:\/\//i);
    expect(serialized).not.toContain("estimated");
  });

  it("recovers a local-success session-failure in a recreated MV3 store exactly once", async () => {
    const local = new MemoryStorageArea();
    const session = new FailOnceStorageArea();
    const store1 = new AggregateStore({
      local,
      session,
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    const numericEvent = event("event-retry", "tab-retry", 1, 100, "chatgpt", "completed");

    await expect(store1.processEvent(numericEvent)).rejects.toThrow(
      "SIMULATED_SESSION_WRITE_FAILURE",
    );
    expect(local.values).toHaveProperty("ecoia.journal.v1");
    expect(JSON.stringify(local.values)).not.toMatch(/prompt|response|conversation|https?:\/\//iu);

    const store2 = new AggregateStore({
      local,
      session,
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    await expect(store2.processEvent(numericEvent)).resolves.toEqual({
      status: "ignored",
      reason: "DUPLICATE_OR_OUT_OF_ORDER",
    });
    expect(await store2.getSessionAggregate(sessionUuid("tab-retry"))).toMatchObject({
      interactionCount: 1,
    });
    expect(await store2.getDayAggregate()).toMatchObject({ interactionCount: 1 });
    expect(local.values).not.toHaveProperty("ecoia.journal.v1");
  });

  it("recovers a bounded journal after more than 24 hours without duplicating or redating its day", async () => {
    const local = new MemoryStorageArea();
    const session = new FailOnceStorageArea();
    let timestamp = 1_721_318_400_000;
    let localDate = "2026-07-18";
    const store1 = new AggregateStore({
      local,
      session,
      now: () => timestamp,
      localDate: () => localDate,
    });
    const numericEvent = event("event-durable", "tab-durable", 1, 100, "chatgpt", "completed");
    await expect(store1.processEvent(numericEvent)).rejects.toThrow(
      "SIMULATED_SESSION_WRITE_FAILURE",
    );
    const originalDay = structuredClone(local.values["ecoia.day.v1"]);

    timestamp += 48 * 60 * 60 * 1_000 + 1;
    localDate = "2026-07-20";
    const store2 = new AggregateStore({
      local,
      session,
      now: () => timestamp,
      localDate: () => localDate,
    });
    await expect(store2.processEvent(numericEvent)).resolves.toEqual({
      status: "ignored",
      reason: "DUPLICATE_OR_OUT_OF_ORDER",
    });

    expect(local.values).not.toHaveProperty("ecoia.journal.v1");
    expect(local.values["ecoia.day.v1"]).toEqual(originalDay);
    expect(await store2.getSessionAggregate(sessionUuid("tab-durable"))).toMatchObject({
      interactionCount: 1,
    });
    expect(await store2.getDayAggregate()).toMatchObject({
      localDate: "2026-07-20",
      interactionCount: 0,
    });
  });

  it("recovers a structurally valid journal even after the local clock moves backwards", async () => {
    const local = new MemoryStorageArea();
    const session = new FailOnceStorageArea();
    const timestamp = 1_721_318_400_000;
    const numericEvent = event("event-future-journal", "tab-future-journal", 1, 100);
    const store1 = new AggregateStore({
      local,
      session,
      now: () => timestamp,
      localDate: () => "2026-07-18",
    });
    await expect(store1.processEvent(numericEvent)).rejects.toThrow(
      "SIMULATED_SESSION_WRITE_FAILURE",
    );
    const journal = local.values["ecoia.journal.v1"] as { createdAt: number };
    journal.createdAt = timestamp + 365 * 24 * 60 * 60 * 1_000;

    const store2 = new AggregateStore({
      local,
      session,
      now: () => timestamp,
      localDate: () => "2026-07-18",
    });
    await expect(store2.processEvent(numericEvent)).resolves.toMatchObject({ status: "ignored" });
    expect(await store2.getSessionAggregate(sessionUuid("tab-future-journal"))).toMatchObject({
      interactionCount: 1,
    });
  });

  it.each(["private-local-date", "private-metadata"])(
    "discards an otherwise valid recovery journal containing %s",
    async (variant) => {
      const local = new MemoryStorageArea();
      const session = new FailOnceStorageArea();
      const store1 = new AggregateStore({
        local,
        session,
        now: () => 1_721_318_400_000,
        localDate: () => "2026-07-18",
      });
      const numericEvent = event("event-private", "tab-private", 1, 100, "chatgpt", "completed");
      await expect(store1.processEvent(numericEvent)).rejects.toThrow(
        "SIMULATED_SESSION_WRITE_FAILURE",
      );
      const journal = local.values["ecoia.journal.v1"] as {
        eventState: { events: Array<Record<string, unknown>> };
        metadata?: unknown;
      };
      const privateValue = `https://private.example/${"secret".repeat(100)}`;
      if (variant === "private-local-date") {
        const firstEvent = journal.eventState.events[0];
        if (!firstEvent) throw new Error("MISSING_RECOVERY_EVENT_FIXTURE");
        firstEvent.localDate = privateValue;
      } else {
        journal.metadata = privateValue;
      }

      const store2 = new AggregateStore({
        local,
        session,
        now: () => 1_721_318_400_000,
        localDate: () => "2026-07-18",
      });
      await store2.processEvent(numericEvent);

      expect(local.values).not.toHaveProperty("ecoia.journal.v1");
      expect(JSON.stringify({ local: local.values, session: session.values })).not.toContain(
        privateValue,
      );
      expect((await store2.getDayAggregate()).interactionCount).toBe(1);
    },
  );

  it("strictly discards a text-bearing or malformed recovery journal", async () => {
    const { local, session, store } = createStore();
    local.values["ecoia.journal.v1"] = {
      version: 1,
      tabSessionId: sessionUuid("tab-1"),
      sessionAggregate: { prompt: "private prompt" },
      eventState: { url: "https://private.example/conversation" },
    };

    await store.processEvent(event("event-1", "tab-1", 1, 100));

    expect(local.values).not.toHaveProperty("ecoia.journal.v1");
    expect(JSON.stringify({ local: local.values, session: session.values })).not.toMatch(
      /private prompt|private\.example|https?:\/\//iu,
    );
  });

  it("deletes an exact-shaped journal carrying a private marker as an opaque ID", async () => {
    const local = new MemoryStorageArea();
    const session = new FailOnceStorageArea();
    const numericEvent = event("event-private-id", "tab-private-id", 1, 100);
    const store1 = new AggregateStore({
      local,
      session,
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    await expect(store1.processEvent(numericEvent)).rejects.toThrow(
      "SIMULATED_SESSION_WRITE_FAILURE",
    );
    const journal = local.values["ecoia.journal.v1"] as {
      tabSessionId: string;
      eventState: { events: Array<{ eventId: string }> };
    };
    journal.tabSessionId = "conversation-private-marker";
    const firstEvent = journal.eventState.events[0];
    if (!firstEvent) throw new Error("MISSING_RECOVERY_EVENT_FIXTURE");
    firstEvent.eventId = "conversation-private-marker";

    const store2 = new AggregateStore({
      local,
      session,
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    await store2.processEvent(numericEvent);

    expect(local.values).not.toHaveProperty("ecoia.journal.v1");
    expect(JSON.stringify({ local: local.values, session: session.values })).not.toContain(
      "conversation-private-marker",
    );
  });

  it("bounds deduplication and event metadata to 256 entries", async () => {
    const { local, session, store } = createStore();
    for (let index = 0; index < 270; index += 1) {
      await store.processEvent(event(`event-${index}`, "tab-1", 1, 1, "chatgpt", "completed"));
    }
    const deduplication = local.values["ecoia.dedupe.v1"] as { entries: unknown[] };
    const events = session.values[`ecoia.events.${sessionUuid("tab-1")}.v1`] as {
      events: unknown[];
    };
    expect(deduplication.entries).toHaveLength(256);
    expect(events.events).toHaveLength(256);
  });

  it("rejects sequence zero defensively before any persistence", async () => {
    const { local, session, store } = createStore();
    await expect(
      store.processEvent({ ...event("event-zero", "tab-zero", 1, 10), sequence: 0 }),
    ).rejects.toThrow("INVALID_EVENT_SEQUENCE");
    expect(local.values).toEqual({});
    expect(session.values).toEqual({});
  });

  it.each([
    { eventId: "conversation-private-marker" },
    { tabSessionId: "conversation-private-marker" },
  ])("rejects non-UUID event identities before persistence", async (change) => {
    const { local, session, store } = createStore();
    await expect(
      store.processEvent({ ...event("event-valid", "tab-valid", 1, 10), ...change }),
    ).rejects.toThrow(/INVALID_(?:EVENT|SESSION)_ID/u);
    expect(local.values).toEqual({});
    expect(session.values).toEqual({});
  });

  it("rejects a non-UUID session in direct read and reset methods", async () => {
    const { local, session, store } = createStore();
    await expect(store.getSessionAggregate("conversation-private-marker")).rejects.toThrow(
      "INVALID_SESSION_ID",
    );
    await expect(store.resetSession("conversation-private-marker")).rejects.toThrow(
      "INVALID_SESSION_ID",
    );
    expect(local.values).toEqual({});
    expect(session.values).toEqual({});
  });

  it.each(["2026-02-30", "https://private.example/secret", "2026-7-1"])(
    "rejects invalid current local date %s without persistence",
    async (localDate) => {
      const { local, session, store } = createStore(localDate);
      await expect(store.processEvent(event("event-date", "tab-date", 1, 10))).rejects.toThrow(
        "INVALID_LOCAL_DATE",
      );
      expect(local.values).toEqual({});
      expect(session.values).toEqual({});
    },
  );

  it("bounds active storage.session keys and purges evicted session pairs", async () => {
    const local = new MemoryStorageArea();
    const session = new MemoryStorageArea();
    let timestamp = 1_721_318_400_000;
    const store = new AggregateStore({
      local,
      session,
      now: () => timestamp++,
      localDate: () => "2026-07-18",
    });
    for (let index = 0; index < 40; index += 1) {
      await store.processEvent(event(`event-session-${index}`, `tab-${index}`, 1, 1));
    }

    const registry = session.values["ecoia.sessions.v1"] as { entries: unknown[] };
    expect(registry.entries).toHaveLength(32);
    expect(Object.keys(session.values)).toHaveLength(65);
    expect(session.values).not.toHaveProperty(`ecoia.session.${sessionUuid("tab-0")}.v1`);
    expect(session.values).not.toHaveProperty(`ecoia.events.${sessionUuid("tab-0")}.v1`);
  });

  it("purges expired active sessions on the next processing operation", async () => {
    const local = new MemoryStorageArea();
    const session = new MemoryStorageArea();
    let timestamp = 1_721_318_400_000;
    const store = new AggregateStore({
      local,
      session,
      now: () => timestamp,
      localDate: () => "2026-07-18",
    });
    await store.processEvent(event("event-old", "tab-old", 1, 10));
    timestamp += 24 * 60 * 60 * 1_000 + 1;
    await store.processEvent(event("event-new", "tab-new", 1, 10));

    expect(session.values).not.toHaveProperty(`ecoia.session.${sessionUuid("tab-old")}.v1`);
    expect(session.values).not.toHaveProperty(`ecoia.events.${sessionUuid("tab-old")}.v1`);
    expect(session.values["ecoia.sessions.v1"]).toEqual({
      version: 1,
      entries: [{ tabSessionId: sessionUuid("tab-new"), lastSeen: timestamp }],
    });
  });

  it("physically prunes expired deduplication entries during a session reset", async () => {
    const local = new MemoryStorageArea();
    const session = new MemoryStorageArea();
    let timestamp = 1_721_318_400_000;
    const store = new AggregateStore({
      local,
      session,
      now: () => timestamp,
      localDate: () => "2026-07-18",
    });
    await store.processEvent(event("event-expired-dedupe", "tab-old-dedupe", 1, 10));
    timestamp += 31 * 60 * 1_000;

    await store.resetSession(sessionUuid("tab-unrelated-reset"));

    expect(local.values["ecoia.dedupe.v1"]).toEqual({ version: 1, entries: [] });
  });

  it("prunes deduplication entries that are in the future after a clock rollback", async () => {
    const local = new MemoryStorageArea();
    const session = new MemoryStorageArea();
    let timestamp = 1_721_318_400_000;
    const store = new AggregateStore({
      local,
      session,
      now: () => timestamp,
      localDate: () => "2026-07-18",
    });
    await store.processEvent(event("event-before-rollback", "tab-before-rollback", 1, 10));

    timestamp -= 60 * 60 * 1_000;
    await store.processEvent(event("event-after-rollback", "tab-after-rollback", 1, 10));

    const deduplication = local.values["ecoia.dedupe.v1"] as {
      entries: Array<{ eventId: string }>;
    };
    expect(deduplication.entries.map(({ eventId }) => eventId)).toEqual([
      eventUuid("event-after-rollback"),
    ]);
  });

  it("uses bounded in-memory session storage when storage.session is unavailable", async () => {
    const local = new MemoryStorageArea();
    const store = new AggregateStore({
      local,
      session: null,
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    await store.processEvent(event("event-1", "tab-1", 1, 100));
    expect((await store.getSessionAggregate(sessionUuid("tab-1")))?.interactionCount).toBe(1);
  });
});
