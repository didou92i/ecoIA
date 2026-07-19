// @vitest-environment jsdom

import { geminiAdapter } from "../../src/adapters/gemini/gemini-adapter";
import { runAdapterContract } from "./adapter-test-helpers";

runAdapterContract({
  platform: "gemini",
  adapter: geminiAdapter,
  userSelector: "user-query",
  assistantSelector: "model-response",
  markerAttribute: "data-conversation-id",
  expectedModel: "Gemini 2.5 Pro",
  expectedFallbackModel: "Gemini · modèle non communiqué",
  expectedPrompt: "Question Gemini synthétique.",
  expectedResponse: "Réponse Gemini synthétique.",
});
