import type { SemanticAdapterSelectors } from "../semantic-adapter";

export const claudeSelectors: SemanticAdapterSelectors = {
  conversationRoots: ["main[data-testid='conversation']", "main", "[data-testid='chat-page']"],
  userTurns: ["[data-testid='human-turn']", "[data-role='user']", "[data-message-author='human']"],
  assistantTurns: [
    "[data-testid='assistant-turn']",
    "[data-role='assistant']",
    "[data-message-author='assistant']",
  ],
  modelLabels: ["[data-testid='model-selector-dropdown']", "button[aria-label*='model' i]"],
  streamingControls: ["button[aria-label*='stop response' i]", "[data-testid='stop-response']"],
  interruptedTurns: ["[data-interrupted='true']", "[data-status='interrupted']"],
  excludedContent: ["[aria-hidden='true']", "[data-ecoia-exclude]", "button", "nav"],
  conversationMarkers: ["[data-conversation-id]", "[data-thread-id]", "main"],
};
