import { mistralSelectors } from "../../adapters/mistral/mistral-selectors";
import { startSemanticAdapter } from "../adapter-entry";

startSemanticAdapter({
  platform: "mistral",
  defaultModelLabel: "Mistral · modèle non communiqué",
  selectors: mistralSelectors,
});
