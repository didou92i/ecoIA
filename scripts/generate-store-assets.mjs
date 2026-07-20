import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const projectRoot = process.cwd();
const assetDirectory = path.join(projectRoot, "docs", "chrome-web-store", "assets");
const promoSource = path.join(assetDirectory, "promo-440x280.svg");
const extensionPath = path.join(projectRoot, "dist", "chromium-e2e");
const fixturePath = path.join(projectRoot, "tests", "fixtures", "store", "host.html");

async function generatePromotionalImage() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
    await page.goto(pathToFileURL(promoSource).href);
    await page.screenshot({ path: path.join(assetDirectory, "promo-440x280.png") });
  } finally {
    await browser.close();
  }
}

async function startFixtureServer() {
  const fixture = await readFile(fixturePath);
  const server = createServer((request, response) => {
    if (request.url === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    if (request.url === "/") {
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
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("STORE_FIXTURE_ADDRESS_MISSING");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function generateStoreScreenshots() {
  const { server, origin } = await startFixtureServer();
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(origin);
    const widget = page.locator("eco-ia-widget");
    await widget.locator("[data-consent]").waitFor({ state: "visible" });
    await page.screenshot({
      path: path.join(assetDirectory, "screenshot-consent-1280x800.png"),
    });

    await widget.locator("[data-consent-accept]").click();
    await widget.locator("[data-measurement-body]").waitFor({ state: "visible" });
    await page.evaluate(() => {
      const conversation = document.querySelector("[data-conversation-id]");
      if (!conversation) throw new Error("STORE_FIXTURE_CONVERSATION_MISSING");
      const user = document.createElement("article");
      user.setAttribute("data-message-author-role", "user");
      user.textContent = "Donne-moi trois conseils simples pour utiliser une IA avec discernement.";
      const assistant = document.createElement("article");
      assistant.setAttribute("data-message-author-role", "assistant");
      assistant.textContent =
        "Formule une demande précise, réutilise les réponses utiles et garde une validation humaine pour les décisions importantes.";
      conversation.append(user, assistant);
    });
    await page
      .locator("eco-ia-widget [data-session]")
      .filter({ hasText: "1 interaction" })
      .waitFor({ state: "visible" });
    await page.screenshot({
      path: path.join(assetDirectory, "screenshot-impact-1280x800.png"),
    });
  } finally {
    await context.close();
    await closeServer(server);
  }
}

await mkdir(assetDirectory, { recursive: true });
await generatePromotionalImage();
await generateStoreScreenshots();
