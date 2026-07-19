import { readFile } from "node:fs/promises";
import path from "node:path";

import { activateFixtureInteraction, expect, test } from "./extension.fixture";

test("rejette les routes locales hors allowlist", async ({ fixtureOrigin }) => {
  const response = await fetch(`${fixtureOrigin}/telemetry`);
  expect(response.status).toBe(404);
});

test("ne contacte aucun réseau distant et ne persiste ni texte ni choix de modèle", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const serviceWorker =
    extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent("serviceworker"));
  await serviceWorker.evaluate(() => {
    const scope = globalThis as typeof globalThis & { __ecoiaObservedWebSockets?: string[] };
    const NativeWebSocket = scope.WebSocket;
    scope.__ecoiaObservedWebSockets = [];
    scope.WebSocket = new Proxy(NativeWebSocket, {
      construct(target, argumentsList, newTarget) {
        scope.__ecoiaObservedWebSockets?.push(String(argumentsList[0]));
        return Reflect.construct(target, argumentsList, newTarget);
      },
    });
  });

  const observedNetworkRequests: string[] = [];
  const observedPageWebSockets: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const page = await extensionContext.newPage();
  const allowedNavigationUrl = `${fixtureOrigin}/network-check`;
  extensionContext.on("request", (request) => {
    if (!/^(?:https?|wss?):/u.test(request.url())) return;
    const isAllowedMainNavigation =
      request.url() === allowedNavigationUrl &&
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame();
    if (!isAllowedMainNavigation) observedNetworkRequests.push(request.url());
  });
  page.on("websocket", (socket) => {
    if (/^wss?:/u.test(socket.url())) observedPageWebSockets.push(socket.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(allowedNavigationUrl);
  const widget = page.locator("eco-ia-widget");
  await expect(widget.locator("[data-status]")).toHaveText("Réponse mesurée");
  await activateFixtureInteraction(page);
  await widget.getByText("Méthode et détails", { exact: true }).click();
  await widget
    .getByRole("combobox", { name: "Modèle appliqué" })
    .selectOption("chatgpt-gpt-5-6-sol");
  await expect(widget.locator("[data-model]")).toHaveText("GPT-5.6 Sol · proxy D");
  await expect(widget.locator("[data-diagnostics]")).toContainText("Modèle · Manuel");

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
    "chatgpt-gpt-5-6-sol",
    "synthetic-conversation-a",
    "synthetic-conversation-b",
    "data-conversation-id",
  ]) {
    expect(serializedStorage).not.toContain(forbidden);
  }
  expect(serializedStorage).not.toMatch(/selectedProfile|manualProfile/iu);

  const observedWorkerWebSockets = await serviceWorker.evaluate(
    () =>
      (globalThis as typeof globalThis & { __ecoiaObservedWebSockets?: string[] })
        .__ecoiaObservedWebSockets ?? [],
  );
  const backgroundBundle = await readFile(
    path.resolve(import.meta.dirname, "../../dist/chromium-e2e/background.js"),
    "utf8",
  );
  expect(backgroundBundle).not.toMatch(/\bWebSocket\b/u);

  const remoteResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /^(?:https?|wss?):/u.test(url)),
  );
  expect(observedNetworkRequests).toEqual([]);
  expect(observedPageWebSockets).toEqual([]);
  expect(observedWorkerWebSockets).toEqual([]);
  expect(remoteResources).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  await page.close();
});
