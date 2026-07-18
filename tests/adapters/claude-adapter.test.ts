// @vitest-environment jsdom

import { claudeAdapter } from "../../src/adapters/claude/claude-adapter";
import { runAdapterContract } from "./adapter-test-helpers";

runAdapterContract({
  platform: "claude",
  adapter: claudeAdapter,
  userSelector: "[data-testid='human-turn']",
  assistantSelector: "[data-testid='assistant-turn']",
  markerAttribute: "data-conversation-id",
  expectedModel: "Claude 3.7 Sonnet",
  expectedPrompt: "Question Claude synthétique.",
  expectedResponse: "Réponse Claude synthétique.",
});
