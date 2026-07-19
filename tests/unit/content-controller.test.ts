// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PlatformAdapter,
  VisibleContextSnapshot,
  VisibleTurnSnapshot,
} from "../../src/adapters/adapter-contract";
import type { BrowserApi, ExtensionStorageArea } from "../../src/browser/browser-api";
import { registerServiceWorker } from "../../src/background/service-worker";
import { ContentController, type ContentWidget } from "../../src/content/content-controller";
import { estimateImpact } from "../../src/impact/impact-engine";
import type { DayAggregate } from "../../src/storage/storage-types";
import { estimateVisibleTokens } from "../../src/token/token-estimator";
import type { WidgetViewModel } from "../../src/widget/eco-widget";
import { testUuid } from "../helpers/test-uuid";

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
  marker: string | null = "conversation-a";
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
  findRootCallCount = 0;

  constructor() {
    this.root.append(this.turnElement);
  }

  detectModel() {
    return { label: this.model, observed: this.modelObserved };
  }
  findConversationRoot() {
    this.findRootCallCount += 1;
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

function zeroDayAggregate(localDate: string, interactionCount = 0): DayAggregate {
  const zero = { low: 0, central: 0, high: 0 };
  return {
    version: 1,
    interactionCount,
    platformCounts: { chatgpt: 0, claude: 0, gemini: 0, mistral: 0, perplexity: 0 },
    tokens: { input: zero, output: zero },
    impacts: {
      energyWh: zero,
      waterMl: zero,
      carbonG: zero,
      televisionSeconds: zero,
      carMeters: zero,
    },
    localDate,
  };
}

function activateSnapshotAfterStart(controller: ContentController, adapter: FakeAdapter): void {
  const start = controller.start.bind(controller);
  controller.start = async () => {
    const snapshot = adapter.snapshot;
    const marker = adapter.marker;
    adapter.snapshot = null;
    adapter.marker = null;
    await start();
    adapter.marker = marker;
    adapter.snapshot = snapshot;
    if (snapshot) await controller.refresh();
  };
}

function createHarness(
  adapter = new FakeAdapter(),
  numericResponses: unknown[] = [],
  options: { snapshotAlreadyPresent?: boolean } = {},
) {
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
        if (numericResponses.length > 0) return structuredClone(numericResponses.shift());
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
    randomUUID: () => testUuid(++uuidIndex),
    now: () => 1_784_368_800_000 + uuidIndex,
  });
  if (!options.snapshotAlreadyPresent) activateSnapshotAfterStart(controller, adapter);
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

