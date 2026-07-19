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
  expectedFallbackModel: string;
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
      expect(options.adapter.detectModel(root)).toEqual({
        label: options.expectedModel,
        observed: true,
      });
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

    it("anchors a new interaction to its user turn", () => {
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
      expect(turn?.turnElement).toBe(nextUser);
      expect(turn?.promptText).toBe("Question régénérée synthétique.");
      expect(turn?.responseText).toBe("Nouvelle réponse régénérée.");
    });

    it("keeps one interaction anchor and combines its assistant segments", () => {
      const root = requireRoot(options.adapter);
      const users = root.querySelectorAll(options.userSelector);
      const assistants = root.querySelectorAll(options.assistantSelector);
      const latestUser = users.item(users.length - 1);
      const latestAssistant = assistants.item(assistants.length - 1);
      if (!latestUser || !latestAssistant) throw new Error("MISSING_TURN_FIXTURE");

      const toolSegment = latestAssistant.cloneNode(false) as Element;
      toolSegment.textContent = "Étape intermédiaire synthétique.";
      root.append(toolSegment);

      const turn = options.adapter.readLatestTurn(root);
      expect(turn?.turnElement).toBe(latestUser);
      expect(turn?.promptText).toBe(options.expectedPrompt);
      expect(turn?.responseText).toBe(
        `${options.expectedResponse} Étape intermédiaire synthétique.`,
      );
    });

    it("reads only visible user and assistant text before the current user anchor", () => {
      const root = requireRoot(options.adapter);
      const firstUser = root.querySelector(options.userSelector);
      const firstAssistant = root.querySelector(options.assistantSelector);
      if (!firstUser || !firstAssistant) throw new Error("MISSING_TURN_FIXTURE");

      const priorUser = firstUser.cloneNode(false) as Element;
      priorUser.textContent = "Question antérieure ajoutée.";
      const priorAssistant = firstAssistant.cloneNode(false) as Element;
      priorAssistant.textContent = "Réponse antérieure ajoutée.";
      const currentUser = firstUser.cloneNode(false) as Element;
      currentUser.textContent = "Prompt actuel à exclure.";
      const currentAssistant = firstAssistant.cloneNode(false) as Element;
      currentAssistant.textContent = "Réponse actuelle à exclure.";
      const excludedControl = document.createElement("button");
      excludedControl.textContent = "Contrôle exclu.";
      priorAssistant.append(excludedControl);
      root.append(priorUser, priorAssistant, currentUser, currentAssistant);

      const context = options.adapter.readVisibleContext(root, currentUser);

      expect(context.coverage).toBe("complete");
      expect(context.text).toContain(options.expectedPrompt);
      expect(context.text).toContain(options.expectedResponse);
      expect(context.text).toContain("Question antérieure ajoutée.");
      expect(context.text).toContain("Réponse antérieure ajoutée.");
      expect(context.text).not.toContain("Contrôle exclu.");
      expect(context.text).not.toContain("Prompt actuel à exclure.");
      expect(context.text).not.toContain("Réponse actuelle à exclure.");
    });

    it("preserves exact DOM reading order for prior context", () => {
      const root = requireRoot(options.adapter);
      const userTemplate = root.querySelector(options.userSelector);
      const assistantTemplate = root.querySelector(options.assistantSelector);
      if (!userTemplate || !assistantTemplate) throw new Error("MISSING_TURN_FIXTURE");
      const makeTurn = (template: Element, text: string) => {
        const turn = template.cloneNode(false) as Element;
        turn.textContent = text;
        return turn;
      };
      const firstUser = makeTurn(userTemplate, "Utilisateur ancien un.");
      const firstAssistant = makeTurn(assistantTemplate, "Assistant ancien un.");
      const secondUser = makeTurn(userTemplate, "Utilisateur ancien deux.");
      const secondAssistant = makeTurn(assistantTemplate, "Assistant ancien deux.");
      const currentUser = makeTurn(userTemplate, "Utilisateur courant exclu.");
      const currentAssistant = makeTurn(assistantTemplate, "Assistant courant exclu.");
      root.replaceChildren(
        firstUser,
        firstAssistant,
        secondUser,
        secondAssistant,
        currentUser,
        currentAssistant,
      );

      expect(options.adapter.readVisibleContext(root, currentUser).text).toBe(
        "Utilisateur ancien un. Assistant ancien un. Utilisateur ancien deux. Assistant ancien deux.",
      );
    });

    it("detects an SPA conversation marker change without exposing it", () => {
      const before = options.adapter.getConversationMarker(document);
      const marker = document.querySelector(`[${options.markerAttribute}]`);
      if (!marker) throw new Error("MISSING_MARKER_FIXTURE");
      marker.setAttribute(options.markerAttribute, "changed-fixture-marker");
      const after = options.adapter.getConversationMarker(document);
      expect(before).not.toBe(after);
    });

    it("prefers an explicit nested conversation marker over pathname fallback", () => {
      const root = requireRoot(options.adapter);
      root.removeAttribute("data-conversation-id");
      root.removeAttribute("data-thread-id");
      root.removeAttribute("data-chat-id");
      const nestedMarker = document.createElement("section");
      nestedMarker.setAttribute(options.markerAttribute, "nested-explicit-marker");
      root.prepend(nestedMarker);

      expect(options.adapter.getConversationMarker(document)).toBe("nested-explicit-marker");
    });

    it("fails closed on unknown markup", () => {
      loadFixture(options.platform, "unknown");
      const root = options.adapter.findConversationRoot(document);
      expect(root ? options.adapter.readLatestTurn(root) : null).toBeNull();
      expect(options.adapter.detectModel(document)).toEqual({
        label: options.expectedFallbackModel,
        observed: false,
      });
    });
  });
}
