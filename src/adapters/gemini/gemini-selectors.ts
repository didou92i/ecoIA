import type { SemanticAdapterSelectors } from "../semantic-adapter";

export const geminiSelectors: SemanticAdapterSelectors = {
  conversationRoots: ["main", "[data-test-id='conversation']", ".conversation-container"],
  userTurns: ["user-query", "[data-test-id='user-query']", ".user-query-container"],
  assistantTurns: ["model-response", "[data-test-id='model-response']", ".model-response"],
  modelLabels: ["[data-test-id='model-switcher']", "button[aria-label*='model' i]"],
  streamingControls: ["button[aria-label*='stop response' i]", "[data-test-id='stop-button']"],
  interruptedTurns: ["[data-interrupted='true']", "[data-status='interrupted']"],
  excludedContent: [
    "[aria-hidden='true']",
    "[data-ecoia-exclude]",
    ".source-list",
    "button",
    "nav",
  ],
  conversationMarkers: ["[data-conversation-id]", "[data-chat-id]", "main"],
};
