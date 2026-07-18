import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { PlatformAdapter } from "../../src/adapters/adapter-contract";

interface AdapterContractOptions {
  platform: string;
  adapter: PlatformAdapter;
  userSelector: string;
  assistantSelector: string;
  markerAttribute: "data-conversation-id" | "data-thread-id";
  expectedModel: string;
  expectedPrompt: string;
  expectedResponse: string;
  excludedText?: string[];
}

function loadFixture(platform: string, name: "idle" | "streaming" | "unknown"): void {
  const html = readFileSync(
    path.resolve(process.cwd(), "tests", "fixtures", platform, `${name}.html`),
    "utf8",
  );
  document.open();
  document.write(html);
  document.close();
}

function requireRoot(adapter: PlatformAdapter): HTMLElement {
  const root = adapter.findConversationRoot(document);
  if (!root) throw new Error("MISSING_CONVERSATION_ROOT");
  return root;
}

export function runAdapterContract(options: AdapterContractOptions): void {
  describe(`${options.platform} adapter`, () => {
    beforeEach(() => loadFixture(options.platform, "idle"));

    it("extracts only the latest visible completed turn and model", () => {
      const root = requireRoot(options.adapter);
      const turn = options.adapter.readLatestTurn(root);
      expect(options.adapter.detectModel(root).label).toBe(options.expectedModel);
      expect(turn).toMatchObject({
        promptText: options.expectedPrompt,
        responseText: options.expectedResponse,
        phase: "completed",
      });
      for (const excluded of options.excludedText ?? []) {
        expect(turn?.responseText).not.toContain(excluded);
      }
    });

    it("recognizes streaming and interruption states", () => {
      loadFixture(options.platform, "streaming");
      const streamingRoot = requireRoot(options.adapter);
      expect(options.adapter.readLatestTurn(streamingRoot)?.phase).toBe("streaming");
      const assistant = streamingRoot.querySelector(options.assistantSelector);
      if (!assistant) throw new Error("MISSING_ASSISTANT_FIXTURE");
      assistant.setAttribute("data-interrupted", "true");
      expect(options.adapter.readLatestTurn(streamingRoot)?.phase).toBe("interrupted");
    });

    it("treats a regenerated assistant node as a new latest turn", () => {
      const root = requireRoot(options.adapter);
      const user = root.querySelector(options.userSelector);
      const assistant = root.querySelector(options.assistantSelector);
      if (!user || !assistant) throw new Error("MISSING_TURN_FIXTURE");
      const nextUser = user.cloneNode(false) as Element;
      nextUser.textContent = "Question régénérée synthétique.";
      const nextAssistant = assistant.cloneNode(false) as Element;
      nextAssistant.textContent = "Nouvelle réponse régénérée.";
      root.append(nextUser, nextAssistant);
      const turn = options.adapter.readLatestTurn(root);
      expect(turn?.turnElement).toBe(nextAssistant);
      expect(turn?.promptText).toBe("Question régénérée synthétique.");
      expect(turn?.responseText).toBe("Nouvelle réponse régénérée.");
    });

    it("detects an SPA conversation marker change without exposing it", () => {
      const before = options.adapter.getConversationMarker(document);
      const marker = document.querySelector(`[${options.markerAttribute}]`);
      if (!marker) throw new Error("MISSING_MARKER_FIXTURE");
      marker.setAttribute(options.markerAttribute, "changed-fixture-marker");
      const after = options.adapter.getConversationMarker(document);
      expect(before).not.toBe(after);
    });

    it("fails closed on unknown markup", () => {
      loadFixture(options.platform, "unknown");
      const root = options.adapter.findConversationRoot(document);
      expect(root ? options.adapter.readLatestTurn(root) : null).toBeNull();
    });
  });
}
