import { describe, expect, it, vi } from "vitest";

import type {
  BrowserApi,
  ExtensionMessageListener,
  ExtensionStorageArea,
} from "../../src/browser/browser-api";
import { registerServiceWorker } from "../../src/background/service-worker";
import { testUuid } from "../helpers/test-uuid";

const eventId = testUuid(1);
const sessionId = testUuid(10_001);

class MemoryStorageArea implements ExtensionStorageArea {
  readonly values: Record<string, unknown> = {};

  async get(keys: string | string[] | null = null): Promise<Record<string, unknown>> {
    if (keys === null) return structuredClone(this.values);
    const requested = typeof keys === "string" ? [keys] : keys;
    return Object.fromEntries(
      requested.filter((key) => key in this.values).map((key) => [key, this.values[key]]),
    );
  }

  async set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, structuredClone(values));
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of typeof keys === "string" ? [keys] : keys) delete this.values[key];
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

function createApi(session: ExtensionStorageArea = new MemoryStorageArea()) {
  let listener: ExtensionMessageListener | null = null;
  const api: BrowserApi = {
    runtime: {
      sendMessage: vi.fn(async () => undefined),
      onMessage(nextListener) {
        listener = nextListener;
        return () => (listener = null);
      },
    },
    storage: { local: new MemoryStorageArea(), session },
  };
  return { api, getListener: () => listener };
}

async function invoke(listener: ExtensionMessageListener, message: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const keepChannelOpen = listener(message, {}, resolve);
    expect(keepChannelOpen).toBe(true);
  });
}

function numericEvent() {
  return {
    version: 1,
    eventId,
    tabSessionId: sessionId,
    sequence: 1,
    platform: "chatgpt",
    modelProfileId: "openai-gpt-4o-v1",
    phase: "completed",
    tokens: {
      input: { low: 9, central: 10, high: 11 },
      output: { low: 18, central: 20, high: 22 },
      source: "estimated",
    },
    generatedAt: 1_721_318_400_000,
  };
}

describe("service worker message boundary", () => {
  it("accepts a valid numeric interaction event", async () => {
    const { api, getListener } = createApi();
    const cleanup = registerServiceWorker(api, {
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    const listener = getListener();
    if (!listener) throw new Error("MISSING_MESSAGE_LISTENER");
    const response = await invoke(listener, numericEvent());
    expect(response).toMatchObject({
      ok: true,
      status: "accepted",
      session: { interactionCount: 1 },
      day: { interactionCount: 1, localDate: "2026-07-18" },
    });
    cleanup();
  });

  it("returns a stable failure then recovers the same event exactly once", async () => {
    const { api, getListener } = createApi(new FailOnceStorageArea());
    registerServiceWorker(api, {
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    const listener = getListener();
    if (!listener) throw new Error("MISSING_MESSAGE_LISTENER");

    await expect(invoke(listener, numericEvent())).resolves.toEqual({
      ok: false,
      error: "PROCESSING_FAILED",
    });
    await expect(invoke(listener, numericEvent())).resolves.toMatchObject({
      ok: true,
      status: "ignored",
      session: { interactionCount: 1 },
      day: { interactionCount: 1 },
    });
  });

  it("resets only a validated ephemeral session", async () => {
    const { api, getListener } = createApi();
    registerServiceWorker(api, {
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    const listener = getListener();
    if (!listener) throw new Error("MISSING_MESSAGE_LISTENER");
    await expect(
      invoke(listener, { version: 1, kind: "reset-session", tabSessionId: sessionId }),
    ).resolves.toEqual({ ok: true, status: "reset" });
  });

  it("rejects text-bearing and malformed messages with a stable error", async () => {
    const { api, getListener } = createApi();
    registerServiceWorker(api, {
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    const listener = getListener();
    if (!listener) throw new Error("MISSING_MESSAGE_LISTENER");
    const response = await invoke(listener, {
      version: 1,
      prompt: "private prompt content",
    });
    expect(response).toEqual({ ok: false, error: "INVALID_MESSAGE" });
    expect(JSON.stringify(response)).not.toContain("private prompt content");
  });

  it("rejects sequence zero without mutating local or session storage", async () => {
    const { api, getListener } = createApi();
    registerServiceWorker(api, {
      now: () => 1_721_318_400_000,
      localDate: () => "2026-07-18",
    });
    const listener = getListener();
    if (!listener) throw new Error("MISSING_MESSAGE_LISTENER");

    await expect(invoke(listener, { ...numericEvent(), sequence: 0 })).resolves.toEqual({
      ok: false,
      error: "INVALID_MESSAGE",
    });
    await expect(api.storage.local.get(null)).resolves.toEqual({});
    await expect(api.storage.session?.get(null)).resolves.toEqual({});
  });

  it("rejects diagnostic metadata at the numeric service-worker boundary", async () => {
    const { api, getListener } = createApi();
    registerServiceWorker(api);
    const listener = getListener();
    if (!listener) throw new Error("MISSING_MESSAGE_LISTENER");
    const response = await invoke(listener, {
      version: 1,
      eventId,
      tabSessionId: sessionId,
      sequence: 1,
      platform: "chatgpt",
      modelProfileId: "openai-gpt-4o-v1",
      phase: "completed",
      tokens: {
        input: { low: 9, central: 10, high: 11 },
        output: { low: 18, central: 20, high: 22 },
        source: "estimated",
      },
      generatedAt: 1_721_318_400_000,
      diagnostic: { pageUrl: "https://private.example" },
    });
    expect(response).toEqual({ ok: false, error: "INVALID_MESSAGE" });
    expect(JSON.stringify(response)).not.toContain("private.example");
  });
});
