import { createSemanticAdapter } from "../semantic-adapter";
import { perplexityModelLabelConfiguration } from "./perplexity-model-label";
import { perplexitySelectors } from "./perplexity-selectors";

export const perplexityAdapter = createSemanticAdapter({
  platform: "perplexity",
  defaultModelLabel: "Perplexity · modèle non communiqué",
  selectors: perplexitySelectors,
  ...perplexityModelLabelConfiguration,
});
