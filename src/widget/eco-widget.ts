import type { ImpactEstimate } from "../impact/profile-types";
import type { DataQualityDisclosure } from "../impact/impact-disclosure";
import type { ModelProfileOption, ModelResolutionSource } from "../impact/model-selection";
import type { NumericAggregate } from "../storage/storage-types";
import type { PlatformId, VisibleTokenEstimate } from "../shared/contracts";
import type { ContextTokenEstimate } from "../token/context-envelope";
import {
  formatCarbon,
  formatCarDistance,
  formatContextTokenEstimate,
  formatEnergy,
  formatTelevisionTime,
  formatTokenRange,
  formatWater,
  type FormattedEstimate,
} from "./format-impact";
import {
  type StoredWidgetPreferences,
  WidgetController,
  type WidgetPreferences,
} from "./widget-controller";
import { widgetStyles } from "./widget-styles";
import { createWidgetTemplate, type WidgetElements } from "./widget-template";

export type WidgetMeasurementState =
  | "initializing"
  | "active"
  | "streaming"
  | "completed"
  | "unknown-model"
  | "measurement-paused"
  | "unsupported";

export type ContextDiagnosticState = "absent" | "complete" | "partial";
export type ResponseDiagnosticState = "waiting" | "streaming" | "complete" | "interrupted";

export interface WidgetViewModel {
  platform: PlatformId;
  state: WidgetMeasurementState;
  modelControl: {
    detectedLabel: string;
    effectiveLabel: string;
    resolution: ModelResolutionSource;
    selectedProfileId: string | null;
    options: ModelProfileOption[];
    methodNote: string;
    warning: string | null;
    selectionError: string | null;
  };
  context: ContextTokenEstimate;
  disclosure: DataQualityDisclosure | null;
  diagnostic: {
    platform: "recognized" | "unsupported";
    conversation: "detected" | "paused";
    model: ModelResolutionSource;
    context: ContextDiagnosticState;
    response: ResponseDiagnosticState;
  };
  current: {
    tokens: VisibleTokenEstimate;
    impact: ImpactEstimate | null;
  };
  session: NumericAggregate | null;
  day: NumericAggregate | null;
}

export interface WidgetConfiguration {
  preferences?: StoredWidgetPreferences;
  onPreferencesChange?: (preferences: WidgetPreferences) => void;
  onModelSelectionChange?: (profileId: string | null) => void;
}

const stateLabels: Record<WidgetMeasurementState, string> = {
  initializing: "Initialisation…",
  active: "Mesure active",
  streaming: "Réponse en cours…",
  completed: "Réponse mesurée",
  "unknown-model": "Modèle non reconnu",
  "measurement-paused": "Mesure en pause",
  unsupported: "Plateforme non prise en charge",
};
const streamingRenderIntervalMs = 525;
const measurementConfirmationDurationMs = 900;

function summaryLabel(aggregate: NumericAggregate | null): string {
  if (!aggregate || aggregate.interactionCount === 0) return "Aucune donnée";
  const interactionLabel = aggregate.interactionCount > 1 ? "interactions" : "interaction";
  return `${aggregate.interactionCount} ${interactionLabel} · ${formatWater(aggregate.impacts.waterMl).value}`;
}

function renderEstimate(
  valueElement: HTMLElement,
  rangeElement: HTMLElement,
  estimate: FormattedEstimate,
): void {
  valueElement.textContent = estimate.value;
  rangeElement.textContent = estimate.range;
}

function replaceTextList(list: HTMLUListElement, values: string[], dataAttribute?: string): void {
  const items = values.map((value) => {
    const item = document.createElement("li");
    if (dataAttribute) item.setAttribute(dataAttribute, "");
    item.textContent = value;
    return item;
  });
  list.replaceChildren(...items);
}

const diagnosticLabels = {
  platform: { recognized: "Plateforme · Reconnue", unsupported: "Plateforme · Non reconnue" },
  conversation: { detected: "Conversation · Détectée", paused: "Conversation · Mesure en pause" },
  model: {
    automatic: "Modèle · Automatique",
    manual: "Modèle · Manuel",
    generic: "Modèle · Générique",
  },
  context: {
    absent: "Contexte · Absent",
    complete: "Contexte · Complet",
    partial: "Contexte · Partiel",
  },
  response: {
    waiting: "Réponse · En attente",
    streaming: "Réponse · En cours",
    complete: "Réponse · Terminée",
    interrupted: "Réponse · Interrompue",
  },
} as const;

class EcoIaWidgetRuntime {
  private readonly elements: WidgetElements;
  private controller: WidgetController | null = null;
  private configuration: WidgetConfiguration = {};
  private previousState: WidgetMeasurementState = "initializing";
  private hasRendered = false;
  private lastRenderAt: number | null = null;
  private pendingRender: number | null = null;
  private pendingViewModel: WidgetViewModel | null = null;
  private measurementConfirmationTimer: number | null = null;

