import type { SemanticAdapterSelectors } from "../semantic-adapter";

export const perplexitySelectors: SemanticAdapterSelectors = {
  conversationRoots: ["main", "[data-testid='thread']", "[data-thread-root]"],
  userTurns: [
    "[class~='group/title']",
    "[class~='group'][class~='relative'][class~='flex'][class~='items-end'][class~='mb-xs']:has(button[data-testid='edit-query-button'])",
    "[data-testid='user-message']",
    "[data-role='user']",
    "[data-message-author='user']",
  ],
  assistantTurns: [
    "div[id^='markdown-content-']",
    "div[id^='Markdown-Content-']",
    "[data-testid='answer-content']",
    "[data-testid='answer']",
    "[data-role='assistant']",
    "[data-message-author='assistant']",
  ],
  trustedModelLabels: ["[data-testid='model-selector']", "button[aria-label*='model' i]"],
  modelLabels: [
    "[role='tabpanel'][data-state='active'] > div > :nth-child(2) > :nth-child(3) > :nth-child(2)",
  ],
  streamingControls: [
    "[data-testid='stop-answer']",
    "button[aria-label*='stop' i]",
    "button[aria-label*='arrêter' i]",
  ],
  interruptedTurns: ["[data-interrupted='true']", "[data-status='interrupted']"],
  excludedContent: [
    "[aria-hidden='true']",
    "[data-testid='citations']",
    "[data-testid='related-questions']",
    ".citation",
    "[data-ecoia-exclude]",
    "button",
    "nav",
  ],
  conversationMarkers: ["[data-thread-id]", "[data-conversation-id]", "main"],
};
