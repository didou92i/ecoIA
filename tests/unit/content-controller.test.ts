// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformAdapter, VisibleTurnSnapshot } from "../../src/adapters/adapter-contract";
import type { BrowserApi, ExtensionStorageArea } from "../../src/browser/browser-api";
import { ContentController, type ContentWidget } from "../../src/content/content-controller";
import type { WidgetViewModel } from "../../src/widget/eco-widget";

class MemoryStorageArea implements ExtensionStorageArea {
  private readonly values: Record<string, unknown> = {};
  async get(): Promise<Record<string, unknown>> {
    return structuredClone(this.values);
  }
  async set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, structuredClone(values));
  }
  async remove(keys: string | string[]): Promise<void> {
    for (const key of typeof keys === "string" ? [keys] : keys) delete this.values[key];
  }
}

class FakeAdapter implements PlatformAdapter {
  readonly platform = "chatgpt" as const;
  root = document.createElement("main");
  readonly turnElement = document.createElement("article");
  marker = "conversation-a";
  snapshot: VisibleTurnSnapshot | null = {
    turnElement: this.turnElement,
    promptText: "Texte privé du prompt",
    responseText: "Texte privé de la réponse",
    phase: "streaming",
  };
  model = "GPT-4o";
  subscribedListener: (() => void) | null = null;
  cleanup = vi.fn();
  rootAvailable = true;

  detectModel() {
    return { label: this.model };
  }
  findConversationRoot() {
    return this.rootAvailable ? this.root : null;
  }
  readLatestTurn() {
    return this.snapshot;
  }
  getConversationMarker() {
    return this.marker;
  }
  subscribe(_root: HTMLElement, listener: () => void) {
    this.subscribedListener = listener;
    return this.cleanup;
  }
}

function requireSnapshot(adapter: FakeAdapter): VisibleTurnSnapshot {
  if (!adapter.snapshot) throw new Error("MISSING_TURN_SNAPSHOT");
  return adapter.snapshot;
}

function createHarness(adapter = new FakeAdapter()) {
  const messages: unknown[] = [];
  const api: BrowserApi = {
    runtime: {
      async sendMessage(message) {
        messages.push(structuredClone(message));
        if ((message as { kind?: string }).kind === "reset-session") {
          return { ok: true, status: "reset" };
        }
        return { ok: true, status: "accepted", session: null, day: null };
      },
      onMessage: () => () => undefined,
    },
    storage: { local: new MemoryStorageArea(), session: new MemoryStorageArea() },
  };
  const updates: WidgetViewModel[] = [];
  const widget = Object.assign(document.createElement("div"), {
    configure: vi.fn(),
    update: (viewModel: WidgetViewModel) => updates.push(structuredClone(viewModel)),
  }) as ContentWidget;
  let uuidIndex = 0;
  const controller = new ContentController({
    document,
    adapter,
    api,
    createWidget: () => widget,
    randomUUID: () => `uuid-${++uuidIndex}`,
    now: () => 1_721_318_400_000 + uuidIndex,
  });
  return { adapter, api, controller, messages, updates, widget };
}

describe("content controller", () => {
  beforeEach(() => document.body.replaceChildren());

  it("converts page text to numeric metrics before messaging", async () => {
    const { controller, messages, updates, widget } = createHarness();
    await controller.start();

    expect(document.documentElement.contains(widget)).toBe(true);
    expect(messages).toHaveLength(1);
    const serializedMessage = JSON.stringify(messages[0]);
    expect(serializedMessage).not.toContain("Texte privé");
    expect(serializedMessage).not.toMatch(/promptText|responseText|conversation/i);
    expect(messages[0]).toMatchObject({
      version: 1,
      platform: "chatgpt",
      modelProfileId: "openai-gpt-4o-v1",
      phase: "streaming",
      tokens: { source: "estimated" },
    });
    expect(updates.at(-1)?.state).toBe("streaming");
  });

  it("reuses the event ID and increments only the numeric sequence during streaming", async () => {
    const { adapter, controller, messages } = createHarness();
    await controller.start();
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Une réponse visible plus longue, toujours privée.",
      phase: "completed",
    };
    await controller.refresh();

    const first = messages[0] as { eventId: string; sequence: number };
    const second = messages[1] as { eventId: string; sequence: number; phase: string };
    expect(second.eventId).toBe(first.eventId);
    expect(second.sequence).toBe(first.sequence + 1);
    expect(second.phase).toBe("completed");
  });

  it("resets the ephemeral session on SPA conversation change", async () => {
    const { adapter, controller, messages } = createHarness();
    await controller.start();
    const firstSession = (messages[0] as { tabSessionId: string }).tabSessionId;
    adapter.marker = "conversation-b";
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      turnElement: document.createElement("article"),
      phase: "completed",
    };
    await controller.refresh();

    expect(messages[1]).toEqual({ version: 1, kind: "reset-session", tabSessionId: firstSession });
    expect((messages[2] as { tabSessionId: string }).tabSessionId).not.toBe(firstSession);
    expect(JSON.stringify(messages)).not.toContain("conversation-a");
    expect(JSON.stringify(messages)).not.toContain("conversation-b");
  });

  it("fails closed when the conversation root is missing", async () => {
    const adapter = new FakeAdapter();
    adapter.rootAvailable = false;
    const { controller, messages, updates } = createHarness(adapter);
    await controller.start();
    expect(messages).toHaveLength(0);
    expect(updates.at(-1)?.state).toBe("measurement-paused");
  });

  it("cleans up observers and the injected widget", async () => {
    const { adapter, controller, widget } = createHarness();
    await controller.start();
    controller.stop();
    expect(adapter.cleanup).toHaveBeenCalledOnce();
    expect(document.documentElement.contains(widget)).toBe(false);
  });

  it("moves the scoped observer when a SPA replaces the conversation root", async () => {
    const { adapter, controller } = createHarness();
    await controller.start();
    adapter.root = document.createElement("main");
    await controller.refresh();
    expect(adapter.cleanup).toHaveBeenCalledOnce();
  });
});
