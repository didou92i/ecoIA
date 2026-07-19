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
    const answer = document.querySelector<HTMLElement>(
      "[data-activated-after-ecoia][data-message-author-role='assistant']",
    );
    if (!answer) throw new Error("E2E_ANSWER_FIXTURE_MISSING");
    answer.textContent += " Mise à jour après rechargement.";
  });

  await expect(widget.locator("[data-status]")).toHaveText("Mesure en pause");
});

test("ne recompte pas une réponse terminée après rechargement de la page", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(widget.locator("[data-day]")).toContainText("1 interaction");

  await extensionPage.reload();

  await expect(widget).toBeVisible();
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  await expect(widget.locator("[data-day]")).toContainText("1 interaction");
  await expect(widget.locator("[data-session]")).toHaveText("Aucune donnée");
});

test("exclut la suite d'une réponse en cours rechargée puis mesure le tour suivant", async ({
  extensionPage,
}) => {
  const widget = extensionPage.locator("eco-ia-widget");
  await expect(widget.locator("[data-day]")).toContainText("1 interaction");

  await extensionPage.evaluate(() => {
    const conversation = document.querySelector<HTMLElement>("[data-conversation-id]");
    if (!conversation) throw new Error("E2E_CONVERSATION_FIXTURE_MISSING");
    sessionStorage.setItem("ecoia-e2e-streaming-reload", "true");
    const user = document.createElement("article");
    user.setAttribute("data-message-author-role", "user");
    user.textContent = "Question synthétique rechargée en cours de réponse.";
    const assistant = document.createElement("article");
    assistant.setAttribute("data-message-author-role", "assistant");
    assistant.setAttribute("data-streaming-reload-answer", "");
    assistant.setAttribute("aria-busy", "true");
    assistant.textContent = "Réponse synthétique partielle avant rechargement.";
    const stop = document.createElement("button");
    stop.type = "button";
    stop.setAttribute("data-testid", "stop-button");
    stop.textContent = "Arrêter";
    conversation.append(user, assistant, stop);
  });
  await expect(widget.locator("[data-status]")).toHaveText("Réponse en cours…");
  await expect(widget.locator("[data-day]")).toContainText("2 interactions");

  await extensionPage.reload();

  await expect(widget).toBeVisible();
  await expect(widget.locator("[data-status]")).toHaveText("Réponse en cours…");
  await expect(widget.locator("[data-day]")).toContainText("2 interactions");
  await expect(widget.locator("[data-session]")).toHaveText("Aucune donnée");

  await extensionPage.evaluate(() => {
    const assistant = document.querySelector<HTMLElement>("[data-streaming-reload-answer]");
    if (!assistant) throw new Error("E2E_STREAMING_ANSWER_FIXTURE_MISSING");
    assistant.textContent += " Suite synthétique terminée après rechargement.";
    assistant.removeAttribute("aria-busy");
    document.querySelector("[data-testid='stop-button']")?.remove();
  });
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  await expect(widget.locator("[data-day]")).toContainText("2 interactions");
  await expect(widget.locator("[data-session]")).toHaveText("Aucune donnée");

  await extensionPage.evaluate(() => {
    const conversation = document.querySelector<HTMLElement>("[data-conversation-id]");
    if (!conversation) throw new Error("E2E_CONVERSATION_FIXTURE_MISSING");
    sessionStorage.removeItem("ecoia-e2e-streaming-reload");
    const user = document.createElement("article");
    user.setAttribute("data-message-author-role", "user");
    user.textContent = "Question synthétique réellement nouvelle.";
    const assistant = document.createElement("article");
    assistant.setAttribute("data-message-author-role", "assistant");
    assistant.textContent = "Réponse synthétique réellement nouvelle.";
    conversation.append(user, assistant);
  });
  await expect(widget.locator("[data-day]")).toContainText("3 interactions");
  await expect(widget.locator("[data-session]")).toContainText("1 interaction");
});
