// @vitest-environment jsdom

import { chatGptAdapter } from "../../src/adapters/chatgpt/chatgpt-adapter";
import { runAdapterContract } from "./adapter-test-helpers";

runAdapterContract({
  platform: "chatgpt",
  adapter: chatGptAdapter,
  userSelector: "[data-message-author-role='user']",
  assistantSelector: "[data-message-author-role='assistant']",
  markerAttribute: "data-conversation-id",
  expectedModel: "GPT-4o",
  expectedFallbackModel: "ChatGPT · modèle non communiqué",
  expectedPrompt: "Deuxième question synthétique.",
  expectedResponse: "Deuxième réponse synthétique.",
});
