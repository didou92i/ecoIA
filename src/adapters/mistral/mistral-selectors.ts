import type { SemanticAdapterSelectors } from "../semantic-adapter";

export const mistralSelectors: SemanticAdapterSelectors = {
  conversationRoots: ["main", "[data-testid='conversation']", "[data-chat-root]"],
  userTurns: ["[data-message-author='user']", "[data-role='user']", "[data-testid='user-message']"],
  assistantTurns: [
    "[data-message-author='assistant']",
    "[data-role='assistant']",
    "[data-testid='assistant-message']",
  ],
  modelLabels: ["[data-testid='model-selector']", "button[aria-label*='model' i]"],
  streamingControls: ["[data-testid='stop-generation']", "button[aria-label*='stop' i]"],
  interruptedTurns: ["[data-interrupted='true']", "[data-status='interrupted']"],
  excludedContent: [
    "[aria-hidden='true']",
    "[data-ecoia-exclude]",
    "[data-testid='attachments']",
    "button",
    "nav",
  ],
  conversationMarkers: ["[data-conversation-id]", "[data-chat-id]", "main"],
};
