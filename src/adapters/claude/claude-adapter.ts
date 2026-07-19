import { createSemanticAdapter } from "../semantic-adapter";
import { claudeSelectors } from "./claude-selectors";

export const claudeAdapter = createSemanticAdapter({
  platform: "claude",
  defaultModelLabel: "Claude · modèle non communiqué",
  selectors: claudeSelectors,
});
