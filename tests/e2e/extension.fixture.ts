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
    const page = extensionContext.pages()[0] ?? (await extensionContext.newPage());
    await page.goto(fixtureOrigin);
    await expect(page.locator("eco-ia-widget")).toBeVisible();
    await use(page);
  },
});

export { expect };
