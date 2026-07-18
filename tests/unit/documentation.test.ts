import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

describe("open-source documentation", () => {
  it("gives beginners complete install and removal instructions", async () => {
    const readme = await read("README.md");
    for (const requiredText of [
      "Google Chrome",
      "Microsoft Edge",
      "Mozilla Firefox",
      "chrome://extensions",
      "edge://extensions",
      "about:debugging",
      "Désinstaller",
      "ChatGPT",
      "Claude",
      "Gemini",
      "Mistral Le Chat",
      "Perplexity",
      "English summary",
    ]) {
      expect(readme).toContain(requiredText);
    }
  });

  it("documents transparent estimates, limitations and primary sources", async () => {
    const combined = `${await read("README.md")}\n${await read("METHODOLOGY.md")}`;
    expect(combined).toMatch(/fourchette|borne basse/iu);
    expect(combined).toMatch(/confiance/iu);
    expect(combined).toMatch(/tokens? (?:cachés|non visibles)|raisonnement caché/iu);
    expect(combined).toMatch(/ni.*(?:audit|bilan carbone certifié|réglementaire)/iu);
    for (const source of [
      "cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference",
      "arxiv.org/abs/2505.09598",
      "mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai",
      "docs.datagir.ademe.fr",
    ]) {
      expect(combined).toContain(source);
    }
  });

  it("states enforceable privacy and security commitments", async () => {
    const privacy = await read("PRIVACY.md");
    expect(privacy).toContain("Aucun prompt");
    expect(privacy).toMatch(/n’est stocké/iu);
    expect(privacy).toMatch(/aucune requête réseau/iu);
    expect(privacy).toContain("storage.local");
    expect(privacy).toContain("storage.session");
    expect(await read("SECURITY.md")).toContain("Report a vulnerability");
  });

  it("ships the MIT license and discloses the AI Wattch boundary", async () => {
    expect(await read("LICENSE")).toContain("MIT License");
    const notices = `${await read("NOTICE")}\n${await read("THIRD_PARTY_NOTICES.md")}`;
    expect(notices).toContain("AI Wattch");
    expect(notices).toMatch(/aucun code source.*incorporé/iu);
  });

  it("documents reproducible checksums and extension points", async () => {
    expect(await read("docs/release-checklist.md")).toMatch(/SHA-256|shasum -a 256/iu);
    expect(await read("docs/adding-an-adapter.md")).toContain("PlatformAdapter");
    expect(await read("docs/adding-an-impact-profile.md")).toContain("impact-profiles.json");
  });

  it("keeps CI read-only and pins official actions by commit SHA", async () => {
    const workflow = await read(".github/workflows/ci.yml");
    expect(workflow).toContain("contents: read");
    expect(workflow).toMatch(/actions\/checkout@[a-f0-9]{40}/u);
    expect(workflow).toMatch(/actions\/setup-node@[a-f0-9]{40}/u);
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run e2e");
    expect(workflow).toContain("npm run audit");
    expect(workflow).toContain("npm run secrets");
  });
});
