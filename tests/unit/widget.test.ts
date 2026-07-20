// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataQualityDisclosure } from "../../src/impact/impact-disclosure";
import type { ImpactEstimate } from "../../src/impact/profile-types";
import { createRange } from "../../src/shared/range";
import {
  createEcoWidget,
  registerEcoWidget,
  type EcoIaWidgetHost,
  type WidgetViewModel,
} from "../../src/widget/eco-widget";
import { clampWidgetPosition, clampWidgetTop } from "../../src/widget/widget-controller";

const impactIndicator = {
  range: createRange(1, 2, 3),
  confidence: "C" as const,
  sourceProfileId: "test-profile",
  sourceId: "test-source",
};

const impact: ImpactEstimate = {
  energyWh: impactIndicator,
  waterMl: impactIndicator,
  carbonG: impactIndicator,
  televisionSeconds: impactIndicator,
  carMeters: impactIndicator,
  profileId: "test-profile",
  methodologyVersion: "test-methodology",
};

const disclosure: DataQualityDisclosure = {
  overallGrade: "D",
  overallLabel: "Qualité des données · D",
  overallExplanation: "D — proxy générique avec forte incertitude",
  indicators: [
    {
      key: "energy",
      label: "Électricité",
      grade: "B",
      explanation: "B — donnée publiée avec adaptation limitée",
      sourceId: "source-shared",
    },
    {
      key: "water",
      label: "Eau",
      grade: "C",
      explanation: "C — estimation modélisée à partir de données publiées",
      sourceId: "source-shared",
    },
    {
      key: "carbon",
      label: "Carbone",
      grade: "D",
      explanation: "D — proxy générique avec forte incertitude",
      sourceId: "source-carbon",
    },
  ],
  sources: [
    {
      id: "source-shared",
      title: "Étude eau et énergie",
      url: "https://example.test/shared",
      publicationDate: "2025-01-02",
      scope: "Inférence en centre de données",
      primaryLimitation: "Matériel non détaillé",
    },
    {
      id: "source-carbon",
      title: "Étude carbone",
      url: "https://example.test/carbon",
      publicationDate: "2024-05-06",
      scope: "Mix électrique européen",
      primaryLimitation: "Variations régionales",
    },
  ],
  limitations: ["Estimation par proxy", "Contexte fournisseur inconnu"],
};

const viewModel: WidgetViewModel = {
  platform: "chatgpt",
  state: "completed",
  modelControl: {
    detectedLabel: "Instantanée",
    effectiveLabel: "GPT-5.5 Instant · proxy D",
    resolution: "manual",
    selectedProfileId: "chatgpt-gpt-5-5-instant",
    options: [
      {
        id: "chatgpt-gpt-5-5-instant",
        label: "GPT-5.5 Instant",
        isGeneric: false,
        isProxy: true,
        impactProfileId: "openai-generic-v1",
      },
      {
        id: "chatgpt-gpt-5-6-sol",
        label: "GPT-5.6 Sol",
        isGeneric: false,
        isProxy: true,
        impactProfileId: "openai-generic-v1",
      },
      {
        id: "openai-generic-v1",
        label: "OpenAI générique",
        isGeneric: true,
        isProxy: true,
        impactProfileId: "openai-generic-v1",
      },
    ],
    methodNote:
      "Aucune donnée environnementale propre à GPT-5.5 Instant. Calcul via le proxy OpenAI générique, qualité D.",
    warning: null,
    selectionError: null,
  },
  context: {
    tokens: createRange(120, 180, 240),
    coverage: "partial",
    hasContext: true,
  },
  disclosure,
  diagnostic: {
    platform: "recognized",
    conversation: "detected",
    model: "manual",
    context: "partial",
    response: "complete",
  },
  current: {
    tokens: {
      input: createRange(90, 100, 110),
      output: createRange(180, 200, 220),
      source: "estimated",
    },
    impact,
  },
  session: null,
  day: null,
};

function createWidget() {
  registerEcoWidget();
  const widget = document.createElement("eco-ia-widget") as EcoIaWidgetHost;
  document.body.append(widget);
  return widget;
}

