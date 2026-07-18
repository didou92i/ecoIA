import { expect, test } from "./extension.fixture";

test("n'émet aucune requête réseau depuis l'extension", async ({
  extensionContext,
  fixtureOrigin,
}) => {
  const observedRemoteRequests: string[] = [];
  extensionContext.on("request", (request) => {
    if (/^(?:https?|wss?):/u.test(request.url()) && !request.url().startsWith(fixtureOrigin)) {
      observedRemoteRequests.push(request.url());
    }
  });
  const page = await extensionContext.newPage();
  await page.goto(`${fixtureOrigin}/network-check`);
  await expect(page.locator("eco-ia-widget")).toBeVisible();
  await page.waitForTimeout(750);
  expect(observedRemoteRequests).toEqual([]);
  await page.close();
});
