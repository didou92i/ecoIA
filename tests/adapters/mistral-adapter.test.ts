// @vitest-environment jsdom

import { mistralAdapter } from "../../src/adapters/mistral/mistral-adapter";
import { runAdapterContract } from "./adapter-test-helpers";

runAdapterContract({
  platform: "mistral",
  adapter: mistralAdapter,
  userSelector: "[data-message-author='user']",
  assistantSelector: "[data-message-author='assistant']",
  markerAttribute: "data-conversation-id",
  expectedModel: "Mistral Large 2",
  expectedPrompt: "Question Mistral synthétique.",
  expectedResponse: "Réponse Mistral synthétique.",
  excludedText: ["Pièce jointe exclue."],
});
