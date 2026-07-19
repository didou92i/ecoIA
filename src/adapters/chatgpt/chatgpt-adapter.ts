import { createSemanticAdapter } from "../semantic-adapter";
import { chatGptSelectors } from "./chatgpt-selectors";

export const chatGptAdapter = createSemanticAdapter({
  platform: "chatgpt",
  defaultModelLabel: "ChatGPT · modèle non communiqué",
  selectors: chatGptSelectors,
});
