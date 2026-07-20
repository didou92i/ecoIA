import { expect, test } from "./extension.fixture";

test("injecte le widget et présente une estimation compréhensible", async ({ extensionPage }) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.5 Instant · proxy D");
  await expect(widget.locator("[data-input-tokens]")).toHaveText(/^≈ .+ tokens$/u);
  await expect(widget.locator("[data-water]")).toHaveText(/^≈ /u);
  await expect(widget.locator("[data-water-range]")).toHaveText(/^de .+ à .+$/u);
  expect(await widget.locator(".panel").innerText()).not.toMatch(/[–—]/u);
  await widget.getByText("Méthode et détails", { exact: true }).click();
  await expect(widget.locator("[data-context]")).toBeVisible();
  await expect(widget.locator("[data-diagnostics]")).toContainText("Contexte · Complet");
  await expect(widget.locator("[data-live]")).toContainText("Réponse terminée");
});

test("relie les équivalences dans un parcours compact avec des pictogrammes natifs", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(widget.locator("[data-impact-step]")).toHaveCount(3);
  await expect(widget.locator("[data-impact-step] svg[data-icon]")).toHaveCount(3);
  await expect(widget.locator(".panel")).toHaveCSS("width", "195px");
  await expect(widget.locator(".panel")).toHaveCSS("max-height", "480px");
  await expect(widget.locator("[data-impact-step]").nth(0)).toContainText("Eau");
  await expect(widget.locator("[data-impact-step]").nth(1)).toContainText("Voiture");
  await expect(widget.locator("[data-impact-step]").nth(2)).toContainText("Téléviseur 100 W");
});

test("applique un verre renforcé tout en gardant les données plus opaques", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  const effect = await widget.evaluate((element) => {
    const hostStyles = getComputedStyle(element);
    const panel = element.shadowRoot?.querySelector(".panel");
    if (!(panel instanceof HTMLElement)) return null;
    const panelStyles = getComputedStyle(panel);
    return {
      panelSurface: hostStyles.getPropertyValue("--panel-surface").trim(),
      dataSurface: hostStyles.getPropertyValue("--data-surface").trim(),
      backdropFilter: panelStyles.backdropFilter,
    };
  });

  expect(effect).not.toBeNull();
  expect(effect?.panelSurface).toContain("/ 0.72");
  expect(effect?.dataSurface).toContain("/ 0.88");
  expect(effect?.backdropFilter).toContain("blur(16px)");
});

test("garde les détails dans une hauteur compacte avec défilement interne", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  const panel = widget.locator(".panel");
  const bounds = await panel.boundingBox();

  expect(bounds).not.toBeNull();
  expect(bounds?.height).toBeLessThanOrEqual(480);
  const overflow = await panel.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
});

test("garde la marque et les actions visibles pendant le défilement interne", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  const panel = widget.locator(".panel");
  const header = widget.locator(".header");
  const brandMark = widget.locator("[data-brand-mark]").first();

  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const panelBounds = await panel.boundingBox();
  const headerBounds = await header.boundingBox();
  const brandBounds = await brandMark.boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(headerBounds).not.toBeNull();
  expect(brandBounds).not.toBeNull();
  expect(headerBounds?.y ?? 0).toBeGreaterThanOrEqual((panelBounds?.y ?? 0) - 1);
  expect(brandBounds?.y ?? 0).toBeGreaterThanOrEqual((panelBounds?.y ?? 0) + 4);
});

test("replie, restaure et mémorise le thème sombre", async ({ extensionPage }) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await widget.locator("[data-theme-toggle]").click();
  await expect(widget).toHaveAttribute("data-theme", "dark");
  await widget.locator("[data-collapse]").click();
  await expect(widget).toHaveAttribute("collapsed", "");
  await expect(widget.locator("[data-expand]")).toBeFocused();
  await widget.locator("[data-expand]").click();
  await expect(widget).not.toHaveAttribute("collapsed", "");
  await expect(widget.locator("[data-collapse]")).toBeFocused();

  await extensionPage.reload();
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-theme", "dark");
});

test("se déplace librement, mémorise sa position et reste dans la fenêtre", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  const handle = widget.locator(".drag-handle");
  const widgetBox = await widget.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!widgetBox || !handleBox) throw new Error("DRAG_HANDLE_NOT_VISIBLE");
  const pointerOffset = {
    x: handleBox.x + handleBox.width / 2 - widgetBox.x,
    y: handleBox.y + handleBox.height / 2 - widgetBox.y,
  };
  await extensionPage.mouse.move(widgetBox.x + pointerOffset.x, widgetBox.y + pointerOffset.y);
  await extensionPage.mouse.down();
  await extensionPage.mouse.move(350 + pointerOffset.x, 180 + pointerOffset.y, { steps: 5 });
  await extensionPage.mouse.up();
  await expect.poll(async () => (await widget.boundingBox())?.x).toBeCloseTo(350, 0);
  await expect.poll(async () => (await widget.boundingBox())?.y).toBeCloseTo(180, 0);

  await extensionPage.reload();
  await expect(widget).toBeVisible();
  await expect.poll(async () => (await widget.boundingBox())?.x).toBeCloseTo(350, 0);
  await expect.poll(async () => (await widget.boundingBox())?.y).toBeCloseTo(180, 0);
  await expect(widget.locator("[data-anchor-left]")).toHaveCount(0);
  await expect(widget.locator("[data-anchor-right]")).toHaveCount(0);

  await extensionPage.setViewportSize({ width: 480, height: 420 });
  await expect.poll(async () => (await widget.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(12);
  await expect.poll(async () => (await widget.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(12);
  await expect
    .poll(async () => {
      const bounds = await widget.boundingBox();
      return (bounds?.x ?? Number.POSITIVE_INFINITY) + (bounds?.width ?? 0);
    })
    .toBeLessThanOrEqual(468);
  await expect
    .poll(async () => {
      const bounds = await widget.boundingBox();
      return (bounds?.y ?? Number.POSITIVE_INFINITY) + (bounds?.height ?? 0);
    })
    .toBeLessThanOrEqual(408);
});

test("ajuste et mémorise la position au clavier", async ({ extensionPage }) => {
  const widget = extensionPage.locator("eco-ia-widget");
  const handle = widget.locator(".drag-handle");
  const initial = await widget.boundingBox();
  if (!initial) throw new Error("WIDGET_NOT_VISIBLE");

  await handle.focus();
  await extensionPage.keyboard.press("ArrowLeft");
  await extensionPage.keyboard.press("Shift+ArrowUp");
  await expect(handle).toBeFocused();
  await expect.poll(async () => (await widget.boundingBox())?.x).toBeCloseTo(initial.x - 10, 0);
  await expect.poll(async () => (await widget.boundingBox())?.y).toBeCloseTo(initial.y - 1, 0);

  await extensionPage.reload();
  await expect(widget).toBeVisible();
  await expect.poll(async () => (await widget.boundingBox())?.x).toBeCloseTo(initial.x - 10, 0);
  await expect.poll(async () => (await widget.boundingBox())?.y).toBeCloseTo(initial.y - 1, 0);
});
