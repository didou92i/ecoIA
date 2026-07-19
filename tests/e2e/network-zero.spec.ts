import { expect, test } from "./extension.fixture";

test("ne contacte aucun réseau distant et ne persiste ni texte ni choix de modèle", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const observedRemoteRequests: string[] = [];
  const observedWebSockets: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  extensionContext.on("request", (request) => {
    if (/^(?:https?|wss?):/u.test(request.url()) && !request.url().startsWith(fixtureOrigin)) {
      observedRemoteRequests.push(request.url());
    }
  });
  const page = await extensionContext.newPage();
  page.on("websocket", (socket) => {
    if (/^wss?:/u.test(socket.url())) observedWebSockets.push(socket.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${fixtureOrigin}/network-check`);
  const widget = page.locator("eco-ia-widget");
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  await widget.getByText("Méthode et détails", { exact: true }).click();
  await widget.getByRole("combobox", { name: "Modèle appliqué" }).selectOption("openai-gpt-4-1-v1");
  await expect(widget.locator("[data-model]")).toHaveText("OpenAI GPT-4.1");
  await expect(widget.locator("[data-diagnostics]")).toContainText("Modèle · Manuel");

  const serviceWorker =
    extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent("serviceworker"));
  const stored = await serviceWorker.evaluate(async () => ({
    local: await chrome.storage.local.get(null),
    session: await chrome.storage.session.get(null),
  }));
  const serializedStorage = JSON.stringify(stored);
  expect(serializedStorage).toContain("ecoia.");
  for (const forbidden of [
    "Question synthétique privée pour le test local.",
    "Réponse synthétique locale sans donnée personnelle.",
    "Quel matériau imaginaire compose la maquette de démonstration ?",
    "La maquette fictive utilise du carton bleu réemployé.",
    "Quelle forme géométrique porte son repère synthétique ?",
    "Le repère inventé prend la forme d'un hexagone vert.",
    "Zone hors conversation",
    "openai-gpt-4-1-v1",
    "synthetic-conversation-a",
    "synthetic-conversation-b",
    "data-conversation-id",
  ]) {
    expect(serializedStorage).not.toContain(forbidden);
  }
  expect(serializedStorage).not.toMatch(/selectedProfile|manualProfile/iu);

  const remoteResources = await page.evaluate(
    (origin) =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => /^(?:https?|wss?):/u.test(url) && !url.startsWith(origin)),
    fixtureOrigin,
  );
  expect(observedRemoteRequests).toEqual([]);
  expect(observedWebSockets).toEqual([]);
  expect(remoteResources).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  await page.close();
});
