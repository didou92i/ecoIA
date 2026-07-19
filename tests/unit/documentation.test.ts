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

  it("explains V2 precision boundaries without suggesting provider access", async () => {
    const readme = await read("README.md");
    const methodology = await read("METHODOLOGY.md");
    const privacy = await read("PRIVACY.md");
    const contributorGuide = await read("docs/adding-an-impact-profile.md");

    expect(readme).toMatch(/choix manuel[\s\S]*navigation ou[\s\S]*rechargement/iu);
    expect(readme).toMatch(/borne haute possible[\s\S]*pas[\s\S]*preuve[\s\S]*fournisseur/iu);
    expect(methodology).toContain("A — donnée fournisseur documentée pour un périmètre comparable");
    expect(methodology).toContain(
      "`high` : borne haute du prompt courant plus borne haute du contexte",
    );
    expect(privacy).toMatch(/uniquement[\s\S]*mémoire[\s\S]*jamais[\s\S]*storage/iu);
    expect(privacy).toMatch(/aucun texte[\s\S]*URL[\s\S]*identifiant/iu);
    expect(contributorGuide).toContain("npm run source-freshness");
    expect(contributorGuide).toMatch(
      /tests\/unit\/model-selection\.test\.ts[\s\S]*tests\/unit\/source-freshness\.test\.ts/iu,
    );
    expect(contributorGuide).toMatch(/chaque nouvelle source[\s\S]*test de date.*fraîcheur/iu);
  });

  it("documents reproducible v6 coefficient derivation and its residuals", async () => {
    const methodology = await read("METHODOLOGY.md");
    const contributorGuide = await read("docs/adding-an-impact-profile.md");

    expect(methodology).toContain("Version : `2026-07-19.2`");
    expect(methodology).toContain("data/how-hungry-ai-v6.json");
    expect(methodology).toContain("npm run impact-coefficients");
    expect(methodology).toMatch(/active-set NNLS/iu);
    expect(methodology).toMatch(/15 moyennes/iu);
    for (const residual of ["7,7519 %", "5,9034 %", "30,713 %"]) {
      expect(methodology).toContain(residual);
    }
    expect(contributorGuide).toContain("data/source-inventory.json");
    expect(contributorGuide).toContain("npm run impact-coefficients");
  });

  it("records evidence-gated model identity as an architecture decision", async () => {
    const adr = await read("docs/adr/0002-evidence-gated-model-profiles.md");
    const readme = await read("README.md");
    const changelog = await read("CHANGELOG.md");

    for (const requiredText of [
      "Claude 3.5 Sonnet",
      "Claude 3.5 Haiku",
      "exact model variant",
      "Gemini 2.5 Pro",
      "Claude 3.7 Sonnet ET",
      "generic",
    ]) {
      expect(adr).toContain(requiredText);
    }
    expect(readme).toMatch(/Claude 3\.5\s+Sonnet[\s\S]*Claude 3\.5 Haiku/iu);
    expect(readme).toMatch(/modèle affiché mais non documenté[\s\S]*profil générique/iu);
    expect(readme).toContain("ADR 0002");
    expect(changelog).toContain("Claude 3.5 Sonnet");
    expect(changelog).toContain("data/source-inventory.json");
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
