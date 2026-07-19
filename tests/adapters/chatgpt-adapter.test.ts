// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { chatGptAdapter } from "../../src/adapters/chatgpt/chatgpt-adapter";
import { runAdapterContract } from "./adapter-test-helpers";

runAdapterContract({
  platform: "chatgpt",
  adapter: chatGptAdapter,
  userSelector: "[data-message-author-role='user']",
  assistantSelector: "[data-message-author-role='assistant']",
  markerAttribute: "data-conversation-id",
  expectedModel: "Instantanée",
  expectedFallbackModel: "ChatGPT · modèle non communiqué",
  expectedPrompt: "Deuxième question synthétique.",
  expectedResponse: "Deuxième réponse synthétique.",
});

describe("chatgpt model controls", () => {
  it("keeps an unknown label from the trusted model control but rejects a generic menu decoy", () => {
    document.body.innerHTML = `
      <main>
        <button type="button" aria-haspopup="menu">Plus</button>
        <button type="button" data-testid="model-switcher-dropdown-button">GPT-5.7</button>
      </main>
    `;
    const root = chatGptAdapter.findConversationRoot(document);
    if (!root) throw new Error("MISSING_CHATGPT_ROOT");

    expect(chatGptAdapter.detectModel(root)).toEqual({ label: "GPT-5.7", observed: true });

    root.querySelector("[data-testid='model-switcher-dropdown-button']")?.remove();
    expect(chatGptAdapter.detectModel(root)).toEqual({
      label: "ChatGPT · modèle non communiqué",
      observed: false,
    });
  });
});
