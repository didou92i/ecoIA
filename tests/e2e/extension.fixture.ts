import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect, test as base, type BrowserContext, type Page } from "@playwright/test";

interface ExtensionFixtures {
  extensionContext: BrowserContext;
  extensionPage: Page;
}

interface WorkerFixtures {
  fixtureOrigin: string;
}

const projectRoot = path.resolve(import.meta.dirname, "../..");
const extensionPath = path.join(projectRoot, "dist", "chromium-e2e");
const fixturePath = path.join(projectRoot, "tests", "fixtures", "e2e", "host.html");
const fixtureRoutes = new Set([
  "/",
  "/second",
  "/observed-model",
  "/missing-model",
  "/manual-model",
  "/model-lifecycle",
  "/c/synthetic-conversation-a",
  "/c/synthetic-conversation-b",
  "/with-context",
  "/no-context",
  "/network-check",
  "/contrast",
  "/narrow-viewport",
]);

async function startFixtureServer(): Promise<{ origin: string; server: Server }> {
  const fixture = await readFile(fixturePath);
  const server = createServer((request, response) => {
    if (request.url === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    if (request.url && fixtureRoutes.has(request.url)) {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-length": fixture.length,
        "content-type": "text/html; charset=utf-8",
        "x-content-type-options": "nosniff",
      });
      response.end(fixture);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("FIXTURE_SERVER_ADDRESS_MISSING");
  return { origin: `http://127.0.0.1:${address.port}`, server };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

export async function activateFixtureInteraction(page: Page): Promise<void> {
  await page.evaluate(() => {
    const conversation = document.querySelector<HTMLElement>("[data-conversation-id]");
    if (!conversation) throw new Error("E2E_CONVERSATION_FIXTURE_MISSING");
    if (conversation.querySelector("[data-activated-after-ecoia]")) return;
    if (location.pathname === "/no-context") {
      for (const turn of conversation.querySelectorAll(
        "[data-message-author-role='user'], [data-message-author-role='assistant']",
      )) {
        turn.setAttribute("data-ecoia-exclude", "");
      }
    }
    const user = document.createElement("article");
    user.setAttribute("data-message-author-role", "user");
    user.setAttribute("data-activated-after-ecoia", "");
    user.textContent = "Question synthétique observée après activation.";
    const assistant = document.createElement("article");
    assistant.setAttribute("data-message-author-role", "assistant");
    assistant.setAttribute("data-activated-after-ecoia", "");
    assistant.textContent = "Réponse synthétique observée après activation.";
    conversation.append(user, assistant);
  });
  await expect(page.locator("eco-ia-widget [data-session]")).toContainText("1 interaction");
}

export async function grantMeasurementConsent(context: BrowserContext): Promise<void> {
  const serviceWorker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      "ecoia.measurement-consent.v1": { version: 1, noticeVersion: 1, granted: true },
    });
  });
}

export const test = base.extend<ExtensionFixtures, WorkerFixtures>({
  fixtureOrigin: [
    async ({ browserName: _browserName }, use) => {
      const { origin, server } = await startFixtureServer();
      await use(origin);
      await closeServer(server);
    },
    { scope: "worker" },
  ],
  extensionContext: async ({ browserName: _browserName }, use, testInfo) => {
    const context = await chromium.launchPersistentContext(testInfo.outputPath("profile"), {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const browserErrors: string[] = [];
    const observePage = (page: Page) => {
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(`console:${message.text()}`);
      });
      page.on("pageerror", (error) => browserErrors.push(`pageerror:${error.message}`));
    };
    for (const page of context.pages()) observePage(page);
    context.on("page", observePage);
    context.on("requestfailed", (request) => {
      browserErrors.push(
        `requestfailed:${request.url()}:${request.failure()?.errorText ?? "unknown"}`,
      );
    });
    await use(context);
    await context.close();
    expect(browserErrors, "Erreurs navigateur non masquées").toEqual([]);
  },
  extensionPage: async ({ extensionContext, fixtureOrigin }, use) => {
    await grantMeasurementConsent(extensionContext);
    const page = extensionContext.pages()[0] ?? (await extensionContext.newPage());
    await page.goto(fixtureOrigin);
    await expect(page.locator("eco-ia-widget")).toBeVisible();
    await activateFixtureInteraction(page);
    await use(page);
  },
});

export { expect };
