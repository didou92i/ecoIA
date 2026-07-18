import type { SemanticAdapterSelectors } from "../semantic-adapter";

export const perplexitySelectors: SemanticAdapterSelectors = {
  conversationRoots: ["main", "[data-testid='thread']", "[data-thread-root]"],
  userTurns: ["[data-testid='user-message']", "[data-role='user']", "[data-message-author='user']"],
  assistantTurns: [
    "[data-testid='answer']",
    "[data-role='assistant']",
    "[data-message-author='assistant']",
  ],
  modelLabels: ["[data-testid='model-selector']", "button[aria-label*='model' i]"],
  streamingControls: ["[data-testid='stop-answer']", "button[aria-label*='stop' i]"],
  interruptedTurns: ["[data-interrupted='true']", "[data-status='interrupted']"],
  excludedContent: [
    "[aria-hidden='true']",
    "[data-testid='citations']",
    "[data-testid='related-questions']",
    "[data-ecoia-exclude]",
    "button",
    "nav",
  ],
  conversationMarkers: ["[data-thread-id]", "[data-conversation-id]", "main"],
};