describe("ecoIA widget", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("recalcule la position haute avec la hauteur réellement rendue des détails", () => {
    expect(clampWidgetTop(96, 720, false, 696)).toBe(12);
  });

  it("limite indépendamment la position libre sur les deux axes", () => {
    expect(clampWidgetPosition(420, 300, 900, 700, 195, 480)).toEqual({
      left: 420,
      top: 208,
    });
    expect(clampWidgetPosition(-20, -30, 900, 700, 195, 480)).toEqual({
      left: 12,
      top: 12,
    });
  });

  it("works in a Chrome isolated world without a custom-elements registry", () => {
    vi.stubGlobal("customElements", null);
    const widget = createEcoWidget(document);
    document.body.append(widget);
    expect(widget.tagName).toBe("ECO-IA-WIDGET");
    expect(widget.shadowRoot?.querySelector("[role='region']")).not.toBeNull();
    expect(() => widget.update(viewModel)).not.toThrow();
    widget.disconnectEcoIaWidget();
  });

  it("convertit les anciens ancrages en coordonnées horizontales", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(900);
    const widget = createWidget();

    widget.configure({ preferences: { side: "left", top: 96 } });
    expect(widget.style.left).toBe("12px");

    widget.configure({ preferences: { side: "right", top: 96 } });
    expect(widget.style.left).toBe("693px");
  });

  it("reclamps after details toggle on RAF and cancels a pending frame on disconnect", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const frameId = ++nextFrame;
      callbacks.set(frameId, callback);
      return frameId;
    });
    const cancelFrame = vi.fn((frameId: number) => callbacks.delete(frameId));
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(720);
    const widget = createWidget();
    widget.configure({
      preferences: { theme: "system", side: "right", collapsed: false, top: 96 },
    });
    const panel = widget.shadowRoot?.querySelector<HTMLElement>("section.panel");
    const details = widget.shadowRoot?.querySelector<HTMLDetailsElement>("details");
    if (!panel || !details) throw new Error("MISSING_WIDGET_FIXTURE");
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 232,
      bottom: 696,
      left: 0,
      width: 232,
      height: 696,
      toJSON: () => ({}),
    });

    details.dispatchEvent(new Event("toggle"));
    const firstFrame = requestFrame.mock.results[0]?.value;
    expect(firstFrame).toBe(1);
    callbacks.get(firstFrame)?.(0);
    expect(widget.style.top).toBe("12px");

    details.dispatchEvent(new Event("toggle"));
    const pendingFrame = requestFrame.mock.results[1]?.value;
    widget.disconnectEcoIaWidget();
    expect(cancelFrame).toHaveBeenCalledWith(pendingFrame);
  });

  it("reclamps on RAF after collapse, movement and reopen with reduced motion", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const frameId = ++nextFrame;
      callbacks.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => callbacks.delete(frameId)),
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, media: "(prefers-reduced-motion: reduce)" })),
    );
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(720);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(900);
    const widget = createWidget();
    widget.configure({
      preferences: { theme: "system", side: "right", collapsed: false, top: 500 },
    });
    const panel = widget.shadowRoot?.querySelector<HTMLElement>("section.panel");
    const handle = widget.shadowRoot?.querySelector<HTMLElement>(".drag-handle");
    if (!panel || !handle) throw new Error("MISSING_WIDGET_FIXTURE");
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 232,
      bottom: 696,
      left: 0,
      width: 232,
      height: 696,
      toJSON: () => ({}),
    });
    vi.spyOn(widget, "getBoundingClientRect").mockReturnValue({
      x: 648,
      y: 500,
      top: 500,
      right: 880,
      bottom: 540,
      left: 648,
      width: 232,
      height: 40,
      toJSON: () => ({}),
    });

    widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-collapse]")?.click();
    const collapseFrame = requestFrame.mock.results.at(-1)?.value;
    expect(collapseFrame).toBe(1);
    callbacks.get(collapseFrame)?.(0);

    const pointerEvent = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 7 });
      return event;
    };
    handle.dispatchEvent(pointerEvent("pointerdown", 660, 510));
    window.dispatchEvent(pointerEvent("pointermove", 30, 320));
    window.dispatchEvent(pointerEvent("pointerup", 30, 320));

    widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-expand]")?.click();
    const reopenFrame = requestFrame.mock.results.at(-1)?.value;
    expect(reopenFrame).toBeGreaterThan(collapseFrame);
    callbacks.get(reopenFrame)?.(0);
    expect(widget.style.top).toBe("12px");
    expect(widget.shadowRoot?.querySelector("style")?.textContent).toContain(
      "prefers-reduced-motion: reduce",
    );
  });

  it("isolates a compact native interface in Shadow DOM", () => {
    const widget = createWidget();
    const shadow = widget.shadowRoot;
    const styles = shadow?.querySelector("style")?.textContent ?? "";
    expect(shadow).not.toBeNull();
    expect(styles).toContain("--widget-width: 195px");
    expect(styles).toContain("--collapsed-size: 36px");
    expect(styles).toContain("--widget-max-height: 480px");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain("@keyframes measurement-ring");
    expect(styles).not.toContain("infinite");
    expect(styles).not.toMatch(/transition:[^;]*(?:top|left|right)/u);
    expect(shadow?.querySelectorAll("[data-impact-step]")).toHaveLength(3);
    expect(shadow?.querySelectorAll("svg[data-icon]").length).toBeGreaterThanOrEqual(5);
    const brandMarks = shadow?.querySelectorAll<HTMLImageElement>("[data-brand-mark]");
    expect(brandMarks).toHaveLength(2);
    for (const mark of brandMarks ?? []) {
      expect(mark.alt).toBe("");
      expect(mark.getAttribute("src")).not.toMatch(/^https?:/u);
      expect(mark.width).toBe(48);
      expect(mark.height).toBe(48);
    }
    expect(shadow?.querySelector("[data-anchor-left]")).toBeNull();
    expect(shadow?.querySelector("[data-anchor-right]")).toBeNull();
    expect(shadow?.querySelector("[role='region']")?.getAttribute("aria-label")).toBe(
      "Impact environnemental estimé de cette conversation IA",
    );
  });

  it("masque les plages redondantes tant que l’impact est en attente", () => {
    const widget = createWidget();
    widget.update({
      ...viewModel,
      state: "active",
      current: {
        ...viewModel.current,
        impact: null,
      },
    });

    expect(widget.shadowRoot?.querySelector("[data-water]")?.textContent).toBe("En attente");
    expect(widget.shadowRoot?.querySelector<HTMLElement>("[data-water-range]")?.hidden).toBe(true);
    expect(widget.shadowRoot?.querySelector<HTMLElement>("[data-car-range]")?.hidden).toBe(true);
    expect(widget.shadowRoot?.querySelector<HTMLElement>("[data-television-range]")?.hidden).toBe(
      true,
    );
  });

  it("confirms a newly completed measurement once, then becomes still", () => {
    vi.useFakeTimers();
    const widget = createWidget();
    widget.update({ ...viewModel, state: "active" });
    widget.update({ ...viewModel, state: "completed" });

    expect(widget.hasAttribute("data-fresh-measurement")).toBe(true);
    vi.advanceTimersByTime(900);
    expect(widget.hasAttribute("data-fresh-measurement")).toBe(false);
  });

  it("uses a restrained translucent surface without a continuous visual effect", () => {
    const widget = createWidget();
    const styles = widget.shadowRoot?.querySelector("style")?.textContent ?? "";

    expect(styles).toContain("--panel-surface:");
    expect(styles).toContain("--data-surface:");
    expect(styles).toContain("--panel-surface: oklch(97% 0.014 170 / 0.72)");
    expect(styles).toContain("--data-surface: oklch(99% 0.008 170 / 0.88)");
    expect(styles).toContain("backdrop-filter: blur(16px)");
    expect(styles).toContain("-webkit-backdrop-filter: blur(16px)");
    expect(styles).not.toContain("backdrop-filter: blur(24px)");
    expect(styles).not.toContain("infinite");
    expect(styles).not.toMatch(/(?:^|\s)zoom\s*:/u);
  });

  it("writes untrusted model labels as text, never markup", () => {
    const widget = createWidget();
    const staticIconCount = widget.shadowRoot?.querySelectorAll("svg[data-icon]").length;
    const staticBrandMarkCount = widget.shadowRoot?.querySelectorAll("[data-brand-mark]").length;
    widget.update({
      ...viewModel,
      modelControl: {
        ...viewModel.modelControl,
        detectedLabel: '<svg onload="alert(1)">',
        effectiveLabel: '<img src=x onerror="alert(1)">',
        options: [
          {
            id: "chatgpt-gpt-5-5-instant",
            label: '<script type="text/javascript">alert(1)</script>',
            isGeneric: false,
            isProxy: true,
            impactProfileId: "openai-generic-v1",
          },
        ],
      },
    });
    expect(widget.shadowRoot?.querySelector("script")).toBeNull();
    expect(widget.shadowRoot?.querySelectorAll("svg[data-icon]")).toHaveLength(
      staticIconCount ?? 0,
    );
    expect(widget.shadowRoot?.querySelectorAll("[data-brand-mark]")).toHaveLength(
      staticBrandMarkCount ?? 0,
    );
    expect(widget.shadowRoot?.querySelector("[data-model]")?.textContent).toBe(
      '<img src=x onerror="alert(1)">',
    );
    expect(widget.shadowRoot?.querySelector("[data-detected-model]")?.textContent).toContain(
      '<svg onload="alert(1)">',
    );
    expect(
      widget.shadowRoot?.querySelector<HTMLOptionElement>('option[value="chatgpt-gpt-5-5-instant"]')
        ?.textContent,
    ).toBe('<script type="text/javascript">alert(1)</script> — proxy D');
  });

  it("always exposes a native model selector with automatic and compatible options", () => {
    const widget = createWidget();
    widget.update(viewModel);
    const details = widget.shadowRoot?.querySelector("details");
    const select = widget.shadowRoot?.querySelector<HTMLSelectElement>("[data-model-select]");
    expect(details?.contains(select ?? null)).toBe(true);
    expect(select?.labels[0]?.textContent).toContain("Modèle appliqué");
    expect(
      [...(select?.options ?? [])].map(({ value, textContent }) => [value, textContent]),
    ).toEqual([
      ["", "Détection automatique"],
      ["chatgpt-gpt-5-5-instant", "GPT-5.5 Instant — proxy D"],
      ["chatgpt-gpt-5-6-sol", "GPT-5.6 Sol — proxy D"],
      ["openai-generic-v1", "OpenAI générique — forte incertitude"],
    ]);
    expect(select?.value).toBe("chatgpt-gpt-5-5-instant");
    expect(widget.shadowRoot?.querySelector("[data-model-method-note]")?.textContent).toContain(
      "Aucune donnée environnementale propre à GPT-5.5 Instant",
    );
  });

  it("opens details and focuses the selector from the missing-model alert", () => {
    const widget = createWidget();
    widget.update({
      ...viewModel,
      modelControl: {
        ...viewModel.modelControl,
        resolution: "generic",
        selectedProfileId: null,
        warning: "Modèle non communiqué — profil générique utilisé",
      },
    });
    const warning = widget.shadowRoot?.querySelector<HTMLElement>("[data-model-warning]");
    expect(warning?.textContent).toContain("Modèle non communiqué — profil générique utilisé");
    expect(warning?.textContent).toContain("Attention");
    widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-choose-model]")?.click();
    expect(widget.shadowRoot?.querySelector("details")?.open).toBe(true);
    expect(widget.shadowRoot?.activeElement).toBe(
      widget.shadowRoot?.querySelector("[data-model-select]"),
    );
  });

  it("shows no missing-model alert when the model is observed", () => {
    const widget = createWidget();
    widget.update(viewModel);
    expect(widget.shadowRoot?.querySelector("[data-model-warning]")?.hasAttribute("hidden")).toBe(
      true,
    );
  });

  it("emits only allowlisted profile IDs or null for automatic mode", () => {
    const onModelSelectionChange = vi.fn();
    const widget = createWidget();
    widget.configure({ onModelSelectionChange });
    widget.update(viewModel);
    const select = widget.shadowRoot?.querySelector<HTMLSelectElement>("[data-model-select]");
    if (!select) throw new Error("MISSING_MODEL_SELECT");

    const injectedOption = document.createElement("option");
    injectedOption.value = "injected-profile";
    select.append(injectedOption);
    select.value = "injected-profile";
    select.dispatchEvent(new Event("change"));
    expect(onModelSelectionChange).not.toHaveBeenCalled();
    expect(select.value).toBe("chatgpt-gpt-5-5-instant");

    select.value = "chatgpt-gpt-5-6-sol";
    select.dispatchEvent(new Event("change"));
    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect(onModelSelectionChange.mock.calls).toEqual([["chatgpt-gpt-5-6-sol"], [null]]);
  });

  it("preserves model option nodes while the platform/profile signature is unchanged", () => {
    const widget = createWidget();
    widget.update(viewModel);
    const before = [
      ...(widget.shadowRoot?.querySelectorAll<HTMLOptionElement>("[data-model-select] option") ??
        []),
    ];

    widget.update({
      ...viewModel,
      state: "streaming",
      current: {
        ...viewModel.current,
        tokens: { ...viewModel.current.tokens, output: createRange(280, 300, 320) },
      },
    });

    const after = [
      ...(widget.shadowRoot?.querySelectorAll<HTMLOptionElement>("[data-model-select] option") ??
        []),
    ];
    expect(after).toEqual(before);
  });

  it("renders context bounds, quality evidence, limitations and five diagnostic rows", () => {
    const widget = createWidget();
    widget.update(viewModel);
    const shadow = widget.shadowRoot;
    expect(shadow?.querySelector("[data-context]")?.textContent).toBe(
      "Contexte visible : jusqu’à ≈ 240 tokens supplémentaires",
    );
    expect(shadow?.querySelector("[data-context-explanation]")?.textContent).toContain(
      "tours les plus anciens ont été exclus",
    );
    expect(shadow?.querySelector("[data-context-explanation]")?.textContent).toContain(
      "tronquer, résumer, mettre en cache ou enrichir",
    );
    expect(shadow?.querySelector("[data-quality-overall]")?.textContent).toBe(
      "Qualité des données · D",
    );
    expect(shadow?.querySelectorAll("[data-quality-indicator]")).toHaveLength(3);
    expect(
      [...(shadow?.querySelectorAll("[data-quality-indicator]") ?? [])].map(
        (indicator) => indicator.textContent,
      ),
    ).toEqual([
      "Électricité · B · B — donnée publiée avec adaptation limitée",
      "Eau · C · C — estimation modélisée à partir de données publiées",
      "Carbone · D · D — proxy générique avec forte incertitude",
    ]);
    expect(shadow?.querySelectorAll("[data-disclosure-source]")).toHaveLength(2);
    expect(shadow?.querySelectorAll("[data-disclosure-source] a")).toHaveLength(2);
    for (const link of shadow?.querySelectorAll("[data-disclosure-source] a") ?? []) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.textContent).toContain("Ouvrir la source");
    }
    expect(shadow?.querySelector("[data-disclosure-limitations]")?.textContent).toContain(
      "Contexte fournisseur inconnu",
    );
    expect(shadow?.querySelectorAll("[data-diagnostic-row]")).toHaveLength(5);
    expect(shadow?.querySelector("[data-diagnostics]")?.textContent).toContain(
      "Contexte · Partiel",
    );
  });

  it("renders central estimates and readable uncertainty ranges", () => {
    const widget = createWidget();
    widget.update(viewModel);
    expect(widget.shadowRoot?.querySelector("[data-input-tokens]")?.textContent).toBe(
      "≈ 100 tokens",
    );
    expect(widget.shadowRoot?.querySelector("[data-input-token-range]")?.textContent).toBe(
      "de 90 à 110 tokens",
    );
    expect(widget.shadowRoot?.querySelector("[data-water]")?.textContent).toBe("≈ 2 ml");
    expect(widget.shadowRoot?.querySelector("[data-water-range]")?.textContent).toBe("de 1 à 3 ml");
    expect(widget.shadowRoot?.querySelector("[data-quality-overall]")?.textContent).toContain("D");
    expect(widget.shadowRoot?.querySelector("[data-input-token-range]")?.textContent).not.toMatch(
      /[–—]/u,
    );
  });

  it("toggles and persists an explicit light/dark theme", () => {
    const onPreferencesChange = vi.fn();
    const widget = createWidget();
    widget.configure({
      preferences: { theme: "light", side: "right", collapsed: false, top: 96 },
      onPreferencesChange,
    });
    const themeButton = widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-theme-toggle]");
    themeButton?.click();
    expect(widget.getAttribute("data-theme")).toBe("dark");
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: "dark" }),
    );
  });

  it("collapses to a labeled 36px control and reopens", () => {
    const widget = createWidget();
    widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-collapse]")?.click();
    expect(widget.hasAttribute("collapsed")).toBe(true);
    const collapsedButton = widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-expand]");
    expect(collapsedButton?.getAttribute("aria-label")).toBe("Ouvrir ecoIA");
    expect(collapsedButton?.classList.contains("collapsed-button")).toBe(true);
    collapsedButton?.click();
    expect(widget.hasAttribute("collapsed")).toBe(false);
  });

  it("moves focus to a visible control across collapse and expansion clicks", () => {
    const widget = createWidget();
    const collapseButton = widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-collapse]");
    const expandButton = widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-expand]");
    if (!collapseButton || !expandButton) throw new Error("MISSING_COLLAPSE_CONTROLS");

    collapseButton.focus();
    collapseButton.click();
    expect(widget.hasAttribute("collapsed")).toBe(true);
    expect(widget.shadowRoot?.activeElement).toBe(expandButton);

    expandButton.click();
    expect(widget.hasAttribute("collapsed")).toBe(false);
    expect(widget.shadowRoot?.activeElement).toBe(collapseButton);
  });

  it("does not steal document focus for a programmatic toolbar toggle", () => {
    const outsideButton = document.createElement("button");
    document.body.append(outsideButton);
    outsideButton.focus();
    const widget = createWidget();

    widget.toggleCollapsed();

    expect(document.activeElement).toBe(outsideButton);
  });

  it("removes contradictory left and right anchor controls", () => {
    const widget = createWidget();
    expect(widget.shadowRoot?.querySelector("[data-anchor-left]")).toBeNull();
    expect(widget.shadowRoot?.querySelector("[data-anchor-right]")).toBeNull();
  });

  it("déplace librement le widget au clavier et mémorise chaque ajustement", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(900);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(720);
    const onPreferencesChange = vi.fn();
    const widget = createWidget();
    widget.configure({
      preferences: { theme: "light", collapsed: false, left: 500, top: 200 },
      onPreferencesChange,
    });
    const handle = widget.shadowRoot?.querySelector<HTMLButtonElement>(".drag-handle");
    if (!handle) throw new Error("MISSING_DRAG_HANDLE");

    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", shiftKey: true, bubbles: true }),
    );

    expect(widget.style.left).toBe("490px");
    expect(widget.style.top).toBe("199px");
    expect(onPreferencesChange).toHaveBeenLastCalledWith({
      theme: "light",
      collapsed: false,
      left: 490,
      top: 199,
    });
  });

  it("conserve la position exacte au relâchement sans ancrage automatique", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(900);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(720);
    const onPreferencesChange = vi.fn();
    const widget = createWidget();
    widget.configure({
      preferences: { theme: "system", collapsed: false, left: 500, top: 100 },
      onPreferencesChange,
    });
    const handle = widget.shadowRoot?.querySelector<HTMLButtonElement>(".drag-handle");
    if (!handle) throw new Error("MISSING_DRAG_HANDLE");
    vi.spyOn(widget, "getBoundingClientRect").mockReturnValue({
      x: 500,
      y: 100,
      top: 100,
      right: 695,
      bottom: 580,
      left: 500,
      width: 195,
      height: 480,
      toJSON: () => ({}),
    });
    const pointerEvent = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 11 });
      return event;
    };

    handle.dispatchEvent(pointerEvent("pointerdown", 510, 110));
    window.dispatchEvent(pointerEvent("pointermove", 360, 220));
    window.dispatchEvent(pointerEvent("pointerup", 360, 220));

    expect(widget.style.left).toBe("350px");
    expect(widget.style.top).toBe("210px");
    expect(widget.hasAttribute("data-side")).toBe(false);
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ left: 350, top: 210 }),
    );
  });

  it("gives every interactive control an accessible name and visible focus styling", () => {
    const widget = createWidget();
    widget.update(viewModel);
    const controls =
      widget.shadowRoot?.querySelectorAll<HTMLElement>("button, summary, select, a") ?? [];
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls) {
      const name = control.getAttribute("aria-label") ?? control.textContent?.trim();
      expect(name).toBeTruthy();
    }
    expect(widget.shadowRoot?.querySelector("style")?.textContent).toContain(":focus-visible");
    expect(widget.shadowRoot?.querySelector("style")?.textContent).toMatch(/select:focus-visible/);
    expect(
      widget.shadowRoot?.querySelector("[data-selection-error]")?.getAttribute("aria-live"),
    ).toBe("polite");
  });

  it("keeps warning, details, selector and source actions in logical keyboard order", () => {
    const widget = createWidget();
    widget.update({
      ...viewModel,
      modelControl: {
        ...viewModel.modelControl,
        warning: "Modèle non communiqué — profil générique utilisé",
      },
    });
    const shadow = widget.shadowRoot;
    const interactive = [...(shadow?.querySelectorAll("button, summary, select, a") ?? [])];
    const warningIndex = interactive.indexOf(
      shadow?.querySelector("[data-choose-model]") as Element,
    );
    const summaryIndex = interactive.indexOf(shadow?.querySelector("summary") as Element);
    const selectIndex = interactive.indexOf(
      shadow?.querySelector("[data-model-select]") as Element,
    );
    const sourceIndex = interactive.indexOf(
      shadow?.querySelector("[data-disclosure-source] a") as Element,
    );
    expect(warningIndex).toBeGreaterThanOrEqual(0);
    expect(summaryIndex).toBeGreaterThan(warningIndex);
    expect(selectIndex).toBeGreaterThan(summaryIndex);
    expect(sourceIndex).toBeGreaterThan(selectIndex);
  });

  it("announces selection errors without reflecting an unavailable profile ID", () => {
    const widget = createWidget();
    widget.update({
      ...viewModel,
      modelControl: {
        ...viewModel.modelControl,
        selectionError: "Ce modèle n’est pas disponible pour cette plateforme.",
      },
    });
    const error = widget.shadowRoot?.querySelector("[data-selection-error]");
    expect(error?.textContent).toBe("Ce modèle n’est pas disponible pour cette plateforme.");
    expect(error?.getAttribute("aria-live")).toBe("polite");
  });

  it("defines non-color warnings, contrast-aware theme tokens and reduced motion", () => {
    const widget = createWidget();
    const styles = widget.shadowRoot?.querySelector("style")?.textContent ?? "";
    expect(styles).toContain("--warning-text:");
    expect(styles).toMatch(/data-theme="dark"[\s\S]*--warning-text:/);
    expect(styles).toContain(".warning-label");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });

  it("announces only a newly completed response", () => {
    const widget = createWidget();
    widget.update({ ...viewModel, state: "streaming" });
    expect(widget.shadowRoot?.querySelector("[data-live]")?.textContent).toBe("");
    widget.update(viewModel);
    expect(widget.shadowRoot?.querySelector("[data-live]")?.textContent).toContain(
      "Réponse terminée",
    );
  });

  it("keeps the completion announcement during the aggregate refresh", () => {
    const widget = createWidget();
    widget.update(viewModel);
    expect(widget.shadowRoot?.querySelector("[data-live]")?.textContent).toContain(
      "Réponse terminée",
    );

    widget.update({ ...viewModel, session: viewModel.session });
    expect(widget.shadowRoot?.querySelector("[data-live]")?.textContent).toContain(
      "Réponse terminée",
    );
  });

  it("keeps a safety margin around the two streaming renders per second budget", () => {
    vi.useFakeTimers();
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const widget = createWidget();
    widget.update({ ...viewModel, state: "streaming" });
    const initialOutput = widget.shadowRoot?.querySelector("[data-output-tokens]")?.textContent;

    now.mockReturnValue(1_500);
    widget.update({
      ...viewModel,
      state: "streaming",
      current: {
        ...viewModel.current,
        tokens: {
          ...viewModel.current.tokens,
          output: createRange(380, 400, 420),
        },
      },
    });

    expect(widget.shadowRoot?.querySelector("[data-output-tokens]")?.textContent).toBe(
      initialOutput,
    );
    now.mockReturnValue(1_525);
    vi.advanceTimersByTime(25);
    expect(widget.shadowRoot?.querySelector("[data-output-tokens]")?.textContent).toBe(
      "≈ 400 tokens",
    );
  });

  it("throttles streaming updates after a render at time zero", () => {
    vi.useFakeTimers();
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const widget = createWidget();
    widget.update({ ...viewModel, state: "streaming" });

    now.mockReturnValue(500);
    widget.update({
      ...viewModel,
      state: "streaming",
      current: {
        ...viewModel.current,
        tokens: {
          ...viewModel.current.tokens,
          output: createRange(380, 400, 420),
        },
      },
    });

    expect(widget.shadowRoot?.querySelector("[data-output-tokens]")?.textContent).toBe(
      "≈ 200 tokens",
    );
  });
});
