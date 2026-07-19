import { claudeSelectors } from "../../adapters/claude/claude-selectors";
import { startSemanticAdapter } from "../adapter-entry";

startSemanticAdapter({
  platform: "claude",
  defaultModelLabel: "Claude · modèle non communiqué",
  selectors: claudeSelectors,
});
