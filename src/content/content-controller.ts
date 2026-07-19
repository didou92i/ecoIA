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
import { isDayAggregate, isSessionAggregate } from "../storage/aggregate-store";
import type { NumericAggregate } from "../storage/storage-types";
import { createInputEnvelope, type ContextTokenEstimate } from "../token/context-envelope";
import { estimateVisibleTokens, type TokenizerFamily } from "../token/token-estimator";
import type { WidgetPreferences } from "../widget/widget-controller";
import type { WidgetConfiguration, WidgetViewModel } from "../widget/eco-widget";
import { conversationChanged, createEphemeralSessionId } from "./page-lifecycle";

const preferencesStorageKey = "ecoia.preferences.v1";
const dayStorageKey = "ecoia.day.v1";
const maximumObservedRootAncestors = 32;
const rootDiscoveryDelayMs = 500;

interface TurnState {
  eventId: string;
  sequence: number;
  pendingSignature: string | null;
  acknowledgedSignature: string | null;
  displayOnly: boolean;
  phase: VisibleTurnSnapshot["phase"];
  promptFingerprint: string;
  responseFingerprint: string;
  responseLength: number;
}

interface BaselinePending {
  reason: "initial" | "conversation-change";
  previousTurnElement: Element | null;
  observedEmpty: boolean;
  markerWhenEmpty: string | null;
}

