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

  it("publishes the TerritorIA identity and a non-technical installation path", async () => {
    const [readme, installation, notice, logo] = await Promise.all([
      read("README.md"),
      read("docs/INSTALLATION.md"),
      read("NOTICE"),
      readFile(
        path.join(
          projectRoot,
          "assets/logos/stacked/logo_evergreen_territoria-stacked_20260719_full-color.png",
        ),
      ),
    ]);

    expect(readme).toContain("TerritorIA");
    expect(readme).toContain("docs/INSTALLATION.md");
    expect(readme).toContain("github.com/didou92i/ecoIA");
    expect(installation).toMatch(/aucune clé API/iu);
    expect(installation).toContain("ecoia-chromium.zip");
    expect(installation).toContain("Extension context invalidated");
    expect(notice).toMatch(/TerritorIA logo[\s\S]*excluded from the MIT license/iu);
    expect(logo.byteLength).toBeGreaterThan(0);
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

  it("documents the bounded numeric recovery journal and its cleanup policy", async () => {
    const privacy = await read("PRIVACY.md");
    expect(privacy).toContain("`ecoia.journal.v1`");
    expect(privacy).toContain("256");
    expect(privacy).toMatch(/métadonnées éphémères bornées/iu);
    expect(privacy).toMatch(/aucun prompt|pas de prompt/iu);
    expect(privacy).toMatch(/aucune réponse|pas de réponse/iu);
    expect(privacy).toMatch(/aucune URL|pas d.URL/iu);
    expect(privacy).toMatch(/reprise/iu);
    expect(privacy).toMatch(/invalide|invalid/iu);
    expect(privacy).toMatch(/sans expiration arbitraire|n.expire pas/iu);
    expect(privacy).toMatch(/peut persister[\s\S]*(?:reprise|désinstallation)/iu);
    expect(privacy).toMatch(
      /agrégats numériques[\s\S]*métadonnées éphémères bornées[\s\S]*sans texte de conversation ni URL/iu,
    );
    expect(privacy).not.toMatch(/exclusivement numérique/iu);
  });

  it("states that totals start at activation and bounds session-key retention", async () => {
    const [readme, privacy] = await Promise.all([read("README.md"), read("PRIVACY.md")]);
    expect(`${readme}\n${privacy}`).toMatch(/à partir de l.activation/iu);
    expect(privacy).toContain("`ecoia.sessions.v1`");
    expect(privacy).toMatch(/30 minutes/iu);
    expect(privacy).toMatch(/prochain[\s\S]*événement accepté ou[\s\S]*réinitialisation/iu);
    expect(`${readme}\n${privacy}`).toMatch(
      /rechargement[\s\S]*réponse(?: était| est encore)? en cours[\s\S]*(?:reste|remainder|suite)[\s\S]*(?:exclu|non agrégé)/iu,
    );
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
    expect(`${readme}\n${methodology}\n${privacy}`).toMatch(
      /4 096 nœuds DOM[\s\S]*2 097 152 octets UTF-8[\s\S]*partiel/iu,
    );
    expect(`${readme}\n${privacy}`).toMatch(
      /conversation (?:observée|a d.abord été observée) vide[\s\S]*réponse[\s\S]*en cours[\s\S]*(?:nouveau|agrégée)/iu,
    );
    expect(methodology).toContain("A — donnée fournisseur documentée pour un périmètre comparable");
    expect(methodology).toContain(
      "`high` : borne haute du prompt courant plus borne haute du contexte",
    );
    expect(privacy).toMatch(/uniquement[\s\S]*mémoire[\s\S]*jamais[\s\S]*storage/iu);
    expect(privacy).toMatch(/aucun texte[\s\S]*URL[\s\S]*identifiant/iu);
    expect(privacy).toMatch(
      /observateur structurel temporaire[\s\S]*ne lit aucun texte hors conversation/iu,
    );
    expect(privacy).toMatch(/deux fois par seconde[\s\S]*empreintes éphémères salées/iu);
    expect(privacy).toMatch(/empreintes éphémères[\s\S]*ne quittent jamais le script de contenu/iu);
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
    expect(readme).toMatch(/modèle\s+affiché mais non documenté[\s\S]*profil générique/iu);
    expect(readme).toContain("ADR 0002");
    expect(changelog).toContain("Claude 3.5 Sonnet");
    expect(changelog).toContain("data/source-inventory.json");
  });

  it("separates the volatile ChatGPT catalog from dated impact evidence", async () => {
    const [readme, methodology, adr, changelog] = await Promise.all([
      read("README.md"),
      read("METHODOLOGY.md"),
      read("docs/adr/0003-separate-model-catalog-from-impact-evidence.md"),
      read("CHANGELOG.md"),
    ]);

    expect(readme).toMatch(/GPT-5\.6 Sol[\s\S]*GPT-5\.5 Instant[\s\S]*proxy D/iu);
    expect(readme).toMatch(/catalogue local[\s\S]*90 jours/iu);
    expect(methodology).toContain("data/model-catalog.json");
    expect(methodology).toContain("help.openai.com/en/articles/20001354-gpt-56-in-chatgpt");
    expect(adr).toMatch(/product availability[\s\S]*environmental (?:evidence|coefficient)/iu);
    expect(adr).toContain("openai-generic-v1");
    expect(changelog).toMatch(/Perplexity[\s\S]*citation/iu);
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

  it("ships copy-ready Chrome Web Store declarations that match the local-only architecture", async () => {
    const [listing, privacyAnswers, testInstructions, checklist] = await Promise.all([
      read("docs/chrome-web-store/listing-fr.md"),
      read("docs/chrome-web-store/privacy-answers-fr.md"),
      read("docs/chrome-web-store/test-instructions-fr.md"),
      read("docs/chrome-web-store/submission-checklist.md"),
    ]);
    const combined = `${listing}\n${privacyAnswers}\n${testInstructions}\n${checklist}`;

    for (const requiredText of [
      "TerritorIA",
      "ecoIA — Impact environnemental de l’IA",
      "Productivité",
      "https://github.com/didou92i/ecoIA/issues",
      "https://github.com/didou92i/ecoIA/blob/main/PRIVACY.md",
      "objectif unique",
      "storage",
      "Aucun code distant",
      "aucune transmission",
      "aucune vente",
      "non répertoriée",
      "publication différée",
      "manifest.json",
    ]) {
      expect(combined).toContain(requiredText);
    }
    expect(listing).toMatch(/estimations? pédagogiques?[\s\S]*pas (?:une|des) mesure/iu);
    expect(privacyAnswers).toMatch(/contenu (?:des? )?site[\s\S]*traitement local/iu);
    expect(privacyAnswers).toMatch(
      /permissions? d.hôte[\s\S]*six origines[\s\S]*cinq plateformes/iu,
    );
  });

  it("generates the required Chrome Web Store promotional image and screenshots", async () => {
    for (const [filename, width, height] of [
      ["promo-440x280.png", 440, 280],
      ["screenshot-consent-1280x800.png", 1280, 800],
      ["screenshot-impact-1280x800.png", 1280, 800],
    ] as const) {
      const png = await readFile(path.join(projectRoot, "docs/chrome-web-store/assets", filename));
      expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(width);
      expect(png.readUInt32BE(20)).toBe(height);
    }
  });
});