function createIntegratedHarness(
  adapter = new FakeAdapter(),
  options: { malformedFirstNumericAck?: boolean } = {},
) {
  const messages: unknown[] = [];
  const updates: WidgetViewModel[] = [];
  const local = new MemoryStorageArea();
  const session = new MemoryStorageArea();
  let workerListener: Parameters<BrowserApi["runtime"]["onMessage"]>[0] | null = null;
  let toolbarListener: Parameters<BrowserApi["runtime"]["onMessage"]>[0] | null = null;
  let numericResponseCount = 0;

  const workerApi: BrowserApi = {
    runtime: {
      sendMessage: vi.fn(async () => undefined),
      onMessage(listener) {
        workerListener = listener;
        return () => (workerListener = null);
      },
    },
    storage: { local, session },
  };
  const cleanupWorker = registerServiceWorker(workerApi, {
    now: () => 1_721_318_400_000,
    localDate: () => "2026-07-18",
  });

  const contentApi: BrowserApi = {
    runtime: {
      async sendMessage(message) {
        messages.push(structuredClone(message));
        const listener = workerListener;
        if (!listener) throw new Error("MISSING_WORKER_LISTENER");
        return new Promise((resolve) => {
          const keepChannelOpen = listener(message, {}, (response) =>
            resolve(
              options.malformedFirstNumericAck &&
                "eventId" in (message as Record<string, unknown>) &&
                numericResponseCount++ === 0
                ? { ok: true }
                : structuredClone(response),
            ),
          );
          if (keepChannelOpen !== true) throw new Error("WORKER_CHANNEL_CLOSED");
        });
      },
      onMessage(listener) {
        toolbarListener = listener;
        return () => (toolbarListener = null);
      },
    },
    storage: { local, session },
  };
  const widget = Object.assign(document.createElement("div"), {
    configure: vi.fn(),
    update: (viewModel: WidgetViewModel) => updates.push(structuredClone(viewModel)),
    toggleCollapsed: vi.fn(),
  }) as ContentWidget;
  let uuidIndex = 0;
  const controller = new ContentController({
    document,
    adapter,
    api: contentApi,
    createWidget: () => widget,
    randomUUID: () => testUuid(++uuidIndex),
    now: () => 1_784_368_800_000 + uuidIndex,
  });
  activateSnapshotAfterStart(controller, adapter);

  const createRestartedController = () => {
    const restartedUpdates: WidgetViewModel[] = [];
    const restartedWidget = Object.assign(document.createElement("div"), {
      configure: vi.fn(),
      update: (viewModel: WidgetViewModel) => restartedUpdates.push(structuredClone(viewModel)),
      toggleCollapsed: vi.fn(),
    }) as ContentWidget;
    const restartedController = new ContentController({
      document,
      adapter,
      api: contentApi,
      createWidget: () => restartedWidget,
      randomUUID: () => testUuid(++uuidIndex),
      now: () => 1_784_368_800_000 + uuidIndex,
    });
    return { controller: restartedController, updates: restartedUpdates, widget: restartedWidget };
  };

  return {
    controller,
    messages,
    updates,
    widget,
    cleanupWorker,
    createRestartedController,
    getWorkerListener: () => workerListener,
    getToolbarListener: () => toolbarListener,
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

  it("charge uniquement des coordonnées de widget finies", async () => {
    const valid = createHarness();
    valid.local.values["ecoia.preferences.v1"] = {
      theme: "light",
      collapsed: false,
      left: 321,
      top: 147,
    };
    await valid.controller.start();
    expect(valid.widget.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ left: 321, top: 147 }),
      }),
    );
    valid.controller.stop();

    const invalid = createHarness();
    invalid.local.values["ecoia.preferences.v1"] = {
      theme: "light",
      collapsed: false,
      left: Number.POSITIVE_INFINITY,
      top: 147,
    };
    await invalid.controller.start();
    const configuration = (invalid.widget.configure as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(configuration).not.toHaveProperty("preferences");
    invalid.controller.stop();
  });

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

    const currentAdapter = new FakeAdapter();
    currentAdapter.model = "Instantanée";
    const current = createHarness(currentAdapter);
    await current.controller.start();
    expect(numericMessages(current.messages)[0]).toMatchObject({
      modelProfileId: "openai-generic-v1",
    });
    expect(current.updates.at(-1)?.modelControl).toMatchObject({
      resolution: "automatic",
      effectiveLabel: "GPT-5.5 Instant · proxy D",
      warning: null,
      methodNote: expect.stringContaining("Aucune donnée environnementale propre à GPT-5.5"),
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

    const unsupportedAdapter = new FakeAdapter();
    unsupportedAdapter.model = "GPT-4o mini";
    const unsupported = createHarness(unsupportedAdapter);
    await unsupported.controller.start();
    expect(numericMessages(unsupported.messages)[0]).toMatchObject({
      modelProfileId: "openai-generic-v1",
    });
    expect(unsupported.updates.at(-1)?.modelControl).toMatchObject({
      resolution: "generic",
      effectiveLabel: "GPT-4o mini · proxy D",
      warning: null,
      methodNote: expect.stringContaining("Aucune donnée environnementale propre à GPT-4o mini"),
    });
  });

  it("recalculates the same interaction when a compatible manual profile is selected", async () => {
    const { controller, messages, updates, widget } = createHarness();
    await controller.start();
    modelSelectionCallback(widget)("chatgpt-gpt-5-6-sol");
    await controller.refresh();

    const [first, second] = numericMessages(messages) as Array<{
      eventId: string;
      sequence: number;
      modelProfileId: string;
    }>;
    expect(second?.eventId).toBe(first?.eventId);
    expect(second?.sequence).toBe((first?.sequence ?? 0) + 1);
    expect(second?.modelProfileId).toBe("openai-generic-v1");
    expect(updates.at(-1)?.modelControl).toMatchObject({
      resolution: "manual",
      selectedProfileId: "chatgpt-gpt-5-6-sol",
      effectiveLabel: "GPT-5.6 Sol · proxy D",
      warning: null,
    });
    expect(updates.at(-1)?.diagnostic.model).toBe("manual");
  });

  it("replaces one real worker/store contribution after the captured model callback", async () => {
    const harness = createIntegratedHarness();
    await harness.controller.start();
    expect(harness.getWorkerListener()).not.toBeNull();
    expect(harness.getToolbarListener()).not.toBeNull();
    expect(harness.getWorkerListener()).not.toBe(harness.getToolbarListener());

    modelSelectionCallback(harness.widget)("chatgpt-gpt-5-6-sol");
    await harness.controller.refresh();

    const [automatic, manual] = numericMessages(harness.messages) as Array<{
      eventId: string;
      sequence: number;
      modelProfileId: string;
    }>;
    expect(manual?.eventId).toBe(automatic?.eventId);
    expect(manual?.sequence).toBe((automatic?.sequence ?? 0) + 1);
    expect(manual?.modelProfileId).toBe("openai-generic-v1");
    expect(harness.updates.at(-1)).toMatchObject({
      modelControl: {
        resolution: "manual",
        selectedProfileId: "chatgpt-gpt-5-6-sol",
        methodNote: expect.stringContaining("proxy OpenAI générique"),
      },
      session: { interactionCount: 1 },
      day: { interactionCount: 1, localDate: "2026-07-18" },
    });
    harness.cleanupWorker();
  });

  it("rejects unknown and incompatible profiles without changing or sending the measurement", async () => {
    const { controller, messages, updates, widget } = createHarness();
    await controller.start();
    const select = modelSelectionCallback(widget);
    select("chatgpt-gpt-5-6-sol");
    await controller.refresh();
    const validMeasurement = structuredClone(updates.at(-1)?.current);
    const sentAfterValidSelection = numericMessages(messages).length;

    for (const rejectedId of ["anthropic-claude-3-5-v1", "unknown-private-profile"]) {
      select(rejectedId);
      await controller.refresh();
      expect(numericMessages(messages)).toHaveLength(sentAfterValidSelection);
      expect(updates.at(-1)?.current).toEqual(validMeasurement);
      expect(updates.at(-1)?.modelControl).toMatchObject({
        selectedProfileId: "chatgpt-gpt-5-6-sol",
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
    modelSelectionCallback(widget)("chatgpt-gpt-5-6-sol");
    await controller.refresh();

    adapter.marker = "conversation-b";
    adapter.contextSnapshot = { text: "Second contexte", coverage: "complete" };
    await controller.refresh();

    expect(adapter.contextReadCount).toBe(2);
    expect(updates.at(-1)?.modelControl.selectedProfileId).toBeNull();
    expect(updates.at(-1)?.modelControl.resolution).toBe("automatic");
    expect(JSON.stringify({ local: local.values, session: session.values })).not.toMatch(
      /chatgpt-gpt-5-6-sol|selectedProfile|manualProfile/i,
    );
    expect(JSON.stringify(messages)).not.toContain("conversation-b");
  });

  it("resets once without recounting the old DOM when a conversation reaches the root route", async () => {
    const adapter = new FakeAdapter();
    adapter.contextSnapshot = { text: "Premier contexte", coverage: "complete" };
    const { controller, messages, updates, widget } = createHarness(adapter);
    await controller.start();
    modelSelectionCallback(widget)("chatgpt-gpt-5-6-sol");
    await controller.refresh();
    const firstNumeric = numericMessages(messages)[0] as {
      eventId: string;
      tabSessionId: string;
    };

    adapter.marker = null;
    adapter.contextSnapshot = { text: "Contexte de la route racine", coverage: "complete" };
    await controller.refresh();
    await controller.refresh();

    const resetMessages = messages.filter(
      (message) => (message as { kind?: string }).kind === "reset-session",
    );
    const afterReset = numericMessages(messages).at(-1) as {
      eventId: string;
      tabSessionId: string;
    };
    expect(resetMessages).toEqual([
      { version: 1, kind: "reset-session", tabSessionId: firstNumeric.tabSessionId },
    ]);
    expect(numericMessages(messages)).toHaveLength(2);
    expect(adapter.contextReadCount).toBe(2);
    expect(afterReset.eventId).toBe(firstNumeric.eventId);
    expect(afterReset.tabSessionId).toBe(firstNumeric.tabSessionId);
    expect(updates.at(-1)?.modelControl).toMatchObject({
      selectedProfileId: null,
      resolution: "automatic",
    });
    expect(updates.at(-1)?.session).toBeNull();
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
      /private|secret|https?:|conversation-a|[0-9a-f]{8}-[0-9a-f-]{27,}|tabSessionId|generatedAt|timestamp/i,
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

  it("keeps one logical interaction when an accepted active turn and root are rerendered", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();

    const replacementTurn = document.createElement("article");
    adapter.root.replaceChildren(replacementTurn);
    adapter.snapshot = {
      turnElement: replacementTurn,
      promptText: "Texte privé du prompt",
      responseText: "Réponse plus longue après remplacement de l’ancre.",
      phase: "streaming",
    };
    await harness.controller.refresh();

    const replacementRoot = document.createElement("main");
    const replacementAfterRootChange = document.createElement("article");
    replacementRoot.append(replacementAfterRootChange);
    adapter.root = replacementRoot;
    adapter.snapshot = {
      turnElement: replacementAfterRootChange,
      promptText: "Texte privé du prompt",
      responseText: "Réponse encore plus longue après remplacement de la racine.",
      phase: "streaming",
    };
    await harness.controller.refresh();

    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Réponse terminée après les deux rerendus.",
      phase: "completed",
    };
    await harness.controller.refresh();

    const sent = numericMessages(harness.messages) as Array<{
      eventId: string;
      sequence: number;
    }>;
    expect(new Set(sent.map(({ eventId }) => eventId)).size).toBe(1);
    expect(sent.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4]);
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 1 },
      day: { interactionCount: 1 },
    });
    harness.controller.stop();
    harness.cleanupWorker();
  });

  it("rebinds an unchanged acknowledged streaming turn across repeated refreshes", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    const sentBeforeReplacement = numericMessages(harness.messages).length;

    const replacementTurn = document.createElement("article");
    adapter.root.replaceChildren(replacementTurn);
    adapter.snapshot = { ...requireSnapshot(adapter), turnElement: replacementTurn };
    await harness.controller.refresh();
    await harness.controller.refresh();

    expect(numericMessages(harness.messages)).toHaveLength(sentBeforeReplacement);
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 1 },
      day: { interactionCount: 1 },
    });
    harness.controller.stop();
    harness.cleanupWorker();
  });

  it("starts a new interaction when virtualization replaces a terminal turn with a streaming turn", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Première réponse terminée avant virtualisation.",
      phase: "completed",
    };
    await harness.controller.refresh();

    const nextTurn = document.createElement("article");
    adapter.root.replaceChildren(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Deuxième prompt après virtualisation.",
      responseText: "Deuxième réponse en cours.",
      phase: "streaming",
    };
    await harness.controller.refresh();

    const sent = numericMessages(harness.messages) as Array<{ eventId: string }>;
    expect(new Set(sent.map(({ eventId }) => eventId)).size).toBe(2);
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 2 },
      day: { interactionCount: 2 },
    });
    harness.controller.stop();
    harness.cleanupWorker();
  });

  it("does not recount an unchanged terminal turn when its DOM anchor is replaced", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    const terminalSnapshot = {
      ...requireSnapshot(adapter),
      responseText: "Réponse terminale stable après rendu.",
      phase: "completed" as const,
    };
    adapter.snapshot = terminalSnapshot;
    await harness.controller.refresh();
    const sentBeforeReplacement = numericMessages(harness.messages).length;

    const replacementTurn = document.createElement("article");
    adapter.root.replaceChildren(replacementTurn);
    adapter.snapshot = { ...terminalSnapshot, turnElement: replacementTurn };
    await harness.controller.refresh();
    await harness.controller.refresh();

    expect(numericMessages(harness.messages)).toHaveLength(sentBeforeReplacement);
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 1 },
      day: { interactionCount: 1 },
    });
    harness.controller.stop();
    harness.cleanupWorker();
  });

  it("keeps one interaction when a replaced terminal turn gains visible post-processing", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Réponse terminée avant enrichissement.",
      phase: "completed",
    };
    await harness.controller.refresh();

    const enrichedTurn = document.createElement("article");
    adapter.root.replaceChildren(enrichedTurn);
    adapter.snapshot = {
      turnElement: enrichedTurn,
      promptText: "Texte privé du prompt",
      responseText: "Réponse terminée avant enrichissement. Citation visible ajoutée ensuite.",
      phase: "completed",
    };
    await harness.controller.refresh();
    await harness.controller.refresh();

    const sent = numericMessages(harness.messages) as Array<{ eventId: string }>;
    expect(new Set(sent.map(({ eventId }) => eventId)).size).toBe(1);
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 1 },
      day: { interactionCount: 1 },
    });
    harness.controller.stop();
    harness.cleanupWorker();
  });

  it("counts a distinct terminal interaction that replaces the previous DOM anchor", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Première réponse terminée.",
      phase: "completed",
    };
    await harness.controller.refresh();

    const nextTurn = document.createElement("article");
    adapter.root.replaceChildren(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Deuxième prompt distinct déjà terminé.",
      responseText: "Deuxième réponse déjà terminée.",
      phase: "completed",
    };
    await harness.controller.refresh();

    const sent = numericMessages(harness.messages) as Array<{ eventId: string }>;
    expect(new Set(sent.map(({ eventId }) => eventId)).size).toBe(2);
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 2 },
      day: { interactionCount: 2 },
    });
    harness.controller.stop();
    harness.cleanupWorker();
  });

  it("counts a new streaming turn that replaces a pre-existing terminal baseline", async () => {
    const adapter = new FakeAdapter();
    adapter.snapshot = { ...requireSnapshot(adapter), phase: "completed" };
    const harness = createHarness(adapter, [], { snapshotAlreadyPresent: true });
    await harness.controller.start();
    expect(numericMessages(harness.messages)).toHaveLength(0);

    const firstActiveTurn = document.createElement("article");
    adapter.root.replaceChildren(firstActiveTurn);
    adapter.snapshot = {
      turnElement: firstActiveTurn,
      promptText: "Premier prompt actif après la baseline virtualisée.",
      responseText: "Première réponse active en cours.",
      phase: "streaming",
    };
    await harness.controller.refresh();

    expect(numericMessages(harness.messages)).toHaveLength(1);
    harness.controller.stop();
  });

  it("retries an unacknowledged numeric signature with the same event identity and sequence", async () => {
    const harness = createHarness(new FakeAdapter(), [
      { ok: false, error: "PROCESSING_FAILED" },
      { ok: true, status: "accepted", session: null, day: null },
    ]);
    await harness.controller.start();
    await harness.controller.refresh();
    await harness.controller.refresh();

    const sent = numericMessages(harness.messages) as Array<{
      eventId: string;
      sequence: number;
    }>;
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({
      eventId: sent[0]?.eventId,
      sequence: sent[0]?.sequence,
    });
  });

  it("never acknowledges malformed ok:true and contributes the retry exactly once", async () => {
    const harness = createIntegratedHarness(new FakeAdapter(), {
      malformedFirstNumericAck: true,
    });
    await harness.controller.start();
    await harness.controller.refresh();
    await harness.controller.refresh();

    const sent = numericMessages(harness.messages) as Array<{
      eventId: string;
      sequence: number;
    }>;
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(expect.objectContaining(sent[0]));
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 1 },
      day: { interactionCount: 1 },
    });
    harness.cleanupWorker();
  });

  it("shows but does not recount the same completed DOM snapshot after content restart", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Réponse terminée avant le redémarrage du content script.",
      phase: "completed",
    };
    await harness.controller.refresh();
    expect(harness.updates.at(-1)?.day).toMatchObject({ interactionCount: 1 });
    const sentBeforeRestart = numericMessages(harness.messages).length;
    harness.controller.stop();

    const restarted = harness.createRestartedController();
    await restarted.controller.start();

    expect(numericMessages(harness.messages)).toHaveLength(sentBeforeRestart);
    expect(restarted.updates.at(-1)).toMatchObject({
      state: "completed",
      day: { interactionCount: 1 },
    });
    restarted.controller.stop();
    harness.cleanupWorker();
  });

  it("keeps a streaming turn display-only through growth and completion after restart", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    expect(harness.updates.at(-1)?.day).toMatchObject({ interactionCount: 1 });
    const sentBeforeRestart = numericMessages(harness.messages).length;
    harness.controller.stop();

    const restarted = harness.createRestartedController();
    await restarted.controller.start();
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Réponse en cours devenue plus longue après rechargement.",
      phase: "streaming",
    };
    await restarted.controller.refresh();
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      responseText: "Réponse terminée après rechargement.",
      phase: "completed",
    };
    await restarted.controller.refresh();

    expect(numericMessages(harness.messages)).toHaveLength(sentBeforeRestart);
    expect(restarted.updates.at(-1)).toMatchObject({
      state: "completed",
      day: { interactionCount: 1 },
      session: null,
    });

    const nextTurn = document.createElement("article");
    adapter.root.append(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Question réellement suivante.",
      responseText: "Nouvelle réponse en cours.",
      phase: "streaming",
    };
    await restarted.controller.refresh();
    expect(numericMessages(harness.messages)).toHaveLength(sentBeforeRestart + 1);
    expect(restarted.updates.at(-1)?.day).toMatchObject({ interactionCount: 2 });

    restarted.controller.stop();
    harness.cleanupWorker();
  });

  it("hydrates only the aggregate for the current local calendar day", async () => {
    const current = createHarness(new FakeAdapter(), [], { snapshotAlreadyPresent: true });
    current.adapter.snapshot = { ...requireSnapshot(current.adapter), phase: "completed" };
    current.local.values["ecoia.day.v1"] = zeroDayAggregate("2026-07-18", 7);
    await current.controller.start();
    expect(current.updates.at(-1)?.day).toMatchObject({
      interactionCount: 7,
      localDate: "2026-07-18",
    });

    current.controller.stop();
    document.body.replaceChildren();
    const stale = createHarness(new FakeAdapter(), [], { snapshotAlreadyPresent: true });
    stale.adapter.snapshot = { ...requireSnapshot(stale.adapter), phase: "completed" };
    stale.local.values["ecoia.day.v1"] = zeroDayAggregate("2026-07-17", 99);
    await stale.controller.start();
    expect(stale.updates.at(-1)?.day).toBeNull();
  });

  it("treats a terminal turn found after SPA navigation as a non-aggregated baseline", async () => {
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
    expect(numericMessages(messages)).toHaveLength(1);
    expect(JSON.stringify(messages)).not.toContain("conversation-a");
    expect(JSON.stringify(messages)).not.toContain("conversation-b");
  });

  it("baselines a replacement streaming turn after SPA navigation until a later turn is added", async () => {
    const { adapter, controller, messages } = createHarness();
    await controller.start();
    const firstSession = (messages[0] as { tabSessionId: string }).tabSessionId;
    adapter.marker = "conversation-b";
    const replacementStreamingTurn = document.createElement("article");
    adapter.root.replaceChildren(replacementStreamingTurn);
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      turnElement: replacementStreamingTurn,
      responseText: "Nouvelle réponse encore en cours.",
      phase: "streaming",
    };
    await controller.refresh();

    const replacementTerminalTurn = document.createElement("article");
    adapter.root.replaceChildren(replacementTerminalTurn);
    adapter.snapshot = {
      ...requireSnapshot(adapter),
      turnElement: replacementTerminalTurn,
      responseText: "Réponse de baseline terminée après remplacement DOM.",
      phase: "completed",
    };
    await controller.refresh();

    expect(messages[1]).toEqual({ version: 1, kind: "reset-session", tabSessionId: firstSession });
    expect(numericMessages(messages)).toHaveLength(1);

    const nextTurn = document.createElement("article");
    adapter.root.append(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Question suivante après la baseline SPA.",
      responseText: "Réponse suivante en cours.",
      phase: "streaming",
    };
    await controller.refresh();
    expect((numericMessages(messages)[1] as { tabSessionId: string }).tabSessionId).not.toBe(
      firstSession,
    );
  });

  it("keeps the changed-conversation baseline pending across an empty SPA transition", async () => {
    const { adapter, controller, messages } = createHarness();
    await controller.start();
    const sentBeforeNavigation = numericMessages(messages).length;
    adapter.marker = "conversation-b";
    adapter.root.replaceChildren();
    adapter.snapshot = null;
    await controller.refresh();

    const delayedBaseline = document.createElement("article");
    adapter.root.append(delayedBaseline);
    adapter.snapshot = {
      turnElement: delayedBaseline,
      promptText: "Question historique chargée après transition.",
      responseText: "Réponse historique déjà terminée.",
      phase: "completed",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(sentBeforeNavigation);

    const nextTurn = document.createElement("article");
    adapter.root.append(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Question réellement nouvelle.",
      responseText: "Réponse réellement nouvelle.",
      phase: "completed",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(sentBeforeNavigation + 1);
  });

  it("keeps a completed history loaded after an initially empty root as the baseline", async () => {
    const adapter = new FakeAdapter();
    adapter.snapshot = null;
    const { controller, messages } = createHarness(adapter);
    await controller.start();

    const delayedHistory = document.createElement("article");
    adapter.root.append(delayedHistory);
    adapter.snapshot = {
      turnElement: delayedHistory,
      promptText: "Prompt historique chargé tardivement.",
      responseText: "Réponse historique déjà terminée.",
      phase: "completed",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(0);

    const firstActiveTurn = document.createElement("article");
    adapter.root.append(firstActiveTurn);
    adapter.snapshot = {
      turnElement: firstActiveTurn,
      promptText: "Premier prompt réellement actif.",
      responseText: "Première réponse active en cours.",
      phase: "streaming",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(1);
    controller.stop();
  });

  it("keeps an existing conversation hydrated as streaming after start in the baseline", async () => {
    const adapter = new FakeAdapter();
    adapter.snapshot = null;
    const { controller, messages } = createHarness(adapter, [], { snapshotAlreadyPresent: true });
    await controller.start();

    const hydratedTurn = document.createElement("article");
    adapter.root.replaceChildren(hydratedTurn);
    adapter.snapshot = {
      turnElement: hydratedTurn,
      promptText: "Prompt existant hydraté après le chargement.",
      responseText: "Réponse existante encore en cours.",
      phase: "streaming",
    };
    await controller.refresh();
    adapter.snapshot = { ...requireSnapshot(adapter), phase: "completed" };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(0);

    const nextTurn = document.createElement("article");
    adapter.root.append(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Premier prompt créé après l’activation.",
      responseText: "Première réponse active.",
      phase: "streaming",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(1);
    controller.stop();
  });

  it("counts the first streaming turn created after a confirmed empty SPA transition", async () => {
    const adapter = new FakeAdapter();
    const harness = createIntegratedHarness(adapter);
    await harness.controller.start();
    const sentBeforeNavigation = numericMessages(harness.messages).length;

    adapter.marker = "conversation-empty-new";
    adapter.root.replaceChildren();
    adapter.snapshot = null;
    await harness.controller.refresh();

    const firstNewTurn = document.createElement("article");
    adapter.root.append(firstNewTurn);
    adapter.snapshot = {
      turnElement: firstNewTurn,
      promptText: "Premier prompt réellement créé dans la conversation vide.",
      responseText: "Première réponse en cours.",
      phase: "streaming",
    };
    await harness.controller.refresh();

    expect(numericMessages(harness.messages)).toHaveLength(sentBeforeNavigation + 1);
    expect(harness.updates.at(-1)).toMatchObject({
      session: { interactionCount: 1 },
      day: { interactionCount: 2 },
    });
    harness.controller.stop();
    harness.cleanupWorker();
  });

  it("keeps a terminal baseline display-only when its DOM anchor is replaced", async () => {
    const adapter = new FakeAdapter();
    adapter.snapshot = { ...requireSnapshot(adapter), phase: "completed" };
    const { controller, messages } = createHarness(adapter, [], { snapshotAlreadyPresent: true });
    await controller.start();
    expect(numericMessages(messages)).toHaveLength(0);

    const replacement = document.createElement("article");
    adapter.root.replaceChildren(replacement);
    adapter.snapshot = {
      turnElement: replacement,
      promptText: "Même prompt rerendu.",
      responseText: "Même réponse rerendue.",
      phase: "completed",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(0);

    const nextTurn = document.createElement("article");
    adapter.root.append(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Nouveau prompt ajouté.",
      responseText: "Nouvelle réponse ajoutée.",
      phase: "completed",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(1);
    controller.stop();
  });

  it("discovers a slowly loaded root and baselines its pre-existing turn automatically", async () => {
    const adapter = new FakeAdapter();
    adapter.rootAvailable = false;
    adapter.snapshot = { ...requireSnapshot(adapter), phase: "completed" };
    const { controller, messages, updates } = createHarness(adapter, [], {
      snapshotAlreadyPresent: true,
    });
    await controller.start();

    adapter.rootAvailable = true;
    document.body.append(adapter.root);
    await vi.waitFor(() => expect(updates.at(-1)?.state).toBe("completed"));
    expect(numericMessages(messages)).toHaveLength(0);

    const nextTurn = document.createElement("article");
    adapter.root.append(nextTurn);
    adapter.snapshot = {
      turnElement: nextTurn,
      promptText: "Nouveau prompt après chargement lent.",
      responseText: "Nouvelle réponse après chargement lent.",
      phase: "completed",
    };
    await controller.refresh();
    expect(numericMessages(messages)).toHaveLength(1);
    controller.stop();
  });

  it("clears the previous measurement when a changed SPA conversation has no turn", async () => {
    const adapter = new FakeAdapter();
    adapter.contextSnapshot = { text: "Contexte du premier tour", coverage: "complete" };
    const { controller, updates, widget } = createHarness(adapter);
    await controller.start();
    modelSelectionCallback(widget)("chatgpt-gpt-5-6-sol");
    await controller.refresh();
    const previous = updates.at(-1);
    expect(previous?.current.impact).not.toBeNull();
    expect(previous?.current.tokens.input.central).toBeGreaterThan(0);

    adapter.marker = "conversation-empty";
    adapter.snapshot = null;
    await controller.refresh();

    const current = updates.at(-1);
    expect(current?.current).toEqual({
      tokens: {
        input: { low: 0, central: 0, high: 0 },
        output: { low: 0, central: 0, high: 0 },
        source: "estimated",
      },
      impact: null,
    });
    expect(current?.disclosure).toBeNull();
    expect(current?.context).toEqual({
      tokens: { low: 0, central: 0, high: 0 },
      coverage: "none",
      hasContext: false,
    });
    expect(current?.modelControl.selectedProfileId).toBeNull();
    expect(current?.diagnostic).toMatchObject({
      conversation: "detected",
      context: "absent",
      response: "waiting",
    });
    expect(current?.current).not.toEqual(previous?.current);
  });

  it("fails closed when the conversation root is missing", async () => {
    const adapter = new FakeAdapter();
    adapter.rootAvailable = false;
    const { controller, messages, updates } = createHarness(adapter);
    await controller.start();
    expect(messages).toHaveLength(0);
    expect(updates.at(-1)?.state).toBe("measurement-paused");
    expect(updates.at(-1)?.context).toMatchObject({ coverage: "none", hasContext: false });
    expect(updates.at(-1)?.diagnostic).toMatchObject({
      conversation: "paused",
      context: "absent",
      response: "waiting",
    });
    controller.stop();
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

  it("moves the scoped observer automatically when a connected SPA root is replaced", async () => {
    const adapter = new FakeAdapter();
    document.body.append(adapter.root);
    const { controller } = createHarness(adapter);
    await controller.start();
    const replacementRoot = document.createElement("main");
    adapter.root = replacementRoot;
    document.body.replaceChildren(replacementRoot);
    await vi.waitFor(() => expect(adapter.cleanup).toHaveBeenCalledOnce());
    controller.stop();
  });

  it("rearms root presence tracking after the same root moves to a new parent", async () => {
    const adapter = new FakeAdapter();
    const firstParent = document.createElement("section");
    const secondParent = document.createElement("section");
    document.body.append(firstParent, secondParent);
    firstParent.append(adapter.root);
    const { controller } = createHarness(adapter);
    await controller.start();

    const callsBeforeMove = adapter.findRootCallCount;
    secondParent.append(adapter.root);
    await vi.waitFor(() => expect(adapter.findRootCallCount).toBeGreaterThan(callsBeforeMove));

    const replacementRoot = document.createElement("main");
    adapter.root = replacementRoot;
    secondParent.replaceChildren(replacementRoot);
    await vi.waitFor(() => expect(adapter.cleanup).toHaveBeenCalledOnce());
    controller.stop();
  });

  it("throttles root discovery during mutation bursts while the root is absent", async () => {
    vi.useFakeTimers();
    try {
      const adapter = new FakeAdapter();
      adapter.rootAvailable = false;
      const { controller } = createHarness(adapter);
      await controller.start();
      const callsAfterStart = adapter.findRootCallCount;

      const mutationContainer = document.createElement("div");
      document.body.append(mutationContainer);
      for (let index = 0; index < 50; index += 1) {
        mutationContainer.append(document.createElement("span"));
      }
      await Promise.resolve();
      await Promise.resolve();
      expect(adapter.findRootCallCount).toBe(callsAfterStart);

      await vi.advanceTimersByTimeAsync(499);
      expect(adapter.findRootCallCount).toBe(callsAfterStart);
      await vi.advanceTimersByTimeAsync(1);
      expect(adapter.findRootCallCount).toBe(callsAfterStart + 1);
      controller.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
