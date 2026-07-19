import type { WidgetElements } from "./widget-template";
import type { ModelProfileOption } from "../impact/model-selection";
import type { PlatformId } from "../shared/contracts";

export type WidgetTheme = "light" | "dark" | "system";
export type WidgetSide = "left" | "right";

export interface WidgetPreferences {
  theme: WidgetTheme;
  side: WidgetSide;
  collapsed: boolean;
  top: number;
}

interface WidgetControllerOptions {
  preferences?: Partial<WidgetPreferences>;
  onPreferencesChange?: (preferences: WidgetPreferences) => void;
  onModelSelectionChange?: (profileId: string | null) => void;
}

const defaultPreferences: WidgetPreferences = {
  theme: "system",
  side: "right",
  collapsed: false,
  top: 96,
};

export function clampWidgetTop(
  top: number,
  viewportHeight: number,
  collapsed: boolean,
  renderedHeight = 540,
): number {
  const minimum = 12;
  const estimatedHeight = collapsed
    ? 40
    : Math.min(renderedHeight, Math.max(160, viewportHeight - 24));
  return Math.max(minimum, Math.min(top, Math.max(minimum, viewportHeight - estimatedHeight - 12)));
}

export class WidgetController {
  private preferences: WidgetPreferences = { ...defaultPreferences };
  private onPreferencesChange: (preferences: WidgetPreferences) => void = () => undefined;
  private onModelSelectionChange: (profileId: string | null) => void = () => undefined;
  private allowedProfileIds = new Set<string>();
  private modelOptionsSignature = "";
  private readonly cleanupCallbacks: Array<() => void> = [];
  private dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;
  private reclampFrame: number | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly elements: WidgetElements,
    options: WidgetControllerOptions = {},
  ) {
    this.bindEvents();
    this.configure(options);
  }

  configure(options: WidgetControllerOptions): void {
    if (options.onPreferencesChange) this.onPreferencesChange = options.onPreferencesChange;
    if (options.onModelSelectionChange) {
      this.onModelSelectionChange = options.onModelSelectionChange;
    }
    if (options.preferences) {
      this.preferences = { ...this.preferences, ...options.preferences };
    }
    this.applyPreferences(false);
  }

  disconnect(): void {
    for (const cleanup of this.cleanupCallbacks.splice(0)) cleanup();
    if (this.reclampFrame !== null) window.cancelAnimationFrame(this.reclampFrame);
    this.reclampFrame = null;
  }

  toggleCollapsed(): void {
    this.preferences.collapsed = !this.preferences.collapsed;
    this.applyPreferences();
  }

  updateModelControl(
    platform: PlatformId,
    options: ModelProfileOption[],
    selectedProfileId: string | null,
  ): void {
    this.allowedProfileIds = new Set(options.map((option) => option.id));
    const signature = `${platform}:${options
      .map((option) => `${option.id}:${option.label}:${option.isGeneric ? "generic" : "specific"}`)
      .join("|")}`;
    if (signature !== this.modelOptionsSignature) {
      const automatic = document.createElement("option");
      automatic.value = "";
      automatic.textContent = "Détection automatique";
      const optionElements = options.map((option) => {
        const element = document.createElement("option");
        element.value = option.id;
        element.textContent = option.isGeneric
          ? `${option.label} — forte incertitude`
          : option.label;
        return element;
      });
      this.elements.modelSelect.replaceChildren(automatic, ...optionElements);
      this.modelOptionsSignature = signature;
    }
    this.elements.modelSelect.value = selectedProfileId ?? "";
  }

  private listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    target.addEventListener(type, listener);
    this.cleanupCallbacks.push(() => target.removeEventListener(type, listener));
  }

  private bindEvents(): void {
    this.listen(this.elements.themeButton, "click", () => {
      this.preferences.theme = this.resolveTheme() === "dark" ? "light" : "dark";
      this.applyPreferences();
    });
    this.listen(this.elements.collapseButton, "click", () => {
      this.preferences.collapsed = true;
      this.applyPreferences();
    });
    this.listen(this.elements.expandButton, "click", () => {
      this.preferences.collapsed = false;
      this.applyPreferences();
    });
    this.listen(this.elements.anchorLeftButton, "click", () => this.setSide("left"));
    this.listen(this.elements.anchorRightButton, "click", () => this.setSide("right"));
    this.listen(this.elements.chooseModelButton, "click", () => {
      this.elements.details.open = true;
      this.elements.modelSelect.focus();
    });
    this.listen(this.elements.modelSelect, "change", () => {
      const requestedProfileId = this.elements.modelSelect.value;
      if (requestedProfileId === "") {
        this.onModelSelectionChange(null);
        return;
      }
      if (this.allowedProfileIds.has(requestedProfileId)) {
        this.onModelSelectionChange(requestedProfileId);
      }
    });
    this.listen(this.elements.details, "toggle", () => this.scheduleReclamp());
    this.listen(this.elements.dragHandle, "pointerdown", (event) =>
      this.startDrag(event as PointerEvent),
    );
    this.listen(window, "pointermove", (event) => this.moveDrag(event as PointerEvent));
    this.listen(window, "pointerup", (event) => this.finishDrag(event as PointerEvent));
    this.listen(window, "pointercancel", (event) => this.finishDrag(event as PointerEvent));
    this.listen(window, "resize", () => this.reclamp());
    this.listen(this.host, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape" && this.dragState) {
        this.dragState = null;
        this.host.removeAttribute("data-dragging");
        this.applyPreferences(false);
      }
    });
  }

  private resolveTheme(): "light" | "dark" {
    if (this.preferences.theme !== "system") return this.preferences.theme;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private setSide(side: WidgetSide): void {
    this.preferences.side = side;
    this.host.style.removeProperty("left");
    this.host.style.removeProperty("right");
    this.applyPreferences();
  }

  private startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    const rectangle = this.host.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rectangle.left,
      offsetY: event.clientY - rectangle.top,
    };
    this.host.setAttribute("data-dragging", "");
    this.elements.dragHandle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  private moveDrag(event: PointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const width = this.preferences.collapsed ? 40 : 232;
    const left = Math.max(
      12,
      Math.min(event.clientX - this.dragState.offsetX, window.innerWidth - width - 12),
    );
    const top = clampWidgetTop(
      event.clientY - this.dragState.offsetY,
      window.innerHeight,
      this.preferences.collapsed,
    );
    this.host.style.left = `${left}px`;
    this.host.style.right = "auto";
    this.host.style.top = `${top}px`;
    this.preferences.top = top;
  }

  private finishDrag(event: PointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    this.elements.dragHandle.releasePointerCapture?.(event.pointerId);
    this.dragState = null;
    this.host.removeAttribute("data-dragging");
    this.preferences.side = event.clientX < window.innerWidth / 2 ? "left" : "right";
    this.host.style.removeProperty("left");
    this.host.style.removeProperty("right");
    this.applyPreferences();
  }

  private reclamp(): void {
    const renderedHeight = this.elements.panel.getBoundingClientRect().height;
    this.preferences.top = clampWidgetTop(
      this.preferences.top,
      window.innerHeight,
      this.preferences.collapsed,
      renderedHeight > 0 ? renderedHeight : undefined,
    );
    this.applyPreferences(false);
  }

  private scheduleReclamp(): void {
    if (this.reclampFrame !== null) window.cancelAnimationFrame(this.reclampFrame);
    this.reclampFrame = window.requestAnimationFrame(() => {
      this.reclampFrame = null;
      this.reclamp();
    });
  }

  private applyPreferences(notify = true): void {
    this.preferences.top = clampWidgetTop(
      this.preferences.top,
      window.innerHeight,
      this.preferences.collapsed,
    );
    const resolvedTheme = this.resolveTheme();
    this.host.setAttribute("data-theme", resolvedTheme);
    this.host.setAttribute("data-side", this.preferences.side);
    this.host.toggleAttribute("collapsed", this.preferences.collapsed);
    this.host.style.top = `${this.preferences.top}px`;
    this.elements.themeButton.setAttribute(
      "aria-label",
      resolvedTheme === "dark" ? "Passer au thème clair" : "Passer au thème sombre",
    );
    if (notify) this.onPreferencesChange({ ...this.preferences });
  }
}
