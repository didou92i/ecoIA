import { describe, expect, it } from "vitest";

import type { ExtensionStorageArea } from "../../src/browser/browser-api";
import type { NumericInteractionEvent, PlatformId } from "../../src/shared/contracts";
import { AggregateStore } from "../../src/storage/aggregate-store";

class MemoryStorageArea implements ExtensionStorageArea {
  readonly values: Record<string, unknown> = {};

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
    Object.assign(this.values, structuredClone(values));
  }

  async remove(keys: string | string[]): Promise<void> {
    const requested = typeof keys === "string" ? [keys] : keys;
    for (const key of requested) delete this.values[key];
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
    eventId,
    tabSessionId,
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
    const session = await store.getSessionAggregate("tab-1");
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
    await store.resetSession("tab-1");
    expect(await store.getSessionAggregate("tab-1")).toBeNull();
    expect((await store.getDayAggregate()).interactionCount).toBe(1);
  });

  it("persists only allowlisted numeric aggregate structures", async () => {
    const { local, session, store } = createStore();
    await store.processEvent(event("event-1", "tab-1", 1, 100, "chatgpt", "completed"));

    expect(Object.keys(local.values).sort()).toEqual(["ecoia.day.v1", "ecoia.dedupe.v1"]);
    expect(Object.keys(session.values).sort()).toEqual([
      "ecoia.events.tab-1.v1",
      "ecoia.session.tab-1.v1",
    ]);
    const serialized = JSON.stringify({ local: local.values, session: session.values });
    expect(serialized).not.toMatch(/prompt|response|conversationId|https?:\/\//i);
    expect(serialized).not.toContain("estimated");
  });

  it("bounds deduplication and event metadata to 256 entries", async () => {
    const { local, session, store } = createStore();
    for (let index = 0; index < 270; index += 1) {
      await store.processEvent(event(`event-${index}`, "tab-1", 1, 1, "chatgpt", "completed"));
    }
    const deduplication = local.values["ecoia.dedupe.v1"] as { entries: unknown[] };
    const events = session.values["ecoia.events.tab-1.v1"] as { events: unknown[] };
    expect(deduplication.entries).toHaveLength(256);
    expect(events.events).toHaveLength(256);
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
    expect((await store.getSessionAggregate("tab-1"))?.interactionCount).toBe(1);
  });
});
