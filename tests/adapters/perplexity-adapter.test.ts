// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { perplexityAdapter } from "../../src/adapters/perplexity/perplexity-adapter";
import { runAdapterContract } from "./adapter-test-helpers";

runAdapterContract({
  platform: "perplexity",
  adapter: perplexityAdapter,
  userSelector: "[data-testid='user-message']",
  assistantSelector: "[data-testid='answer']",
  markerAttribute: "data-thread-id",
  expectedModel: "Claude 3.7 Sonnet",
  expectedFallbackModel: "Perplexity · modèle non communiqué",
  expectedPrompt: "Question Perplexity synthétique.",
  expectedResponse: "Réponse narrative Perplexity.",
  excludedText: ["Source à exclure", "Question liée à exclure"],
});

describe("perplexity current DOM", () => {
  it("extracts the latest active tabpanel turn without status, sources, follow-ups or controls", () => {
    const html = readFileSync(
      path.resolve(process.cwd(), "tests", "fixtures", "perplexity", "current.html"),
      "utf8",
    );
    document.open();
    document.write(html);
    document.close();

    const root = perplexityAdapter.findConversationRoot(document);
    if (!root) throw new Error("MISSING_CURRENT_PERPLEXITY_ROOT");

    const turn = perplexityAdapter.readLatestTurn(root);
    expect({
      model: perplexityAdapter.detectModel(root),
      promptText: turn?.promptText ?? null,
      responseText: turn?.responseText ?? null,
      phase: turn?.phase ?? null,
    }).toEqual({
      model: {
        label: "GPT-5.6 Terra Thinking",
        observed: true,
      },
      promptText: "J’aimerais en savoir plus sur l’histoire de la langue française.",
      responseText: "Le français est une langue romane née de l’évolution du latin parlé en Gaule.",
      phase: "completed",
    });

    expect(turn?.responseText).not.toContain("2 étapes terminées");
    expect(turn?.responseText).not.toContain("Préparé avec");
    expect(turn?.responseText).not.toContain("Source CEFAN à exclure");
    expect(turn?.responseText).not.toContain("Source Wikipédia à exclure");
    expect(turn?.responseText).not.toContain("Comment le français moderne s’est-il formé ?");
    expect(turn?.responseText).not.toContain("Copier la réponse");
    expect(turn?.responseText).not.toContain("Ancienne réponse Perplexity à ignorer.");
  });

  it("rejects a positional status decoy as a model label", () => {
    document.body.innerHTML = `
      <main>
        <section role="tabpanel" data-state="active">
          <div>
            <div><div class="group/title">Question synthétique.</div></div>
            <div>
              <div></div>
              <div></div>
              <div><div>Réponse synthétique.</div><div>2 étapes terminées</div></div>
            </div>
          </div>
        </section>
      </main>
    `;
    const root = perplexityAdapter.findConversationRoot(document);
    if (!root) throw new Error("MISSING_PERPLEXITY_ROOT");

    expect(perplexityAdapter.detectModel(root)).toEqual({
      label: "Perplexity · modèle non communiqué",
      observed: false,
    });

    const positionalLabel = root.querySelector(
      "[role='tabpanel'] > div > :nth-child(2) > :nth-child(3) > :nth-child(2)",
    );
    if (!positionalLabel) throw new Error("MISSING_POSITIONAL_LABEL");
    positionalLabel.textContent = "GPT signifie Generative Pre-trained Transformer";
    expect(perplexityAdapter.detectModel(root)).toEqual({
      label: "Perplexity · modèle non communiqué",
      observed: false,
    });

    positionalLabel.textContent = "GPT-5 est un modèle de langage";
    expect(perplexityAdapter.detectModel(root)).toEqual({
      label: "Perplexity · modèle non communiqué",
      observed: false,
    });
  });
});
