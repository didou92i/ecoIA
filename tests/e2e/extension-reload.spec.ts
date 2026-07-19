import { expect, test } from "./extension.fixture";

test("suspend proprement l'ancien script après le rechargement de l'extension", async ({
  extensionContext,
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  const serviceWorker =
    extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent("serviceworker"));

  await serviceWorker.evaluate(() => {
    setTimeout(() => chrome.runtime.reload(), 0);
  });
  await extensionPage.waitForTimeout(500);
  await extensionPage.evaluate(() => {
    const answer = document.querySelector<HTMLElement>("[data-answer]");
    if (!answer) throw new Error("E2E_ANSWER_FIXTURE_MISSING");
    answer.textContent += " Mise à jour après rechargement.";
  });

  await expect(widget.locator("[data-status]")).toHaveText("Mesure en pause");
});
