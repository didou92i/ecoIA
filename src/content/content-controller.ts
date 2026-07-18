import type { PlatformAdapter, VisibleTurnSnapshot } from "../adapters/adapter-contract";
import type { BrowserApi } from "../browser/browser-api";
import { estimateImpact } from "../impact/impact-engine";
import { resolveImpactProfileId } from "../impact/profile-registry";
import type { NumericInteractionEvent, PlatformId } from "../shared/contracts";
import { createRange } from "../shared/range";
import { isNumericAggregate } from "../storage/aggregate-store";
import type { NumericAggregate } from "../storage/storage-types";
import { estimateVisibleTokens, type TokenizerFamily } from "../token/token-estimator";
import type { WidgetPreferences } from "../widget/widget-controller";
import type { WidgetViewModel } from "../widget/eco-widget";
import { conversationChanged, createEphemeralSessionId } from "./page-lifecycle";

const preferencesStorageKey = "ecoia.preferences.v1";

interface TurnState {
  eventId: string;
  sequence: number;
  numericSignature: string;
}

export interface ContentWidget extends HTMLElement {
  configure(configuration: {
    preferences?: Partial<WidgetPreferences>;
    onPreferencesChange?: (preferences: WidgetPreferences) => void;
  }): void;
  update(viewModel: WidgetViewModel): void;
  toggleCollapsed(): void;
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
  return {
    platform,
    model: "Modèle non détecté",
    state: "initializing",
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
    this.refreshQueue = this.refreshQueue.then(() => this.refreshInternal());
    return this.refreshQueue;
  }

  stop(): void {
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.unsubscribeRuntime?.();
    this.unsubscribeRuntime = null;
    this.observedRoot = null;
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
    await this.api.runtime.sendMessage({
      version: 1,
      kind: "reset-session",
      tabSessionId: previousSessionId,
    });
    this.tabSessionId = createEphemeralSessionId(this.randomUUID);
    this.turnStates = new WeakMap<Element, TurnState>();
    this.conversationMarker = nextMarker;
    this.viewModel = { ...this.viewModel, session: null };
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

    const snapshot = this.adapter.readLatestTurn(root);
    const model = this.adapter.detectModel(root).label;
    if (!snapshot) {
      this.viewModel = { ...this.viewModel, model, state: "active" };
      widget.update(this.viewModel);
      return;
    }
    await this.processSnapshot(snapshot, model, widget);
  }

  private async processSnapshot(
    snapshot: VisibleTurnSnapshot,
    model: string,
    widget: ContentWidget,
  ): Promise<void> {
    try {
      const family = tokenizerFamily(this.adapter.platform);
      const input = estimateVisibleTokens(snapshot.promptText, family);
      const output = estimateVisibleTokens(snapshot.responseText, family);
      snapshot.promptText = "";
      snapshot.responseText = "";
      const profileId = resolveImpactProfileId(this.adapter.platform, model);
      const tokens = { input, output, source: "estimated" as const };
      const impact = estimateImpact(profileId, tokens);
      const previousState = this.turnStates.get(snapshot.turnElement);
      const sequence = (previousState?.sequence ?? 0) + 1;
      const event: NumericInteractionEvent = {
        version: 1,
        eventId: previousState?.eventId ?? createEphemeralSessionId(this.randomUUID),
        tabSessionId: this.tabSessionId,
        sequence,
        platform: this.adapter.platform,
        modelProfileId: profileId,
        phase: snapshot.phase,
        tokens,
        generatedAt: this.now(),
      };
      const signature = numericSignature(event);
      this.viewModel = {
        ...this.viewModel,
        model,
        state: snapshot.phase === "streaming" ? "streaming" : "completed",
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
    } catch {
      snapshot.promptText = "";
      snapshot.responseText = "";
      this.viewModel = {
        ...this.viewModel,
        model,
        state: "measurement-paused",
        current: emptyViewModel(this.adapter.platform).current,
      };
      widget.update(this.viewModel);
    }
  }
}
