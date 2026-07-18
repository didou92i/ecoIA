import { createSemanticAdapter } from "../semantic-adapter";
import { mistralSelectors } from "./mistral-selectors";

export const mistralAdapter = createSemanticAdapter({
  platform: "mistral",
  defaultModelLabel: "Mistral — modèle non identifié",
  selectors: mistralSelectors,
});
