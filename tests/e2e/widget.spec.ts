import { expect, test } from "./extension.fixture";

test("injecte le widget et présente une estimation compréhensible", async ({ extensionPage }) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-4o");
  await expect(widget.locator("[data-input-tokens]")).toContainText("token");
  await expect(widget.locator("[data-water]")).not.toHaveText("—");
  await expect(widget.locator("[data-live]")).toContainText("Réponse terminée");
});

test("replie, restaure et mémorise le thème sombre", async ({ extensionPage }) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await widget.locator("[data-theme-toggle]").click();
  await expect(widget).toHaveAttribute("data-theme", "dark");
  await widget.locator("[data-collapse]").click();
  await expect(widget).toHaveAttribute("collapsed", "");
  await widget.locator("[data-expand]").click();
  await expect(widget).not.toHaveAttribute("collapsed", "");

  await extensionPage.reload();
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-theme", "dark");
});

test("se déplace, s'ancre et reste dans la fenêtre après redimensionnement", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  const handle = widget.locator(".drag-handle");
  const box = await handle.boundingBox();
  if (!box) throw new Error("DRAG_HANDLE_NOT_VISIBLE");
  await extensionPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await extensionPage.mouse.down();
  await extensionPage.mouse.move(20, 280, { steps: 5 });
  await extensionPage.mouse.up();
  await expect(widget).toHaveAttribute("data-side", "left");

  await extensionPage.setViewportSize({ width: 480, height: 420 });
  await expect.poll(async () => (await widget.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(12);
  await expect
    .poll(async () => {
      const bounds = await widget.boundingBox();
      return (bounds?.y ?? Number.POSITIVE_INFINITY) + (bounds?.height ?? 0);
    })
    .toBeLessThanOrEqual(420);
});
