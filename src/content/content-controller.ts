import type { PlatformAdapter, VisibleTurnSnapshot } from "../adapters/adapter-contract";
import type { BrowserApi } from "../browser/browser-api";
import { buildImpactDisclosure } from "../impact/impact-disclosure";
import { estimateImpact } from "../impact/impact-engine";
import {
  getModelProfileOptions,
  resolveModelProfile,
  type ModelResolution,
} from "../impact/model-selection";
import type { NumericInteractionEvent, PlatformId } from "../shared/contracts";
import { createRange } from "../shared/range";
import { isNumericAggregate } from "../storage/aggregate-store";
import type { NumericAggregate } from "../storage/storage-types";
import { createInputEnvelope, type ContextTokenEstimate } from "../token/context-envelope";
import { estimateVisibleTokens, type TokenizerFamily } from "../token/token-estimator";
import type { WidgetPreferences } from "../widget/widget-controller";
import type { WidgetConfiguration, WidgetViewModel } from "../widget/eco-widget";
import { conversationChanged, createEphemeralSessionId } from "./page-lifecycle";

const preferencesStorageKey = "ecoia.preferences.v1";

interface TurnState {
  eventId: string;
  sequence: number;
  numericSignature: string;
}

export interface ContentWidget extends HTMLElement {
  configure(configuration: WidgetConfiguration): void;
  update(viewModel: WidgetViewModel): void;
  toggleCollapsed(): void;
  disconnectEcoIaWidget?(): void;
}

interface ContentControllerOptions {
  document: Document;
  adapter: PlatformAdapter;
  api: BrowserApi;
  createWidget: () => ContentWidget;
  randomUUID?: () => string;
  now?: () => number;
}

interface AggregateResponse {
  ok: true;
  session: NumericAggregate | null;
  day: NumericAggregate | null;
}

function tokenizerFamily(platform: PlatformId): TokenizerFamily {
  if (platform === "chatgpt") return "openai";
  if (platform === "perplexity") return "generic";
  return platform;
}

