import { createSemanticAdapter } from "../semantic-adapter";
import { matchCurrentChatGptChoice } from "../../impact/model-catalog";
import { matchImpactProfileId } from "../../impact/profile-registry";
import { chatGptSelectors } from "./chatgpt-selectors";

export const chatGptAdapter = createSemanticAdapter({
  platform: "chatgpt",
  defaultModelLabel: "ChatGPT · modèle non communiqué",
  selectors: chatGptSelectors,
  modelLabelIsRecognized: (label) =>
    matchCurrentChatGptChoice(label) !== null || matchImpactProfileId("chatgpt", label) !== null,
});
