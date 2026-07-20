import type { WidgetElements } from "./widget-template";
import type { ModelProfileOption } from "../impact/model-selection";
import type { PlatformId } from "../shared/contracts";

export type WidgetTheme = "light" | "dark" | "system";
export type WidgetSide = "left" | "right";

export interface WidgetPreferences {
  theme: WidgetTheme;
  collapsed: boolean;
  left: number;
  top: number;
}

export interface StoredWidgetPreferences extends Partial<WidgetPreferences> {
  side?: WidgetSide;
}

interface WidgetControllerOptions {
  preferences?: StoredWidgetPreferences;
  consentGranted?: boolean;
  onPreferencesChange?: (preferences: WidgetPreferences) => void;
  onModelSelectionChange?: (profileId: string | null) => void;
  onConsentChange?: (granted: boolean) => void;
}

const defaultPreferences: WidgetPreferences = {
  theme: "system",
  collapsed: false,
  left: 12,
  top: 96,
};
const viewportMargin = 12;
const collapsedWidgetSize = 36;
const expandedWidgetWidth = 195;
const expandedWidgetMaxHeight = 480;

export function clampWidgetPosition(
  left: number,
  top: number,
  viewportWidth: number,
  viewportHeight: number,
  renderedWidth: number,
  renderedHeight: number,
): { left: number; top: number } {
  return {
    left: Math.max(
      viewportMargin,
      Math.min(left, Math.max(viewportMargin, viewportWidth - renderedWidth - viewportMargin)),
    ),
    top: Math.max(
      viewportMargin,
      Math.min(top, Math.max(viewportMargin, viewportHeight - renderedHeight - viewportMargin)),
    ),
  };
}

export function clampWidgetTop(
  top: number,
  viewportHeight: number,
  collapsed: boolean,
  renderedHeight = expandedWidgetMaxHeight,
): number {
  const minimum = viewportMargin;
  const estimatedHeight = collapsed
    ? collapsedWidgetSize
    : Math.min(renderedHeight, Math.max(160, viewportHeight - viewportMargin * 2));
  return Math.max(minimum, Math.min(top, Math.max(minimum, viewportHeight - estimatedHeight - 12)));
}

