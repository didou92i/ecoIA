import type { SemanticAdapterSelectors } from "../semantic-adapter";

export const chatGptSelectors: SemanticAdapterSelectors = {
  conversationRoots: ["main", "[data-testid='conversation-turns']"],
  userTurns: [
    "[data-message-author-role='user']",
    "[data-testid^='conversation-turn-'] [data-role='user']",
  ],
  assistantTurns: [
    "[data-message-author-role='assistant']",
    "[data-testid^='conversation-turn-'] [data-role='assistant']",
  ],
  modelLabels: ["[data-testid='model-switcher-dropdown-button']", "button[aria-label*='model' i]"],
  streamingControls: ["[data-testid='stop-button']", "button[aria-label*='stop' i]"],
  interruptedTurns: ["[data-interrupted='true']", "[data-status='interrupted']"],
  excludedContent: ["[aria-hidden='true']", "[data-ecoia-exclude]", "button", "nav"],
  conversationMarkers: ["[data-conversation-id]", "main"],
};
