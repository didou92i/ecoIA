import { activateFixtureInteraction, expect, test } from "./extension.fixture";

test("ignore les tours de contexte et regroupe les étapes assistant du tour courant", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(widget.locator("[data-session]")).toContainText("1 interaction");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  await expect(widget.locator("[data-context]")).toBeVisible();
  const previousOutput = await widget.locator("[data-output-tokens]").textContent();

  await extensionPage.evaluate(() => {
    const conversation = document.querySelector("[data-conversation-id]");
    const assistant = conversation?.querySelector("[data-message-author-role='assistant']");
    if (!conversation || !assistant) throw new Error("E2E_ASSISTANT_FIXTURE_MISSING");
    const intermediateStep = assistant.cloneNode(false) as HTMLElement;
    intermediateStep.textContent = "Étape intermédiaire supplémentaire du même agent. ".repeat(30);
    conversation.append(intermediateStep);
  });

  await expect(widget.locator("[data-output-tokens]")).not.toHaveText(previousOutput ?? "");
  await expect(widget.locator("[data-session]")).toContainText("1 interaction");
  await expect(widget.locator("[data-output-tokens]")).toContainText("token");
});

test("agrège deux onglets sans conserver les textes ni les identifiants de page", async ({
  extensionContext,
  extensionPage,
  fixtureOrigin,
}) => {
  await expect(extensionPage.locator("eco-ia-widget [data-session]")).toContainText(
    "1 interaction",
  );
  const secondPage = await extensionContext.newPage();
  await secondPage.goto(`${fixtureOrigin}/second`);
  const secondWidget = secondPage.locator("eco-ia-widget");
  await expect(secondWidget).toBeVisible();
  await activateFixtureInteraction(secondPage);
  await expect(secondWidget.locator("[data-session]")).toContainText("1 interaction");
  await expect(secondWidget.locator("[data-day]")).toContainText("2 interactions");

  const serviceWorker =
    extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent("serviceworker"));
  const stored = await serviceWorker.evaluate(async () => ({
    local: await chrome.storage.local.get(null),
    session: await chrome.storage.session.get(null),
  }));
  const serialized = JSON.stringify(stored);
  expect(serialized).not.toContain("Question synthétique privée");
  expect(serialized).not.toContain("Réponse synthétique locale");
  expect(serialized).not.toContain(fixtureOrigin);
  expect(serialized).not.toContain("synthetic-conversation-a");
  await secondPage.close();
});