  constructor(private readonly host: HTMLElement) {
    const shadowRoot = host.attachShadow({ mode: "open" });
    this.elements = createWidgetTemplate(shadowRoot, widgetStyles);
  }

  connect(): void {
    this.controller ??= new WidgetController(this.host, this.elements, this.configuration);
  }

  disconnect(): void {
    this.controller?.disconnect();
    this.controller = null;
    if (this.pendingRender !== null) window.clearTimeout(this.pendingRender);
    if (this.measurementConfirmationTimer !== null) {
      window.clearTimeout(this.measurementConfirmationTimer);
    }
    this.pendingRender = null;
    this.pendingViewModel = null;
    this.measurementConfirmationTimer = null;
    this.host.removeAttribute("data-fresh-measurement");
  }

  configure(configuration: WidgetConfiguration): void {
    this.configuration = {
      ...this.configuration,
      ...configuration,
      preferences: {
        ...this.configuration.preferences,
        ...configuration.preferences,
      },
    };
    this.controller?.configure(configuration);
  }

  toggleCollapsed(): void {
    this.controller?.toggleCollapsed();
  }

  update(viewModel: WidgetViewModel): void {
    const now = performance.now();
    const remainingDelay =
      this.lastRenderAt === null ? 0 : streamingRenderIntervalMs - (now - this.lastRenderAt);
    if (viewModel.state === "streaming" && this.lastRenderAt !== null && remainingDelay > 0) {
      this.pendingViewModel = viewModel;
      if (this.pendingRender === null) {
        this.pendingRender = window.setTimeout(() => {
          const pending = this.pendingViewModel;
          this.pendingRender = null;
          this.pendingViewModel = null;
          if (pending) this.render(pending);
        }, remainingDelay);
      }
      return;
    }
    if (this.pendingRender !== null) window.clearTimeout(this.pendingRender);
    this.pendingRender = null;
    this.pendingViewModel = null;
    this.render(viewModel);
  }

  private render(viewModel: WidgetViewModel): void {
    this.lastRenderAt = performance.now();
    this.elements.status.textContent = stateLabels[viewModel.state];
    this.elements.model.textContent = viewModel.modelControl.effectiveLabel;
    this.elements.detectedModel.textContent = `Détecté : ${viewModel.modelControl.detectedLabel}`;
    this.elements.modelMethodNote.textContent = viewModel.modelControl.methodNote;
    this.elements.modelWarning.hidden = viewModel.modelControl.warning === null;
    this.elements.modelWarningText.textContent = viewModel.modelControl.warning ?? "";
    this.elements.selectionError.textContent = viewModel.modelControl.selectionError ?? "";
    this.controller?.updateModelControl(
      viewModel.platform,
      viewModel.modelControl.options,
      viewModel.modelControl.selectedProfileId,
    );
    this.elements.context.hidden = !viewModel.context.hasContext;
    this.elements.context.textContent = viewModel.context.hasContext
      ? formatContextTokenEstimate(viewModel.context.tokens)
      : "";
    const partialContextExplanation =
      viewModel.context.coverage === "partial"
        ? "Contexte partiel : les tours les plus anciens ont été exclus. "
        : "";
    this.elements.contextExplanation.textContent = `${partialContextExplanation}Le fournisseur peut tronquer, résumer, mettre en cache ou enrichir ce contexte.`;
    renderEstimate(
      this.elements.inputTokens,
      this.elements.inputTokenRange,
      formatTokenRange(viewModel.current.tokens.input),
    );
    renderEstimate(
      this.elements.outputTokens,
      this.elements.outputTokenRange,
      formatTokenRange(viewModel.current.tokens.output),
    );
    this.elements.session.textContent = summaryLabel(viewModel.session);
    this.elements.day.textContent = summaryLabel(viewModel.day);

    const impact = viewModel.current.impact;
    if (impact) {
      renderEstimate(
        this.elements.water,
        this.elements.waterRange,
        formatWater(impact.waterMl.range),
      );
      renderEstimate(
        this.elements.car,
        this.elements.carRange,
        formatCarDistance(impact.carMeters.range),
      );
      renderEstimate(
        this.elements.television,
        this.elements.televisionRange,
        formatTelevisionTime(impact.televisionSeconds.range),
      );
      renderEstimate(
        this.elements.energy,
        this.elements.energyRange,
        formatEnergy(impact.energyWh.range),
      );
      renderEstimate(
        this.elements.carbon,
        this.elements.carbonRange,
        formatCarbon(impact.carbonG.range),
      );
    } else {
      for (const element of [
        this.elements.water,
        this.elements.waterRange,
        this.elements.car,
        this.elements.carRange,
        this.elements.television,
        this.elements.televisionRange,
        this.elements.energy,
        this.elements.energyRange,
        this.elements.carbon,
        this.elements.carbonRange,
      ]) {
        element.textContent = "En attente";
      }
    }

    const disclosure = viewModel.disclosure;
    if (disclosure) {
      this.elements.qualityOverall.textContent = disclosure.overallLabel;
      this.elements.qualityExplanation.textContent = disclosure.overallExplanation;
      replaceTextList(
        this.elements.qualityIndicators,
        disclosure.indicators.map(
          (indicator) => `${indicator.label} · ${indicator.grade} · ${indicator.explanation}`,
        ),
        "data-quality-indicator",
      );
      const sourceItems = disclosure.sources.map((source) => {
        const item = document.createElement("li");
        item.setAttribute("data-disclosure-source", "");
        const title = document.createElement("strong");
        title.textContent = source.title;
        const metadata = document.createElement("span");
        metadata.className = "source-meta";
        metadata.textContent = `Date : ${source.publicationDate} · Périmètre : ${source.scope} · Limite : ${source.primaryLimitation}`;
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Ouvrir la source";
        item.append(title, metadata, link);
        return item;
      });
      this.elements.sourceList.replaceChildren(...sourceItems);
      replaceTextList(this.elements.limitations, disclosure.limitations);
    } else {
      this.elements.qualityOverall.textContent = "Qualité des données · En attente";
      this.elements.qualityExplanation.textContent = "";
      this.elements.qualityIndicators.replaceChildren();
      this.elements.sourceList.replaceChildren();
      this.elements.limitations.replaceChildren();
    }

    replaceTextList(
      this.elements.diagnostics,
      [
        diagnosticLabels.platform[viewModel.diagnostic.platform],
        diagnosticLabels.conversation[viewModel.diagnostic.conversation],
        diagnosticLabels.model[viewModel.diagnostic.model],
        diagnosticLabels.context[viewModel.diagnostic.context],
        diagnosticLabels.response[viewModel.diagnostic.response],
      ],
      "data-diagnostic-row",
    );

    const isNewCompletion = viewModel.state === "completed" && this.previousState !== "completed";
    if (isNewCompletion) {
      this.elements.live.textContent = `Réponse terminée. ${this.elements.water.textContent}, ${this.elements.car.textContent}, ${this.elements.television.textContent}.`;
    } else if (viewModel.state !== "completed") {
      this.elements.live.textContent = "";
    }
    if (this.hasRendered && isNewCompletion) this.confirmNewMeasurement();
    this.hasRendered = true;
    this.previousState = viewModel.state;
  }

