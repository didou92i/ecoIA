import { geminiSelectors } from "../../adapters/gemini/gemini-selectors";
import { startSemanticAdapter } from "../adapter-entry";

startSemanticAdapter({
  platform: "gemini",
  defaultModelLabel: "Gemini · modèle non communiqué",
  selectors: geminiSelectors,
});
