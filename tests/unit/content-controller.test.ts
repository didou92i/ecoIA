// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PlatformAdapter,
  VisibleContextSnapshot,
  VisibleTurnSnapshot,
} from "../../src/adapters/adapter-contract";
import type { BrowserApi, ExtensionStorageArea } from "../../src/browser/browser-api";
import { ContentController, type ContentWidget } from "../../src/content/content-controller";
import { estimateImpact } from "../../src/impact/impact-engine";
import { estimateVisibleTokens } from "../../src/token/token-estimator";
import type { WidgetViewModel } from "../../src/widget/eco-widget";

class MemoryStorageArea implements ExtensionStorageArea {
  readonly values: Record<string, unknown> = {};
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
  modelObserved = true;
  contextSnapshot: VisibleContextSnapshot = { text: "", coverage: "complete" };
  contextReadCount = 0;
  lastTurnSnapshot: VisibleTurnSnapshot | null = null;
  subscribedListener: (() => void) | null = null;
  cleanup = vi.fn();
  rootAvailable = true;

  detectModel() {
    return { label: this.model, observed: this.modelObserved };
  }
  findConversationRoot() {
    return this.rootAvailable ? this.root : null;
  }
  readLatestTurn() {
    this.lastTurnSnapshot = this.snapshot ? { ...this.snapshot } : null;
    return this.lastTurnSnapshot;
  }
  readVisibleContext() {
    this.contextReadCount += 1;
    return this.contextSnapshot;
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
  let runtimeListener: Parameters<BrowserApi["runtime"]["onMessage"]>[0] | null = null;
  const local = new MemoryStorageArea();
  const session = new MemoryStorageArea();
  const api: BrowserApi = {
    runtime: {
      async sendMessage(message) {
        messages.push(structuredClone(message));
        if ((message as { kind?: string }).kind === "reset-session") {
          return { ok: true, status: "reset" };
        }
        return { ok: true, status: "accepted", session: null, day: null };
      },
      onMessage: (listener) => {
        runtimeListener = listener;
        return () => (runtimeListener = null);
      },
    },
    storage: { local, session },
  };
  const updates: WidgetViewModel[] = [];
  const widget = Object.assign(document.createElement("div"), {
    configure: vi.fn(),
    update: (viewModel: WidgetViewModel) => updates.push(structuredClone(viewModel)),
    toggleCollapsed: vi.fn(),
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
  return {
    adapter,
    api,
    controller,
    messages,
    updates,
    widget,
    local,
    session,
    getRuntimeListener: () => runtimeListener,
  };
}

function modelSelectionCallback(widget: ContentWidget): (profileId: string | null) => void {
  const configure = widget.configure as ReturnType<typeof vi.fn>;
  const configuration = configure.mock.calls[0]?.[0] as
    | { onModelSelectionChange?: (profileId: string | null) => void }
    | undefined;
  if (!configuration?.onModelSelectionChange) throw new Error("MISSING_MODEL_SELECTION_CALLBACK");
  return configuration.onModelSelectionChange;
}

function numericMessages(messages: unknown[]): Array<Record<string, unknown>> {
  return messages.filter(
    (message): message is Record<string, unknown> =>
      typeof message === "object" && message !== null && "eventId" in message,
  );
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

  it("resolves an observed model automatically and warns only for an unobserved generic model", async () => {
    const observed = createHarness();
    await observed.controller.start();
    expect(observed.updates.at(-1)?.modelControl).toMatchObject({
      resolution: "automatic",
      selectedProfileId: null,
      warning: null,
      effectiveLabel: "OpenAI GPT-4o",
    });

    const unobservedAdapter = new FakeAdapter();
    unobservedAdapter.model = "Modèle non communiqué";
    unobservedAdapter.modelObserved = false;
    const unobserved = createHarness(unobservedAdapter);
    await unobserved.controller.start();
    expect(numericMessages(unobserved.messages)[0]).toMatchObject({
      modelProfileId: "openai-generic-v1",
    });
    expect(unobserved.updates.at(-1)?.modelControl).toMatchObject({
      resolution: "generic",
      warning: "Modèle non communiqué — profil générique utilisé",
    });
    expect(unobserved.updates.at(-1)?.diagnostic.model).toBe("generic");
  });

  it("recalculates the same interaction when a compatible manual profile is selected", async () => {
    const { controller, messages, updates, widget } = createHarness();
    await controller.start();
    modelSelectionCallback(widget)("openai-gpt-4-1-v1");
    await controller.refresh();

    const [first, second] = numericMessages(messages) as Array<{
      eventId: string;
      sequence: number;
      modelProfileId: string;
    }>;
    expect(second?.eventId).toBe(first?.eventId);
    expect(second?.sequence).toBe((first?.sequence ?? 0) + 1);
    expect(second?.modelProfileId).toBe("openai-gpt-4-1-v1");
    expect(updates.at(-1)?.modelControl).toMatchObject({
      resolution: "manual",
      selectedProfileId: "openai-gpt-4-1-v1",
      warning: null,
    });
    expect(updates.at(-1)?.diagnostic.model).toBe("manual");
  });

  it("rejects unknown and incompatible profiles without changing or sending the measurement", async () => {
    const { controller, messages, updates, widget } = createHarness();
    await controller.start();
    const select = modelSelectionCallback(widget);
    select("openai-gpt-4-1-v1");
    await controller.refresh();
    const validMeasurement = structuredClone(updates.at(-1)?.current);
    const sentAfterValidSelection = numericMessages(messages).length;

    for (const rejectedId of ["anthropic-claude-3-5-v1", "unknown-private-profile"]) {
      select(rejectedId);
      await controller.refresh();
      expect(numericMessages(messages)).toHaveLength(sentAfterValidSelection);
      expect(updates.at(-1)?.current).toEqual(validMeasurement);
      expect(updates.at(-1)?.modelControl).toMatchObject({
        selectedProfileId: "openai-gpt-4-1-v1",
        selectionError: "Ce modèle n’est pas disponible pour cette plateforme.",
      });
      expect(JSON.stringify(updates.at(-1))).not.toContain(rejectedId);
    }
  });

  it("reads and erases visible context once per turn anchor and caches only numeric bounds", async () => {
    const adapter = new FakeAdapter();
    adapter.contextSnapshot = {
      text: "Contexte antérieur hautement privé",
      coverage: "partial",
    };
    const { controller, messages, updates } = createHarness(adapter);
    await controller.start();
    await controller.refresh();

    expect(adapter.contextReadCount).toBe(1);
    expect(adapter.contextSnapshot.text).toBe("");
    expect(adapter.lastTurnSnapshot?.promptText).toBe("");
    expect(adapter.lastTurnSnapshot?.responseText).toBe("");
    expect(updates.at(-1)?.context).toMatchObject({ coverage: "partial", hasContext: true });
    expect(updates.at(-1)?.diagnostic.context).toBe("partial");
    const serialized = JSON.stringify(messages);
    expect(serialized).not.toContain("Contexte antérieur hautement privé");
    expect(serialized).not.toContain(adapter.marker);
  });

  it("keeps prompt central input and adds visible context only to the shared upper envelope", async () => {
    const adapter = new FakeAdapter();
    adapter.contextSnapshot = {
      text: "ancien contexte visible répété ".repeat(20),
      coverage: "complete",
    };
    const { controller, messages, updates } = createHarness(adapter);
    const prompt = estimateVisibleTokens("Texte privé du prompt", "openai");
    await controller.start();

    const event = numericMessages(messages)[0] as {
      modelProfileId: string;
      tokens: {
        input: { low: number; central: number; high: number };
        output: never;
        source: "estimated";
      };
    };
    expect(event.tokens.input.central).toBe(prompt.central);
    expect(event.tokens.input.high).toBeGreaterThan(prompt.high);
    expect(updates.at(-1)?.current.tokens.input).toEqual(event.tokens.input);
    expect(updates.at(-1)?.current.impact).toEqual(
      estimateImpact(event.modelProfileId, event.tokens),
    );
  });

  it("resets manual choice and context cache before processing a changed SPA conversation", async () => {
    const adapter = new FakeAdapter();
    adapter.contextSnapshot = { text: "Premier contexte", coverage: "complete" };
    const { controller, local, messages, session, updates, widget } = createHarness(adapter);
    await controller.start();
    modelSelectionCallback(widget)("openai-gpt-4-1-v1");
    await controller.refresh();

    adapter.marker = "conversation-b";
    adapter.contextSnapshot = { text: "Second contexte", coverage: "complete" };
    await controller.refresh();

    expect(adapter.contextReadCount).toBe(2);
    expect(updates.at(-1)?.modelControl.selectedProfileId).toBeNull();
    expect(updates.at(-1)?.modelControl.resolution).toBe("automatic");
    expect(JSON.stringify({ local: local.values, session: session.values })).not.toMatch(
      /openai-gpt-4-1-v1|selectedProfile|manualProfile/i,
    );
    expect(JSON.stringify(messages)).not.toContain("conversation-b");
  });

  it("exposes only structured diagnostics for all response, model and context states", async () => {
    const adapter = new FakeAdapter();
    adapter.contextSnapshot = { text: "Contexte visible", coverage: "complete" };
    const harness = createHarness(adapter);
    await harness.controller.start();
    adapter.snapshot = null;
    await harness.controller.refresh();
    adapter.snapshot = {
      turnElement: adapter.turnElement,
      promptText: "https://private.example/prompt",
      responseText: "Réponse secrète",
      phase: "interrupted",
    };
    adapter.contextSnapshot = { text: "", coverage: "complete" };
    await harness.controller.refresh();
    adapter.rootAvailable = false;
    await harness.controller.refresh();

    const serializedDiagnostics = JSON.stringify(
      harness.updates.map(({ diagnostic }) => diagnostic),
    );
    expect(serializedDiagnostics).not.toMatch(
      /private|secret|https?:|conversation-a|uuid-|tabSessionId|generatedAt|timestamp/i,
    );
    expect(harness.updates.map((update) => update.diagnostic.response)).toEqual(
      expect.arrayContaining(["streaming", "waiting", "interrupted"]),
    );
    expect(harness.updates.map((update) => update.diagnostic.conversation)).toContain("paused");
    expect(harness.updates.map((update) => update.diagnostic.context)).toEqual(
      expect.arrayContaining(["complete", "absent"]),
    );
    expect(harness.updates.map((update) => update.diagnostic.model)).toContain("automatic");
  });

  it("toggles the widget only for the exact toolbar message", async () => {
    const { controller, getRuntimeListener, widget } = createHarness();
    await controller.start();
    const listener = getRuntimeListener();
    if (!listener) throw new Error("MISSING_RUNTIME_LISTENER");
    const sendResponse = vi.fn();

    listener({ version: 1, kind: "toggle-widget" }, {}, sendResponse);
    listener({ version: 1, kind: "toggle-widget", text: "forbidden" }, {}, sendResponse);

    expect(widget.toggleCollapsed).toHaveBeenCalledOnce();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("reuses the event ID and increments only the numeric sequence during streaming", async () => {
    const { adapter, controller, messages, updates } = createHarness();
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
    expect(updates.at(-1)?.diagnostic.response).toBe("complete");
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

  it("fails closed when the extension API is invalidated during a DOM refresh", async () => {
    const { adapter, api, controller, updates } = createHarness();
    await controller.start();
    api.runtime.sendMessage = vi.fn(async () => {
      throw new Error("Extension context invalidated.");
    });
    adapter.marker = "conversation-b";

    await expect(controller.refresh()).resolves.toBeUndefined();

    expect(updates.at(-1)?.state).toBe("measurement-paused");
    expect(adapter.cleanup).toHaveBeenCalledOnce();
  });

  it("unsubscribes when the extension API is invalidated without a conversation change", async () => {
    const { adapter, api, controller, updates } = createHarness();
    await controller.start();
    api.runtime.sendMessage = vi.fn(async () => {
      throw new Error("Extension context invalidated.");
    });
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Une réponse mise à jour sans changement de conversation.",
    };

    await expect(controller.refresh()).resolves.toBeUndefined();

    expect(updates.at(-1)?.state).toBe("measurement-paused");
    expect(adapter.cleanup).toHaveBeenCalledOnce();
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
