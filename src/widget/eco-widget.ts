import type { ImpactEstimate } from "../impact/profile-types";
import { impactRegistry } from "../impact/profile-registry";
import type { NumericAggregate } from "../storage/storage-types";
import type { PlatformId, VisibleTokenEstimate } from "../shared/contracts";
import {
  formatCarbon,
  formatCarDistance,
  formatEnergy,
  formatTelevisionTime,
  formatTokenRange,
  formatWater,
} from "./format-impact";
import { WidgetController, type WidgetPreferences } from "./widget-controller";
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

export interface WidgetViewModel {
  platform: PlatformId;
  model: string;
  state: WidgetMeasurementState;
  current: {
    tokens: VisibleTokenEstimate;
    impact: ImpactEstimate | null;
  };
  session: NumericAggregate | null;
  day: NumericAggregate | null;
}

interface WidgetConfiguration {
  preferences?: Partial<WidgetPreferences>;
  onPreferencesChange?: (preferences: WidgetPreferences) => void;
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

function summaryLabel(aggregate: NumericAggregate | null): string {
  if (!aggregate || aggregate.interactionCount === 0) return "Aucune donnée";
  const interactionLabel = aggregate.interactionCount > 1 ? "interactions" : "interaction";
  return `${aggregate.interactionCount} ${interactionLabel} · ${formatWater(aggregate.impacts.waterMl)}`;
}

export class EcoIaWidgetElement extends HTMLElement {
  private readonly elements: WidgetElements;
  private controller: WidgetController | null = null;
  private configuration: WidgetConfiguration = {};
  private previousState: WidgetMeasurementState = "initializing";
  private lastRenderAt = 0;
  private pendingRender: number | null = null;
  private pendingViewModel: WidgetViewModel | null = null;

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: "open" });
    this.elements = createWidgetTemplate(shadowRoot, widgetStyles);
  }

  connectedCallback(): void {
    this.controller ??= new WidgetController(this, this.elements, this.configuration);
  }

  disconnectedCallback(): void {
    this.controller?.disconnect();
    this.controller = null;
    if (this.pendingRender !== null) window.clearTimeout(this.pendingRender);
    this.pendingRender = null;
    this.pendingViewModel = null;
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
    const remainingDelay = 500 - (now - this.lastRenderAt);
    if (viewModel.state === "streaming" && this.lastRenderAt > 0 && remainingDelay > 0) {
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
    this.elements.model.textContent = viewModel.model || "Modèle non détecté";
    this.elements.inputTokens.textContent = formatTokenRange(viewModel.current.tokens.input);
    this.elements.outputTokens.textContent = formatTokenRange(viewModel.current.tokens.output);
    this.elements.session.textContent = summaryLabel(viewModel.session);
    this.elements.day.textContent = summaryLabel(viewModel.day);

    const impact = viewModel.current.impact;
    if (impact) {
      this.elements.water.textContent = formatWater(impact.waterMl.range);
      this.elements.car.textContent = formatCarDistance(impact.carMeters.range);
      this.elements.television.textContent = formatTelevisionTime(impact.televisionSeconds.range);
      this.elements.energy.textContent = formatEnergy(impact.energyWh.range);
      this.elements.carbon.textContent = formatCarbon(impact.carbonG.range);
      this.elements.confidence.textContent = `Énergie ${impact.energyWh.confidence} · Eau ${impact.waterMl.confidence} · Carbone ${impact.carbonG.confidence}`;
      const source = impactRegistry.sources.find(
        (candidate) => candidate.id === impact.waterMl.sourceId,
      );
      if (source) {
        this.elements.sourceLink.href = source.url;
        this.elements.sourceLink.hidden = false;
      } else {
        this.elements.sourceLink.removeAttribute("href");
        this.elements.sourceLink.hidden = true;
      }
    } else {
      for (const element of [
        this.elements.water,
        this.elements.car,
        this.elements.television,
        this.elements.energy,
        this.elements.carbon,
        this.elements.confidence,
      ]) {
        element.textContent = "—";
      }
      this.elements.sourceLink.hidden = true;
      this.elements.sourceLink.removeAttribute("href");
    }

    if (viewModel.state === "completed" && this.previousState !== "completed") {
      this.elements.live.textContent = `Réponse terminée. ${this.elements.water.textContent}, ${this.elements.car.textContent}, ${this.elements.television.textContent}.`;
    } else {
      this.elements.live.textContent = "";
    }
    this.previousState = viewModel.state;
  }
}

export function registerEcoWidget(): void {
  if (!customElements.get("eco-ia-widget")) {
    customElements.define("eco-ia-widget", EcoIaWidgetElement);
  }
}
