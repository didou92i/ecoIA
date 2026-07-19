import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "./extension.fixture";

function relativeLuminance(hexColor: string): number {
  const channels = hexColor
    .slice(1)
    .match(/.{2}/gu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (channels?.length !== 3) throw new Error(`INVALID_COLOR:${hexColor}`);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (linear.at(0) ?? 0) + 0.7152 * (linear.at(1) ?? 0) + 0.0722 * (linear.at(2) ?? 0);
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function openAccessiblePage(
  extensionContext: BrowserContext,
  fixtureOrigin: string,
  path: string,
  viewport = { width: 1280, height: 720 },
): Promise<Page> {
  const page = await extensionContext.newPage();
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize(viewport);
  await page.goto(`${fixtureOrigin}${path}`);
  await expect(page.locator("eco-ia-widget [data-status]")).toHaveText("Réponse mesurée");
  return page;
}

async function expectVisibleFocus(page: Page): Promise<void> {
  const focus = await page.evaluate(() => {
    const widget = document.querySelector("eco-ia-widget");
    const active = widget?.shadowRoot?.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const styles = getComputedStyle(active);
    return { style: styles.outlineStyle, width: Number.parseFloat(styles.outlineWidth) };
  });
  expect(focus).not.toBeNull();
  expect(focus?.style).not.toBe("none");
  expect(focus?.width).toBeGreaterThanOrEqual(2);
}

test("parcourt au clavier l'alerte, les détails, le sélecteur et une source", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const page = await openAccessiblePage(extensionContext, fixtureOrigin, "/missing-model");
  const widget = page.locator("eco-ia-widget");
  await expect(
    widget.getByRole("region", { name: "Impact environnemental estimé de cette conversation IA" }),
  ).toBeVisible();
  const controls = widget.locator("button, summary, a[href]");
  const names = await controls.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? element.textContent?.trim()),
  );
  expect(names.length).toBeGreaterThan(5);
  expect(names.every(Boolean)).toBe(true);

  const warningAction = widget.getByRole("button", { name: "Choisir le modèle" });
  await warningAction.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(warningAction).toBeFocused();
  await expectVisibleFocus(page);

  await page.keyboard.press("Tab");
  const details = widget.getByText("Méthode et détails", { exact: true });
  await expect(details).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(widget.getByRole("combobox", { name: "Modèle appliqué" })).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Tab");
  await expect(widget.getByRole("link", { name: "Ouvrir la source" }).first()).toBeFocused();
  await expectVisibleFocus(page);

  const diagnostics = widget.locator("[data-diagnostic-row]");
  await expect(diagnostics).toHaveCount(5);
  expect(await diagnostics.allTextContents()).toEqual([
    "Plateforme · Reconnue",
    "Conversation · Détectée",
    "Modèle · Générique",
    "Contexte · Complet",
    "Réponse · Terminée",
  ]);
  expect(
    await diagnostics.evaluateAll((rows) => rows.map((row) => (row as HTMLElement).tabIndex)),
  ).toEqual([-1, -1, -1, -1, -1]);
  await page.close();
});

test("respecte le contraste des textes en thèmes clair et sombre", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const page = await openAccessiblePage(extensionContext, fixtureOrigin, "/contrast");
  const widget = page.locator("eco-ia-widget");
  for (const theme of ["light", "dark"] as const) {
    await expect(widget).toHaveAttribute("data-theme", theme);
    const tokens = await widget.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        text: styles.getPropertyValue("--text").trim(),
        muted: styles.getPropertyValue("--text-muted").trim(),
        surface: styles.getPropertyValue("--surface").trim(),
        transitionDuration: styles.transitionDuration,
      };
    });
    expect(contrastRatio(tokens.text, tokens.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.muted, tokens.surface)).toBeGreaterThanOrEqual(4.5);
    expect(tokens.transitionDuration).toBe("0s");
    if (theme === "light") {
      await widget.getByRole("button", { name: "Passer au thème sombre" }).click();
    }
  }
  await page.close();
});

test("reste entièrement dans un viewport de 320 px sans débordement horizontal", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const page = await openAccessiblePage(extensionContext, fixtureOrigin, "/narrow-viewport", {
    width: 320,
    height: 720,
  });
  const widget = page.locator("eco-ia-widget");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  const geometry = await page.evaluate(() => {
    const widget = document.querySelector("eco-ia-widget");
    const panel = widget?.shadowRoot?.querySelector(".panel");
    if (!(widget instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
    const bounds = widget.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry?.documentOverflow).toBeLessThanOrEqual(0);
  expect(geometry?.panelOverflow).toBeLessThanOrEqual(0);
  expect(geometry?.left).toBeGreaterThanOrEqual(0);
  expect(geometry?.right).toBeLessThanOrEqual(320);
  expect(geometry?.top).toBeGreaterThanOrEqual(0);
  await expect
    .poll(async () => (await widget.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(12);
  await expect
    .poll(async () => {
      const bounds = await widget.boundingBox();
      return (bounds?.y ?? Number.POSITIVE_INFINITY) + (bounds?.height ?? 0);
    })
    .toBeLessThanOrEqual(720);
  await page.close();
});