interface BaselineTurn {
  turnElement: Element;
  terminalObserved: boolean;
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

type AggregateResponse =
  | {
      ok: true;
      status: "accepted";
      session: NumericAggregate | null;
      day: NumericAggregate | null;
    }
  | {
      ok: true;
      status: "ignored";
      reason: "DUPLICATE_OR_OUT_OF_ORDER";
      session: NumericAggregate | null;
      day: NumericAggregate | null;
    };

function tokenizerFamily(platform: PlatformId): TokenizerFamily {
  if (platform === "chatgpt") return "openai";
  if (platform === "perplexity") return "generic";
  return platform;
}

function emptyMeasurement(): Pick<WidgetViewModel, "context" | "current" | "disclosure"> {
  const zero = createRange(0, 0, 0);
  return {
    context: { tokens: zero, coverage: "none", hasContext: false },
    current: {
      tokens: { input: zero, output: zero, source: "estimated" },
      impact: null,
    },
    disclosure: null,
  };
}

function emptyViewModel(platform: PlatformId): WidgetViewModel {
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
    ...emptyMeasurement(),
    diagnostic: {
      platform: "recognized",
      conversation: "detected",
      model: resolution.source,
      context: "absent",
      response: "waiting",
    },
    session: null,
    day: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function parseAggregateResponse(value: unknown): AggregateResponse | null {
  if (!isRecord(value) || value.ok !== true) return null;
  const session = value.session === null ? null : value.session;
  const day = value.day === null ? null : value.day;
  if (
    (session !== null && !isSessionAggregate(session)) ||
    (day !== null && !isDayAggregate(day))
  ) {
    return null;
  }
  if (value.status === "accepted" && hasExactKeys(value, ["ok", "status", "session", "day"])) {
    return { ok: true, status: "accepted", session, day };
  }
  if (
    value.status === "ignored" &&
    value.reason === "DUPLICATE_OR_OUT_OF_ORDER" &&
    hasExactKeys(value, ["ok", "status", "reason", "session", "day"])
  ) {
    return {
      ok: true,
      status: "ignored",
      reason: "DUPLICATE_OR_OUT_OF_ORDER",
      session,
      day,
    };
  }
  return null;
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

function ephemeralTextFingerprint(text: string, salt: string): string {
  const hashes: [number, number, number, number] = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  const update = (fragment: string): void => {
    for (let index = 0; index < fragment.length; index += 1) {
      const code = fragment.charCodeAt(index);
      hashes[0] = Math.imul(hashes[0] ^ code, 0x01000193);
      hashes[1] = Math.imul(hashes[1] ^ code, 0x27d4eb2d);
      hashes[2] = Math.imul(hashes[2] ^ code, 0x165667b1);
      hashes[3] = Math.imul(hashes[3] ^ code, 0x9e3779b1);
    }
  };
  update(salt);
  update("\0");
  update(text);
  return hashes.map((hash) => (hash >>> 0).toString(16).padStart(8, "0")).join("");
}

function localCalendarDate(timestamp: number): string | null {
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.valueOf())) return null;
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  private rootLifecycleObserver: MutationObserver | null = null;
  private rootLifecycleTimer: number | null = null;
  private observedRoot: HTMLElement | null = null;
  private tabSessionId: string;
  private readonly fingerprintSalt: string;
  private conversationMarker: string | null = null;
  private turnStates = new WeakMap<Element, TurnState>();
  private manualProfileId: string | null = null;
  private contextEstimates = new WeakMap<Element, ContextTokenEstimate>();
  private selectionError: string | null = null;
  private viewModel: WidgetViewModel;
  private refreshQueue: Promise<void> = Promise.resolve();
  private baselinePending: BaselinePending | null = {
    reason: "initial",
    previousTurnElement: null,
    observedEmpty: false,
    markerWhenEmpty: null,
  };
  private baselineTurn: BaselineTurn | null = null;
  private lastObservedTurnElement: Element | null = null;

  constructor(options: ContentControllerOptions) {
    this.document = options.document;
    this.adapter = options.adapter;
    this.api = options.api;
    this.createWidget = options.createWidget;
    this.randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
    this.now = options.now ?? Date.now;
    this.tabSessionId = createEphemeralSessionId(this.randomUUID);
    this.fingerprintSalt = this.tabSessionId;
    this.viewModel = emptyViewModel(this.adapter.platform);
  }

  async start(): Promise<void> {
    if (this.widget) return;
    this.widget = this.createWidget();
    const stored = await this.api.storage.local.get([preferencesStorageKey, dayStorageKey]);
    const preferences = stored[preferencesStorageKey];
    const storedDay = stored[dayStorageKey];
    const currentLocalDate = localCalendarDate(this.now());
    if (isDayAggregate(storedDay) && storedDay.localDate === currentLocalDate) {
      this.viewModel = { ...this.viewModel, day: storedDay };
    }
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
      this.watchForRootAvailability();
      this.pauseMeasurement();
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
    this.disconnectRootLifecycleObserver();
    this.observedRoot = null;
    this.pauseMeasurement();
  }

  private pauseMeasurement(): void {
    this.viewModel = {
      ...this.viewModel,
      state: "measurement-paused",
      ...emptyMeasurement(),
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
    this.disconnectRootLifecycleObserver();
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
    this.watchRootPresence(root);
  }

  private disconnectRootLifecycleObserver(): void {
    if (this.rootLifecycleTimer !== null) {
      this.document.defaultView?.clearTimeout(this.rootLifecycleTimer);
      this.rootLifecycleTimer = null;
    }
    this.rootLifecycleObserver?.disconnect();
    this.rootLifecycleObserver = null;
  }

  private watchForRootAvailability(): void {
    this.disconnectRootLifecycleObserver();
    const Observer = this.document.defaultView?.MutationObserver;
    const target = this.document.documentElement;
    if (!Observer || !target) return;
    const observer = new Observer(() => {
      if (this.rootLifecycleObserver !== observer || !this.widget) return;
      if (this.rootLifecycleTimer !== null) return;
      const window = this.document.defaultView;
      if (!window) return;
      this.rootLifecycleTimer = window.setTimeout(() => {
        this.rootLifecycleTimer = null;
        if (this.rootLifecycleObserver !== observer || !this.widget) return;
        if (!this.adapter.findConversationRoot(this.document)) return;
        this.disconnectRootLifecycleObserver();
        void this.refresh();
      }, rootDiscoveryDelayMs);
    });
    this.rootLifecycleObserver = observer;
    observer.observe(target, { childList: true, subtree: true });
  }

  private watchRootPresence(root: HTMLElement): void {
    this.disconnectRootLifecycleObserver();
    const Observer = this.document.defaultView?.MutationObserver;
    const observedAncestors = this.rootAncestors(root);
    if (!Observer || observedAncestors.length === 0) return;
    const observer = new Observer(() => {
      if (this.rootLifecycleObserver !== observer || !this.widget) return;
      if (root.isConnected && this.adapter.findConversationRoot(this.document) === root) {
        const currentAncestors = this.rootAncestors(root);
        if (
          currentAncestors.length === observedAncestors.length &&
          currentAncestors.every((ancestor, index) => ancestor === observedAncestors[index])
        ) {
          return;
        }
        this.watchRootPresence(root);
        return;
      }
      this.disconnectRootLifecycleObserver();
      void this.refresh();
    });
    this.rootLifecycleObserver = observer;
    for (const ancestor of observedAncestors) {
      observer.observe(ancestor, { childList: true });
    }
  }

  private rootAncestors(root: HTMLElement): Node[] {
    const ancestors: Node[] = [];
    let ancestor: Node | null = root.parentNode;
    while (ancestor && ancestors.length < maximumObservedRootAncestors) {
      ancestors.push(ancestor);
      if (ancestor === this.document.documentElement) break;
      ancestor = ancestor.parentNode;
    }
    return ancestors;
  }

  private async resetConversation(
    nextMarker: string | null,
    previousTurnElement: Element | null,
  ): Promise<void> {
    const previousSessionId = this.tabSessionId;
    this.manualProfileId = null;
    this.selectionError = null;
    this.contextEstimates = new WeakMap<Element, ContextTokenEstimate>();
    this.turnStates = new WeakMap<Element, TurnState>();
    this.baselinePending = {
      reason: "conversation-change",
      previousTurnElement,
      observedEmpty: false,
      markerWhenEmpty: null,
    };
    this.baselineTurn = null;
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
      this.watchForRootAvailability();
      this.pauseMeasurement();
      return;
    }
    this.subscribeToRoot(root);
    const nextMarker = this.adapter.getConversationMarker(this.document);
    const markerHasChanged = conversationChanged(this.conversationMarker, nextMarker);
    const turnBeforeReset = this.lastObservedTurnElement;
    if (markerHasChanged) {
      await this.resetConversation(nextMarker, turnBeforeReset);
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
      if (this.baselinePending && !this.baselinePending.observedEmpty) {
        this.baselinePending.observedEmpty = true;
        this.baselinePending.markerWhenEmpty = this.conversationMarker;
      }
      this.viewModel = {
        ...this.viewModel,
        state: "active",
        modelControl: this.createModelControl(resolution),
        ...emptyMeasurement(),
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
    const baselineSnapshot = this.isBaselineSnapshot(root, snapshot);
    await this.processSnapshot(root, snapshot, detected, widget, baselineSnapshot);
    this.lastObservedTurnElement = snapshot.turnElement;
  }

  private isBaselineSnapshot(root: HTMLElement, snapshot: VisibleTurnSnapshot): boolean {
    const pending = this.baselinePending;
    if (pending) {
      if (
        pending.reason === "conversation-change" &&
        snapshot.turnElement === pending.previousTurnElement
      ) {
        return true;
      }
      if (
        pending.observedEmpty &&
        snapshot.phase === "streaming" &&
        (pending.reason === "conversation-change" || pending.markerWhenEmpty === null)
      ) {
        this.baselinePending = null;
        this.baselineTurn = null;
        return false;
      }
      this.baselinePending = null;
      this.baselineTurn = {
        turnElement: snapshot.turnElement,
        terminalObserved: snapshot.phase !== "streaming",
      };
      return true;
    }

    const baseline = this.baselineTurn;
    if (!baseline) return false;
    if (snapshot.turnElement === baseline.turnElement) {
      if (snapshot.phase !== "streaming") baseline.terminalObserved = true;
      return true;
    }
    if (baseline.terminalObserved && snapshot.phase === "streaming") {
      this.baselineTurn = null;
      return false;
    }
    if (!baseline.terminalObserved || !root.contains(baseline.turnElement)) {
      this.baselineTurn = {
        turnElement: snapshot.turnElement,
        terminalObserved: snapshot.phase !== "streaming",
      };
      return true;
    }
    this.baselineTurn = null;
    return false;
  }

  private replacedTurnState(
    root: HTMLElement,
    snapshot: VisibleTurnSnapshot,
  ): TurnState | undefined {
    const previousTurnElement = this.lastObservedTurnElement;
    if (
      !previousTurnElement ||
      previousTurnElement === snapshot.turnElement ||
      root.contains(previousTurnElement)
    ) {
      return undefined;
    }
    return this.turnStates.get(previousTurnElement);
  }

  private createModelControl(resolution: ModelResolution): WidgetViewModel["modelControl"] {
    return {
      detectedLabel: resolution.detectedLabel,
      effectiveLabel: resolution.effectiveLabel,
      resolution: resolution.source,
      selectedProfileId: this.manualProfileId,
      options: getModelProfileOptions(this.adapter.platform),
      warning:
        resolution.source !== "generic"
          ? null
          : resolution.modelObserved
            ? "Aucun profil documenté pour ce modèle — profil générique utilisé"
            : "Modèle non communiqué — profil générique utilisé",
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
    baselineSnapshot: boolean,
  ): Promise<void> {
    try {
      const family = tokenizerFamily(this.adapter.platform);
      const prompt = estimateVisibleTokens(snapshot.promptText, family);
      const output = estimateVisibleTokens(snapshot.responseText, family);
      const promptFingerprint = ephemeralTextFingerprint(snapshot.promptText, this.fingerprintSalt);
      const responseFingerprint = ephemeralTextFingerprint(
        snapshot.responseText,
        this.fingerprintSalt,
      );
      const responseLength = snapshot.responseText.length;
      const context = this.readContextEstimate(root, snapshot.turnElement, family);
      const input = createInputEnvelope(prompt, context);
      const resolution = resolveModelProfile({
        platform: this.adapter.platform,
        detected,
        manualProfileId: this.manualProfileId,
      });
      const tokens = { input, output, source: "estimated" as const };
      const impact = estimateImpact(resolution.profileId, tokens);
      const disclosure = buildImpactDisclosure(impact, this.adapter.platform);
      const directState = this.turnStates.get(snapshot.turnElement);
      const replacementState = directState ? undefined : this.replacedTurnState(root, snapshot);
      const signature = numericSignature({
        version: 1,
        eventId: directState?.eventId ?? replacementState?.eventId ?? this.tabSessionId,
        tabSessionId: this.tabSessionId,
        sequence: 0,
        platform: this.adapter.platform,
        modelProfileId: resolution.profileId,
        phase: snapshot.phase,
        tokens,
        generatedAt: this.now(),
      });
      const previousState =
        directState ??
        (replacementState &&
        replacementState.promptFingerprint === promptFingerprint &&
        (replacementState.phase === "streaming" ||
          (snapshot.phase !== "streaming" &&
            (replacementState.responseFingerprint === responseFingerprint ||
              (responseLength >= replacementState.responseLength &&
                ephemeralTextFingerprint(
                  snapshot.responseText.slice(0, replacementState.responseLength),
                  this.fingerprintSalt,
                ) === replacementState.responseFingerprint))))
          ? replacementState
          : undefined);
      snapshot.promptText = "";
      snapshot.responseText = "";
      const eventIdentity = previousState?.eventId ?? createEphemeralSessionId(this.randomUUID);
      const sequence =
        previousState?.pendingSignature === signature
          ? previousState.sequence
          : (previousState?.sequence ?? 0) + 1;
      const event: NumericInteractionEvent = {
        version: 1,
        eventId: eventIdentity,
        tabSessionId: this.tabSessionId,
        sequence,
        platform: this.adapter.platform,
        modelProfileId: resolution.profileId,
        phase: snapshot.phase,
        tokens,
        generatedAt: this.now(),
      };
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
      if (baselineSnapshot || previousState?.displayOnly) {
        this.turnStates.set(snapshot.turnElement, {
          eventId: eventIdentity,
          sequence: previousState?.sequence ?? 0,
          pendingSignature: null,
          acknowledgedSignature: previousState?.acknowledgedSignature ?? null,
          displayOnly: true,
          phase: snapshot.phase,
          promptFingerprint,
          responseFingerprint,
          responseLength,
        });
        return;
      }
      if (previousState?.acknowledgedSignature === signature) {
        if (!directState) {
          this.turnStates.set(snapshot.turnElement, {
            ...previousState,
            phase: snapshot.phase,
            promptFingerprint,
            responseFingerprint,
            responseLength,
          });
        }
        return;
      }
      this.turnStates.set(snapshot.turnElement, {
        eventId: event.eventId,
        sequence,
        pendingSignature: signature,
        acknowledgedSignature: previousState?.acknowledgedSignature ?? null,
        displayOnly: false,
        phase: snapshot.phase,
        promptFingerprint,
        responseFingerprint,
        responseLength,
      });
      const response = parseAggregateResponse(await this.api.runtime.sendMessage(event));
      if (response) {
        this.turnStates.set(snapshot.turnElement, {
          eventId: event.eventId,
          sequence,
          pendingSignature: null,
          acknowledgedSignature: signature,
          displayOnly: false,
          phase: snapshot.phase,
          promptFingerprint,
          responseFingerprint,
          responseLength,
        });
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
