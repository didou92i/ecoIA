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
  type FormattedEstimate,
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
const streamingRenderIntervalMs = 525;

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

class EcoIaWidgetRuntime {
  private readonly elements: WidgetElements;
  private controller: WidgetController | null = null;
  private configuration: WidgetConfiguration = {};
  private previousState: WidgetMeasurementState = "initializing";
  private lastRenderAt = 0;
  private pendingRender: number | null = null;
  private pendingViewModel: WidgetViewModel | null = null;

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
    const remainingDelay = streamingRenderIntervalMs - (now - this.lastRenderAt);
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
    this.elements.model.textContent = viewModel.model || "Modèle non communiqué";
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
        this.elements.waterRange,
        this.elements.car,
        this.elements.carRange,
        this.elements.television,
        this.elements.televisionRange,
        this.elements.energy,
        this.elements.energyRange,
        this.elements.carbon,
        this.elements.carbonRange,
        this.elements.confidence,
      ]) {
        element.textContent = "En attente";
      }
      this.elements.sourceLink.hidden = true;
      this.elements.sourceLink.removeAttribute("href");
    }

    if (viewModel.state === "completed" && this.previousState !== "completed") {
      this.elements.live.textContent = `Réponse terminée. ${this.elements.water.textContent}, ${this.elements.car.textContent}, ${this.elements.television.textContent}.`;
    } else if (viewModel.state !== "completed") {
      this.elements.live.textContent = "";
    }
    this.previousState = viewModel.state;
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
