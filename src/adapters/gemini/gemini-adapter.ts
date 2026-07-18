import { createSemanticAdapter } from "../semantic-adapter";
import { geminiSelectors } from "./gemini-selectors";

export const geminiAdapter = createSemanticAdapter({
  platform: "gemini",
  defaultModelLabel: "Gemini — modèle non identifié",
  selectors: geminiSelectors,
});
