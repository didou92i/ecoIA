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

test("expose des rôles, noms et commandes utilisables au clavier", async ({ extensionPage }) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(
    widget.getByRole("region", { name: "Impact environnemental estimé de cette conversation IA" }),
  ).toBeVisible();
  const controls = widget.locator("button, summary, a[href]");
  const names = await controls.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? element.textContent?.trim()),
  );
  expect(names.length).toBeGreaterThan(5);
  expect(names.every(Boolean)).toBe(true);

  const leftButton = widget.getByRole("button", { name: "Ancrer ecoIA à gauche" });
  await leftButton.focus();
  await extensionPage.keyboard.press("Enter");
  await expect(widget).toHaveAttribute("data-side", "left");
  await extensionPage.keyboard.press("Tab");
  await expect(widget.getByRole("button", { name: "Ancrer ecoIA à droite" })).toBeFocused();
});

test("respecte le contraste des textes et la préférence de mouvement réduit", async ({
  extensionPage,
}) => {
  await extensionPage.emulateMedia({ reducedMotion: "reduce" });
  const widget = extensionPage.locator("eco-ia-widget");
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
});
