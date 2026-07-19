import { perplexityModelLabelConfiguration } from "../../adapters/perplexity/perplexity-model-label";
import { perplexitySelectors } from "../../adapters/perplexity/perplexity-selectors";
import { startSemanticAdapter } from "../adapter-entry";

startSemanticAdapter({
  platform: "perplexity",
  defaultModelLabel: "Perplexity · modèle non communiqué",
  selectors: perplexitySelectors,
  ...perplexityModelLabelConfiguration,
});