  private confirmNewMeasurement(): void {
    if (this.measurementConfirmationTimer !== null) {
      window.clearTimeout(this.measurementConfirmationTimer);
    }
    this.host.setAttribute("data-fresh-measurement", "");
    this.measurementConfirmationTimer = window.setTimeout(() => {
      this.host.removeAttribute("data-fresh-measurement");
      this.measurementConfirmationTimer = null;
    }, measurementConfirmationDurationMs);
  }
}

export interface EcoIaWidgetHost extends HTMLElement {
  configure(configuration: WidgetConfiguration): void;
  update(viewModel: WidgetViewModel): void;
  toggleCollapsed(): void;
  disconnectEcoIaWidget(): void;
}

export class EcoIaWidgetElement extends HTMLElement implements EcoIaWidgetHost {
  private readonly runtime = new EcoIaWidgetRuntime(this);

  connectedCallback(): void {
    this.runtime.connect();
  }

  disconnectedCallback(): void {
    this.runtime.disconnect();
  }

  configure(configuration: WidgetConfiguration): void {
    this.runtime.configure(configuration);
  }

  update(viewModel: WidgetViewModel): void {
    this.runtime.update(viewModel);
  }

  toggleCollapsed(): void {
    this.runtime.toggleCollapsed();
  }

  disconnectEcoIaWidget(): void {
    this.runtime.disconnect();
  }
}

export function registerEcoWidget(): boolean {
  const registry = globalThis.customElements as CustomElementRegistry | null;
  if (!registry) return false;
  if (!registry.get("eco-ia-widget")) {
    registry.define("eco-ia-widget", EcoIaWidgetElement);
  }
  return true;
}

export function createEcoWidget(documentRoot: Document = document): EcoIaWidgetHost {
  if (registerEcoWidget()) {
    return documentRoot.createElement("eco-ia-widget") as EcoIaWidgetElement;
  }

  const host = documentRoot.createElement("eco-ia-widget") as EcoIaWidgetHost;
  const runtime = new EcoIaWidgetRuntime(host);
  host.configure = (configuration) => runtime.configure(configuration);
  host.update = (viewModel) => runtime.update(viewModel);
  host.toggleCollapsed = () => runtime.toggleCollapsed();
  host.disconnectEcoIaWidget = () => runtime.disconnect();
  runtime.connect();
  return host;
}
