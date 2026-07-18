// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImpactEstimate } from "../../src/impact/profile-types";
import { createRange } from "../../src/shared/range";
import { registerEcoWidget, type WidgetViewModel } from "../../src/widget/eco-widget";

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

const viewModel: WidgetViewModel = {
  platform: "chatgpt",
  model: "GPT-4o",
  state: "completed",
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
  const widget = document.createElement("eco-ia-widget") as HTMLElement & {
    configure(options: unknown): void;
    update(viewModel: WidgetViewModel): void;
  };
  document.body.append(widget);
  return widget;
}

describe("ecoIA widget", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("isolates a compact native interface in Shadow DOM", () => {
    const widget = createWidget();
    const shadow = widget.shadowRoot;
    expect(shadow).not.toBeNull();
    expect(shadow?.querySelector("style")?.textContent).toContain("--widget-width: 232px");
    expect(shadow?.querySelector("style")?.textContent).toContain("prefers-reduced-motion: reduce");
    expect(shadow?.querySelector("[role='region']")?.getAttribute("aria-label")).toBe(
      "Impact environnemental estimé de cette conversation IA",
    );
  });

  it("writes untrusted model labels as text, never markup", () => {
    const widget = createWidget();
    widget.update({ ...viewModel, model: '<img src=x onerror="alert(1)">' });
    expect(widget.shadowRoot?.querySelector("img")).toBeNull();
    expect(widget.shadowRoot?.querySelector("[data-model]")?.textContent).toBe(
      '<img src=x onerror="alert(1)">',
    );
  });

  it("renders token and environmental ranges", () => {
    const widget = createWidget();
    widget.update(viewModel);
    expect(widget.shadowRoot?.querySelector("[data-input-tokens]")?.textContent).toBe(
      "90–110 tokens",
    );
    expect(widget.shadowRoot?.querySelector("[data-water]")?.textContent).toBe("1–3 ml");
    expect(widget.shadowRoot?.querySelector("[data-confidence]")?.textContent).toContain("C");
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

  it("collapses to a labeled 40px control and reopens", () => {
    const widget = createWidget();
    widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-collapse]")?.click();
    expect(widget.hasAttribute("collapsed")).toBe(true);
    const collapsedButton = widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-expand]");
    expect(collapsedButton?.getAttribute("aria-label")).toBe("Ouvrir ecoIA");
    expect(collapsedButton?.classList.contains("collapsed-button")).toBe(true);
    collapsedButton?.click();
    expect(widget.hasAttribute("collapsed")).toBe(false);
  });

  it("offers keyboard-operable left and right anchoring", () => {
    const onPreferencesChange = vi.fn();
    const widget = createWidget();
    widget.configure({ onPreferencesChange });
    widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-anchor-left]")?.click();
    expect(widget.getAttribute("data-side")).toBe("left");
    widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-anchor-right]")?.click();
    expect(widget.getAttribute("data-side")).toBe("right");
    expect(onPreferencesChange).toHaveBeenCalled();
  });

  it("gives every interactive control an accessible name and visible focus styling", () => {
    const widget = createWidget();
    const controls = widget.shadowRoot?.querySelectorAll<HTMLElement>("button, summary, a") ?? [];
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls) {
      const name = control.getAttribute("aria-label") ?? control.textContent?.trim();
      expect(name).toBeTruthy();
    }
    expect(widget.shadowRoot?.querySelector("style")?.textContent).toContain(":focus-visible");
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
});