export class WidgetController {
  private preferences: WidgetPreferences = { ...defaultPreferences };
  private onPreferencesChange: (preferences: WidgetPreferences) => void = () => undefined;
  private onModelSelectionChange: (profileId: string | null) => void = () => undefined;
  private onConsentChange: (granted: boolean) => void = () => undefined;
  private consentGranted = false;
  private allowedProfileIds = new Set<string>();
  private lastValidSelectedProfileId: string | null = null;
  private modelOptionsSignature = "";
  private readonly cleanupCallbacks: Array<() => void> = [];
  private dragState: {
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startLeft: number;
    startTop: number;
  } | null = null;
  private reclampFrame: number | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly elements: WidgetElements,
    options: WidgetControllerOptions = {},
  ) {
    this.preferences.left = this.defaultLeft("right");
    this.bindEvents();
    this.configure(options);
  }

  configure(options: WidgetControllerOptions): void {
    if (options.onPreferencesChange) this.onPreferencesChange = options.onPreferencesChange;
    if (options.onModelSelectionChange) {
      this.onModelSelectionChange = options.onModelSelectionChange;
    }
    if (options.onConsentChange) this.onConsentChange = options.onConsentChange;
    if (typeof options.consentGranted === "boolean") {
      this.consentGranted = options.consentGranted;
    }
    if (options.preferences) {
      const preferences = options.preferences;
      if (preferences.theme && ["light", "dark", "system"].includes(preferences.theme)) {
        this.preferences.theme = preferences.theme;
      }
      if (typeof preferences.collapsed === "boolean") {
        this.preferences.collapsed = preferences.collapsed;
      }
      if (typeof preferences.top === "number" && Number.isFinite(preferences.top)) {
        this.preferences.top = preferences.top;
      }
      if (typeof preferences.left === "number" && Number.isFinite(preferences.left)) {
        this.preferences.left = preferences.left;
      } else if (preferences.side === "left" || preferences.side === "right") {
        this.preferences.left = this.defaultLeft(preferences.side);
      }
    }
    this.applyPreferences(false);
    this.renderConsent();
  }

  disconnect(): void {
    for (const cleanup of this.cleanupCallbacks.splice(0)) cleanup();
    if (this.reclampFrame !== null) window.cancelAnimationFrame(this.reclampFrame);
    this.reclampFrame = null;
  }

  toggleCollapsed(): void {
    this.preferences.collapsed = !this.preferences.collapsed;
    this.applyPreferences();
    this.scheduleReclamp();
  }

  setConsentGranted(granted: boolean): void {
    this.consentGranted = granted;
    this.renderConsent();
    this.scheduleReclamp();
  }

  updateModelControl(
    platform: PlatformId,
    options: ModelProfileOption[],
    selectedProfileId: string | null,
  ): void {
    this.allowedProfileIds = new Set(options.map((option) => option.id));
    this.lastValidSelectedProfileId = selectedProfileId;
    const signature = `${platform}:${options
      .map(
        (option) =>
          `${option.id}:${option.label}:${option.impactProfileId}:${option.isGeneric ? "generic" : option.isProxy ? "proxy" : "specific"}`,
      )
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
          : option.isProxy
            ? `${option.label} — proxy D`
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
    this.listen(this.elements.consentAcceptButton, "click", () => {
      this.onConsentChange(true);
    });
    this.listen(this.elements.consentDeclineButton, "click", () => {
      this.onConsentChange(false);
      this.preferences.collapsed = true;
      this.applyPreferences();
      this.scheduleReclamp();
      this.elements.expandButton.focus();
    });
    this.listen(this.elements.consentRevokeButton, "click", () => {
      this.onConsentChange(false);
    });
    this.listen(this.elements.themeButton, "click", () => {
      this.preferences.theme = this.resolveTheme() === "dark" ? "light" : "dark";
      this.applyPreferences();
    });
    this.listen(this.elements.collapseButton, "click", () => {
      this.preferences.collapsed = true;
      this.applyPreferences();
      this.scheduleReclamp();
      this.elements.expandButton.focus();
    });
    this.listen(this.elements.expandButton, "click", () => {
      this.preferences.collapsed = false;
      this.applyPreferences();
      this.scheduleReclamp();
      this.elements.collapseButton.focus();
    });
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
        this.lastValidSelectedProfileId = requestedProfileId;
        this.onModelSelectionChange(requestedProfileId);
        return;
      }
      this.elements.modelSelect.value = this.lastValidSelectedProfileId ?? "";
    });
    this.listen(this.elements.details, "toggle", () => this.scheduleReclamp());
    this.listen(this.elements.dragHandle, "pointerdown", (event) =>
      this.startDrag(event as PointerEvent),
    );
    this.listen(this.elements.dragHandle, "keydown", (event) =>
      this.moveWithKeyboard(event as KeyboardEvent),
    );
    this.listen(window, "pointermove", (event) => this.moveDrag(event as PointerEvent));
    this.listen(window, "pointerup", (event) => this.finishDrag(event as PointerEvent));
    this.listen(window, "pointercancel", (event) => this.finishDrag(event as PointerEvent));
    this.listen(window, "resize", () => this.reclamp());
    this.listen(this.host, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape" && this.dragState) {
        this.preferences.left = this.dragState.startLeft;
        this.preferences.top = this.dragState.startTop;
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

  private renderConsent(): void {
    this.host.toggleAttribute("data-consent-required", !this.consentGranted);
    this.elements.consent.hidden = this.consentGranted;
    this.elements.measurementBody.hidden = !this.consentGranted;
    this.elements.consentRevokeButton.hidden = !this.consentGranted;
  }

  private startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    const rectangle = this.host.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rectangle.left,
      offsetY: event.clientY - rectangle.top,
      startLeft: this.preferences.left,
      startTop: this.preferences.top,
    };
    this.host.setAttribute("data-dragging", "");
    this.elements.dragHandle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  private moveDrag(event: PointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const dimensions = this.renderedDimensions();
    const position = clampWidgetPosition(
      event.clientX - this.dragState.offsetX,
      event.clientY - this.dragState.offsetY,
      window.innerWidth,
      window.innerHeight,
      dimensions.width,
      dimensions.height,
    );
    this.preferences.left = position.left;
    this.preferences.top = position.top;
    this.renderPosition();
  }

  private finishDrag(event: PointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    this.elements.dragHandle.releasePointerCapture?.(event.pointerId);
    this.dragState = null;
    this.host.removeAttribute("data-dragging");
    this.applyPreferences();
  }

  private reclamp(): void {
    const dimensions = this.renderedDimensions();
    const position = clampWidgetPosition(
      this.preferences.left,
      this.preferences.top,
      window.innerWidth,
      window.innerHeight,
      dimensions.width,
      dimensions.height,
    );
    this.preferences.left = position.left;
    this.preferences.top = position.top;
    this.renderPosition();
  }

  private scheduleReclamp(): void {
    if (this.reclampFrame !== null) window.cancelAnimationFrame(this.reclampFrame);
    this.reclampFrame = window.requestAnimationFrame(() => {
      this.reclampFrame = null;
      this.reclamp();
    });
  }

  private applyPreferences(notify = true): void {
    const resolvedTheme = this.resolveTheme();
    this.host.setAttribute("data-theme", resolvedTheme);
    this.host.removeAttribute("data-side");
    this.host.toggleAttribute("collapsed", this.preferences.collapsed);
    const dimensions = this.renderedDimensions();
    const position = clampWidgetPosition(
      this.preferences.left,
      this.preferences.top,
      window.innerWidth,
      window.innerHeight,
      dimensions.width,
      dimensions.height,
    );
    this.preferences.left = position.left;
    this.preferences.top = position.top;
    this.renderPosition();
    this.elements.themeButton.setAttribute(
      "aria-label",
      resolvedTheme === "dark" ? "Passer au thème clair" : "Passer au thème sombre",
    );
    if (notify) this.onPreferencesChange({ ...this.preferences });
  }

  private defaultLeft(side: WidgetSide): number {
    if (side === "left") return viewportMargin;
    const width = this.preferences.collapsed ? collapsedWidgetSize : expandedWidgetWidth;
    return Math.max(viewportMargin, window.innerWidth - width - viewportMargin);
  }

  private renderedDimensions(): { width: number; height: number } {
    if (this.preferences.collapsed) {
      return { width: collapsedWidgetSize, height: collapsedWidgetSize };
    }
    const rectangle = this.elements.panel.getBoundingClientRect();
    return {
      width: rectangle.width > 0 ? rectangle.width : expandedWidgetWidth,
      height:
        rectangle.height > 0
          ? rectangle.height
          : Math.min(expandedWidgetMaxHeight, Math.max(0, window.innerHeight - viewportMargin * 2)),
    };
  }

  private renderPosition(): void {
    this.host.style.left = `${this.preferences.left}px`;
    this.host.style.right = "auto";
    this.host.style.top = `${this.preferences.top}px`;
  }

  private moveWithKeyboard(event: KeyboardEvent): void {
    const directions: Record<string, { left: number; top: number }> = {
      ArrowLeft: { left: -1, top: 0 },
      ArrowRight: { left: 1, top: 0 },
      ArrowUp: { left: 0, top: -1 },
      ArrowDown: { left: 0, top: 1 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 1 : 10;
    const dimensions = this.renderedDimensions();
    const position = clampWidgetPosition(
      this.preferences.left + direction.left * step,
      this.preferences.top + direction.top * step,
      window.innerWidth,
      window.innerHeight,
      dimensions.width,
      dimensions.height,
    );
    this.preferences.left = position.left;
    this.preferences.top = position.top;
    this.applyPreferences();
  }
}
