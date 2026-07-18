import { createSemanticAdapter } from "../semantic-adapter";
import { perplexitySelectors } from "./perplexity-selectors";

export const perplexityAdapter = createSemanticAdapter({
  platform: "perplexity",
  defaultModelLabel: "Perplexity — modèle non divulgué",
  selectors: perplexitySelectors,
});