function emptyViewModel(platform: PlatformId): WidgetViewModel {
  const zero = createRange(0, 0, 0);
  const detected = { label: "Modèle non communiqué", observed: false };
  const resolution = resolveModelProfile({ platform, detected, manualProfileId: null });
  return {
    platform,
    state: "initializing",
    modelControl: {
      detectedLabel: detected.label,
      effectiveLabel: resolution.effectiveLabel,
      resolution: resolution.source,
      selectedProfileId: null,
      options: getModelProfileOptions(platform),
      warning: "Modèle non communiqué — profil générique utilisé",
      selectionError: null,
    },
    context: { tokens: zero, coverage: "none", hasContext: false },
    disclosure: null,
    diagnostic: {
      platform: "recognized",
      conversation: "detected",
      model: resolution.source,
      context: "absent",
      response: "waiting",
    },
    current: {
      tokens: { input: zero, output: zero, source: "estimated" },
      impact: null,
    },
    session: null,
    day: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAggregateResponse(value: unknown): AggregateResponse | null {
  if (!isRecord(value) || value.ok !== true) return null;
  const session =
    value.session === null ? null : isNumericAggregate(value.session) ? value.session : null;
  const day = value.day === null ? null : isNumericAggregate(value.day) ? value.day : null;
  return { ok: true, session, day };
}

function isStoredPreferences(value: unknown): value is Partial<WidgetPreferences> {
  if (!isRecord(value)) return false;
  return (
    (value.theme === undefined || ["light", "dark", "system"].includes(value.theme as string)) &&
    (value.side === undefined || value.side === "left" || value.side === "right") &&
    (value.collapsed === undefined || typeof value.collapsed === "boolean") &&
    (value.top === undefined || (typeof value.top === "number" && Number.isFinite(value.top)))
  );
}

function numericSignature(event: NumericInteractionEvent): string {
  return [
    event.modelProfileId,
    event.phase,
    event.tokens.input.low,
    event.tokens.input.central,
    event.tokens.input.high,
    event.tokens.output.low,
    event.tokens.output.central,
    event.tokens.output.high,
  ].join(":");
}

export class ContentController {
  private readonly document: Document;
  private readonly adapter: PlatformAdapter;
  private readonly api: BrowserApi;
  private readonly createWidget: () => ContentWidget;
  private readonly randomUUID: () => string;
  private readonly now: () => number;
  private widget: ContentWidget | null = null;
  private unsubscribeAdapter: (() => void) | null = null;
  private unsubscribeRuntime: (() => void) | null = null;
  private observedRoot: HTMLElement | null = null;
  private tabSessionId: string;
  private conversationMarker: string | null = null;
  private turnStates = new WeakMap<Element, TurnState>();
  private manualProfileId: string | null = null;
  private contextEstimates = new WeakMap<Element, ContextTokenEstimate>();
  private selectionError: string | null = null;
  private viewModel: WidgetViewModel;
  private refreshQueue: Promise<void> = Promise.resolve();

  constructor(options: ContentControllerOptions) {
    this.document = options.document;
    this.adapter = options.adapter;
    this.api = options.api;
    this.createWidget = options.createWidget;
    this.randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
    this.now = options.now ?? Date.now;
    this.tabSessionId = createEphemeralSessionId(this.randomUUID);
    this.viewModel = emptyViewModel(this.adapter.platform);
  }

  async start(): Promise<void> {
    if (this.widget) return;
    this.widget = this.createWidget();
    const stored = await this.api.storage.local.get(preferencesStorageKey);
    const preferences = stored[preferencesStorageKey];
    this.widget.configure({
      ...(isStoredPreferences(preferences) ? { preferences } : {}),
      onPreferencesChange: (nextPreferences) => {
        void this.api.storage.local
          .set({ [preferencesStorageKey]: nextPreferences })
          .catch(() => undefined);
      },
      onModelSelectionChange: (profileId) => this.handleModelSelectionChange(profileId),
    });
    this.document.documentElement.append(this.widget);
    this.unsubscribeRuntime = this.api.runtime.onMessage((message, _sender, sendResponse) => {
      if (
        isRecord(message) &&
        Object.keys(message).length === 2 &&
        message.version === 1 &&
        message.kind === "toggle-widget"
      ) {
        this.widget?.toggleCollapsed();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });
    const root = this.adapter.findConversationRoot(this.document);
    if (!root) {
      this.viewModel = { ...this.viewModel, state: "measurement-paused" };
      this.widget.update(this.viewModel);
      return;
    }
    this.conversationMarker = this.adapter.getConversationMarker(this.document);
    this.subscribeToRoot(root);
    await this.refresh();
  }

  refresh(): Promise<void> {
    this.refreshQueue = this.refreshQueue
      .then(() => this.refreshInternal())
      .catch(() => this.pauseAfterRefreshFailure());
    return this.refreshQueue;
  }

  private pauseAfterRefreshFailure(): void {
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.observedRoot = null;
    this.viewModel = {
      ...this.viewModel,
      state: "measurement-paused",
      current: emptyViewModel(this.adapter.platform).current,
      context: emptyViewModel(this.adapter.platform).context,
      disclosure: null,
      diagnostic: {
        ...this.viewModel.diagnostic,
        conversation: "paused",
        context: "absent",
        response: "waiting",
      },
    };
    this.widget?.update(this.viewModel);
  }

  stop(): void {
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.unsubscribeRuntime?.();
    this.unsubscribeRuntime = null;
    this.observedRoot = null;
    this.widget?.disconnectEcoIaWidget?.();
    this.widget?.remove();
    this.widget = null;
  }

  private subscribeToRoot(root: HTMLElement): void {
    if (this.observedRoot === root) return;
    this.unsubscribeAdapter?.();
    this.observedRoot = root;
    this.unsubscribeAdapter = this.adapter.subscribe(root, () => void this.refresh());
  }

  private async resetConversation(nextMarker: string | null): Promise<void> {
    const previousSessionId = this.tabSessionId;
    this.manualProfileId = null;
    this.selectionError = null;
    this.contextEstimates = new WeakMap<Element, ContextTokenEstimate>();
    this.turnStates = new WeakMap<Element, TurnState>();
    this.conversationMarker = nextMarker;
    this.viewModel = { ...this.viewModel, session: null };
    await this.api.runtime.sendMessage({
      version: 1,
      kind: "reset-session",
      tabSessionId: previousSessionId,
    });
    this.tabSessionId = createEphemeralSessionId(this.randomUUID);
  }

  private handleModelSelectionChange(profileId: string | null): void {
    const allowedProfileIds = new Set(
      getModelProfileOptions(this.adapter.platform).map((option) => option.id),
    );
    if (profileId !== null && !allowedProfileIds.has(profileId)) {
      this.selectionError = "Ce modèle n’est pas disponible pour cette plateforme.";
      this.viewModel = {
        ...this.viewModel,
        modelControl: { ...this.viewModel.modelControl, selectionError: this.selectionError },
      };
      this.widget?.update(this.viewModel);
      return;
    }
    this.manualProfileId = profileId;
    this.selectionError = null;
    void this.refresh();
  }

  private async refreshInternal(): Promise<void> {
    const widget = this.widget;
    if (!widget) return;
    const root = this.adapter.findConversationRoot(this.document);
    if (!root) {
      this.unsubscribeAdapter?.();
      this.unsubscribeAdapter = null;
      this.observedRoot = null;
      this.viewModel = {
        ...this.viewModel,
        state: "measurement-paused",
        current: emptyViewModel(this.adapter.platform).current,
        context: emptyViewModel(this.adapter.platform).context,
        disclosure: null,
        diagnostic: {
          ...this.viewModel.diagnostic,
          conversation: "paused",
          context: "absent",
          response: "waiting",
        },
      };
      widget.update(this.viewModel);
      return;
    }
    this.subscribeToRoot(root);
    const nextMarker = this.adapter.getConversationMarker(this.document);
    if (conversationChanged(this.conversationMarker, nextMarker)) {
      await this.resetConversation(nextMarker);
    } else if (this.conversationMarker === null) {
      this.conversationMarker = nextMarker;
    }

    const detected = this.adapter.detectModel(root);
    const resolution = resolveModelProfile({
      platform: this.adapter.platform,
      detected,
      manualProfileId: this.manualProfileId,
    });
    const snapshot = this.adapter.readLatestTurn(root);
    if (!snapshot) {
      this.viewModel = {
        ...this.viewModel,
        state: "active",
        modelControl: this.createModelControl(resolution),
        context: emptyViewModel(this.adapter.platform).context,
        diagnostic: {
          platform: "recognized",
          conversation: "detected",
          model: resolution.source,
          context: "absent",
          response: "waiting",
        },
      };
      widget.update(this.viewModel);
      return;
    }
    await this.processSnapshot(root, snapshot, detected, widget);
  }

  private createModelControl(resolution: ModelResolution): WidgetViewModel["modelControl"] {
    return {
      detectedLabel: resolution.detectedLabel,
      effectiveLabel: resolution.effectiveLabel,
      resolution: resolution.source,
      selectedProfileId: this.manualProfileId,
      options: getModelProfileOptions(this.adapter.platform),
      warning:
        !resolution.modelObserved && resolution.source === "generic"
          ? "Modèle non communiqué — profil générique utilisé"
          : null,
      selectionError: this.selectionError,
    };
  }

  private readContextEstimate(
    root: HTMLElement,
    turnElement: Element,
    family: TokenizerFamily,
  ): ContextTokenEstimate {
    const cached = this.contextEstimates.get(turnElement);
    if (cached) return cached;
    const snapshot = this.adapter.readVisibleContext(root, turnElement);
    let estimate: ContextTokenEstimate;
    try {
      const hasContext = snapshot.text.trim().length > 0;
      estimate = {
        tokens: hasContext ? estimateVisibleTokens(snapshot.text, family) : createRange(0, 0, 0),
        coverage: hasContext ? snapshot.coverage : "none",
        hasContext,
      };
    } finally {
      snapshot.text = "";
    }
    this.contextEstimates.set(turnElement, estimate);
    return estimate;
  }

  private async processSnapshot(
    root: HTMLElement,
    snapshot: VisibleTurnSnapshot,
    detected: ReturnType<PlatformAdapter["detectModel"]>,
    widget: ContentWidget,
  ): Promise<void> {
    try {
      const family = tokenizerFamily(this.adapter.platform);
      const prompt = estimateVisibleTokens(snapshot.promptText, family);
      const output = estimateVisibleTokens(snapshot.responseText, family);
      const context = this.readContextEstimate(root, snapshot.turnElement, family);
      const input = createInputEnvelope(prompt, context);
      snapshot.promptText = "";
      snapshot.responseText = "";
      const resolution = resolveModelProfile({
        platform: this.adapter.platform,
        detected,
        manualProfileId: this.manualProfileId,
      });
      const tokens = { input, output, source: "estimated" as const };
      const impact = estimateImpact(resolution.profileId, tokens);
      const disclosure = buildImpactDisclosure(impact);
      const previousState = this.turnStates.get(snapshot.turnElement);
      const sequence = (previousState?.sequence ?? 0) + 1;
      const event: NumericInteractionEvent = {
        version: 1,
        eventId: previousState?.eventId ?? createEphemeralSessionId(this.randomUUID),
        tabSessionId: this.tabSessionId,
        sequence,
        platform: this.adapter.platform,
        modelProfileId: resolution.profileId,
        phase: snapshot.phase,
        tokens,
        generatedAt: this.now(),
      };
      const signature = numericSignature(event);
      this.viewModel = {
        ...this.viewModel,
        state: snapshot.phase === "streaming" ? "streaming" : "completed",
        modelControl: this.createModelControl(resolution),
        context,
        disclosure,
        diagnostic: {
          platform: "recognized",
          conversation: "detected",
          model: resolution.source,
          context: context.hasContext
            ? context.coverage === "partial"
              ? "partial"
              : "complete"
            : "absent",
          response:
            snapshot.phase === "streaming"
              ? "streaming"
              : snapshot.phase === "completed"
                ? "complete"
                : "interrupted",
        },
        current: { tokens, impact },
      };
      widget.update(this.viewModel);
      if (previousState?.numericSignature === signature) return;
      this.turnStates.set(snapshot.turnElement, {
        eventId: event.eventId,
        sequence,
        numericSignature: signature,
      });
      const response = parseAggregateResponse(await this.api.runtime.sendMessage(event));
      if (response) {
        this.viewModel = { ...this.viewModel, session: response.session, day: response.day };
        widget.update(this.viewModel);
      }
    } catch (error) {
      snapshot.promptText = "";
      snapshot.responseText = "";
      throw error;
    }
  }
}
