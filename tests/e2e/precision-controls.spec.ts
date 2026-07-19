import type { BrowserContext, Page } from "@playwright/test";

import { activateFixtureInteraction, expect, test } from "./extension.fixture";

async function openFixturePage(
  extensionContext: BrowserContext,
  fixtureOrigin: string,
  path = "/",
): Promise<Page> {
  const page = await extensionContext.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${fixtureOrigin}${path}`);
  await expect(page.locator("eco-ia-widget")).toBeVisible();
  await activateFixtureInteraction(page);
  await expect(page.locator("eco-ia-widget [data-status]")).toHaveText("Réponse mesurée");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  return page;
}

function centralTokenValue(value: string | null): number {
  const digits = value?.replace(/\D/gu, "") ?? "";
  if (!digits) throw new Error(`E2E_TOKEN_VALUE_MISSING:${value ?? "null"}`);
  return Number(digits);
}

function upperTokenBound(value: string | null): number {
  const match = value?.match(/à\s+([\d\s\u202f]+)\s+tokens/u);
  if (!match?.[1]) throw new Error(`E2E_TOKEN_BOUND_MISSING:${value ?? "null"}`);
  return Number(match[1].replace(/\s/gu, ""));
}

test("résout GPT-5.5 Instant automatiquement et explique exactement le modèle manquant", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const observedPage = await openFixturePage(extensionContext, fixtureOrigin, "/observed-model");
  const observedWidget = observedPage.locator("eco-ia-widget");
  await expect(observedWidget.locator("[data-model]")).toHaveText("GPT-5.5 Instant · proxy D");
  await expect(observedWidget.locator("[data-model-warning]")).toBeHidden();
  await observedWidget.getByText("Méthode et détails", { exact: true }).click();
  await expect(observedWidget.locator("[data-model-method-note]")).toContainText(
    "Aucune donnée environnementale propre à GPT-5.5 Instant",
  );

  const missingPage = await openFixturePage(extensionContext, fixtureOrigin, "/missing-model");
  const missingWidget = missingPage.locator("eco-ia-widget");
  await expect(missingWidget.locator("[data-model-warning-text]")).toHaveText(
    "Modèle non communiqué — profil générique utilisé",
  );
  const chooseModel = missingWidget.getByRole("button", { name: "Choisir le modèle" });
  await chooseModel.click();
  await expect(missingWidget.locator("details")).toHaveAttribute("open", "");
  await expect(missingWidget.getByRole("combobox", { name: "Modèle appliqué" })).toBeFocused();

  await observedPage.close();
  await missingPage.close();
});

test("applique un profil compatible au même tour sans créer une seconde interaction", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const page = await openFixturePage(extensionContext, fixtureOrigin, "/manual-model");
  const widget = page.locator("eco-ia-widget");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  const modelSelect = widget.getByRole("combobox", { name: "Modèle appliqué" });
  await expect(modelSelect.locator("option")).toHaveText([
    "Détection automatique",
    "GPT-5.6 Sol — proxy D",
    "GPT-5.6 Sol Pro — proxy D",
    "GPT-5.5 Instant — proxy D",
    "GPT-5.4 Thinking — proxy D",
    "GPT-5.3 Instant — proxy D",
    "OpenAI o3 — proxy D",
    "OpenAI — profil générique — forte incertitude",
  ]);
  await expect(widget.locator("[data-session]")).toContainText("1 interaction");

  await modelSelect.selectOption("chatgpt-gpt-5-6-sol");
  await expect(modelSelect).toHaveValue("chatgpt-gpt-5-6-sol");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.6 Sol · proxy D");
  await expect(widget.locator("[data-model-method-note]")).toContainText(
    "Aucune donnée environnementale propre à GPT-5.6 Sol",
  );
  await expect(widget.locator("[data-diagnostics]")).toContainText("Modèle · Manuel");
  await expect(widget.locator("[data-quality-overall]")).toContainText("Qualité des données · D");
  await expect(widget.locator("[data-session]")).toContainText("1 interaction");
  await page.close();
});

test("réinitialise le choix manuel après navigation SPA et après rechargement", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const page = await openFixturePage(extensionContext, fixtureOrigin, "/model-lifecycle");
  const widget = page.locator("eco-ia-widget");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  const modelSelect = widget.getByRole("combobox", { name: "Modèle appliqué" });
  await modelSelect.selectOption("chatgpt-gpt-5-6-sol");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.6 Sol · proxy D");

  await page.evaluate(() => {
    const conversation = document.querySelector<HTMLElement>("[data-conversation-id]");
    const answer = document.querySelector<HTMLElement>("[data-answer]");
    if (!conversation || !answer) throw new Error("E2E_CONVERSATION_FIXTURE_MISSING");
    history.pushState(null, "", "/c/synthetic-conversation-b");
    conversation.dataset.conversationId = "synthetic-conversation-b";
    answer.textContent += " Nouvelle conversation synthétique.";
  });
  await expect(modelSelect).toHaveValue("");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.5 Instant · proxy D");
  await expect(widget.locator("[data-diagnostics]")).toContainText("Modèle · Automatique");

  await modelSelect.selectOption("chatgpt-gpt-5-6-sol");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.6 Sol · proxy D");
  await page.reload();
  await expect(widget).toBeVisible();
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.5 Instant · proxy D");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  await expect(widget.getByRole("combobox", { name: "Modèle appliqué" })).toHaveValue("");
  await page.close();
});

test("réinitialise la session quand une conversation SPA revient à la route racine", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const page = await openFixturePage(
    extensionContext,
    fixtureOrigin,
    "/c/synthetic-conversation-a",
  );
  const widget = page.locator("eco-ia-widget");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  const modelSelect = widget.getByRole("combobox", { name: "Modèle appliqué" });
  await modelSelect.selectOption("chatgpt-gpt-5-6-sol");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.6 Sol · proxy D");

  await page.evaluate(() => {
    const conversation = document.querySelector<HTMLElement>("[data-conversation-id]");
    const answer = document.querySelector<HTMLElement>("[data-answer]");
    if (!conversation || !answer) throw new Error("E2E_CONVERSATION_FIXTURE_MISSING");
    history.pushState(null, "", "/");
    conversation.removeAttribute("data-conversation-id");
    answer.textContent += " Retour synthétique à la route racine.";
  });

  await expect(modelSelect).toHaveValue("");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.5 Instant · proxy D");
  await expect(widget.locator("[data-diagnostics]")).toContainText("Modèle · Automatique");
  await expect(widget.locator("[data-session]")).toHaveText("Aucune donnée");
  await page.close();
});

test("borne le contexte visible sans modifier l'estimation centrale du prompt", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  test.info().annotations.push({
    type: "unit-coverage",
    description:
      "Le plafond de 2 MiB et le contexte partiel sont couverts par tests/unit/visible-context.test.ts; la lecture unique est instrumentée dans tests/unit/content-controller.test.ts.",
  });
  const contextPage = await openFixturePage(extensionContext, fixtureOrigin, "/with-context");
  const noContextPage = await openFixturePage(extensionContext, fixtureOrigin, "/no-context");
  const contextWidget = contextPage.locator("eco-ia-widget");
  const noContextWidget = noContextPage.locator("eco-ia-widget");
  await contextWidget.getByText("Méthode et détails", { exact: true }).click();
  await noContextWidget.getByText("Méthode et détails", { exact: true }).click();

  await expect(contextWidget.locator("[data-context]")).toBeVisible();
  await expect(contextWidget.locator("[data-context]")).toContainText(
    "Contexte visible : jusqu’à ≈",
  );
  await expect(noContextWidget.locator("[data-context]")).toBeHidden();
  const centralWithContext = centralTokenValue(
    await contextWidget.locator("[data-input-tokens]").textContent(),
  );
  const centralWithoutContext = centralTokenValue(
    await noContextWidget.locator("[data-input-tokens]").textContent(),
  );
  const highWithContext = upperTokenBound(
    await contextWidget.locator("[data-input-token-range]").textContent(),
  );
  const highWithoutContext = upperTokenBound(
    await noContextWidget.locator("[data-input-token-range]").textContent(),
  );
  expect(centralWithContext).toBe(centralWithoutContext);
  expect(highWithContext).toBeGreaterThan(highWithoutContext);

  await contextPage.close();
  await noContextPage.close();
});
