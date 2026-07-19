import { chatGptSelectors } from "../../adapters/chatgpt/chatgpt-selectors";
import { startSemanticAdapter } from "../adapter-entry";

startSemanticAdapter({
  platform: "chatgpt",
  defaultModelLabel: "ChatGPT · modèle non communiqué",
  selectors: chatGptSelectors,
});
