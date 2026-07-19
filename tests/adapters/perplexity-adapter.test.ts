// @vitest-environment jsdom

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
