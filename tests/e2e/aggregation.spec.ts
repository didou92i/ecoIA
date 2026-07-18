import { expect, test } from "./extension.fixture";

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
