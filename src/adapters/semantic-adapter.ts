import type { PlatformId } from "../shared/contracts";
import type { PlatformAdapter, VisibleTurnSnapshot } from "./adapter-contract";
import { subscribeToScopedMutations } from "./dom-observer";

export interface SemanticAdapterSelectors {
  conversationRoots: string[];
  userTurns: string[];
  assistantTurns: string[];
  modelLabels: string[];
  streamingControls: string[];
  interruptedTurns: string[];
  excludedContent: string[];
  conversationMarkers: string[];
}

interface SemanticAdapterConfiguration {
  platform: PlatformId;
  defaultModelLabel: string;
  selectors: SemanticAdapterSelectors;
}

function isHidden(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (
      current.hasAttribute("hidden") ||
      current.getAttribute("aria-hidden") === "true" ||
      current.getAttribute("inert") !== null ||
      (current instanceof HTMLElement &&
        (current.style.display === "none" || current.style.visibility === "hidden"))
    ) {
      return true;
    }
  }
  return false;
}

function queryAll(root: ParentNode, selectors: string[]): Element[] {
  const seen = new Set<Element>();
  const results: Element[] = [];
  for (const selector of selectors) {
    for (const element of root.querySelectorAll(selector)) {
      if (!seen.has(element) && !isHidden(element)) {
        seen.add(element);
        results.push(element);
      }
    }
  }
  return results.sort((left, right) => {
    if (left === right) return 0;
    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

function queryFirst(root: ParentNode, selectors: string[]): HTMLElement | null {
  return (
    (queryAll(root, selectors).find((element) => element instanceof HTMLElement) as
      | HTMLElement
      | undefined) ?? null
  );
}

function textIsExcluded(node: Text, excludedSelectors: string[]): boolean {
  const parent = node.parentElement;
  if (!parent || isHidden(parent)) return true;
  return excludedSelectors.some((selector) => parent.closest(selector));
}

export function readVisibleText(container: Element, excludedSelectors: string[]): string {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const fragments: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof Text) || textIsExcluded(node, excludedSelectors)) continue;
    const normalized = node.data.replace(/\s+/gu, " ").trim();
    if (normalized) fragments.push(normalized);
  }
  return fragments.join(" ").trim();
}

function appearsBefore(left: Element, right: Element): boolean {
  return Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function markerFromDocument(document: Document, selectors: string[]): string | null {
  const markerElement = queryFirst(document, selectors);
  const explicitMarker =
    markerElement?.getAttribute("data-conversation-id") ??
    markerElement?.getAttribute("data-thread-id") ??
    markerElement?.getAttribute("data-chat-id");
  if (explicitMarker) return explicitMarker.slice(0, 512);
  const path = document.location?.pathname;
  return path && path !== "/" ? path.slice(0, 512) : null;
}

export function createSemanticAdapter(
  configuration: SemanticAdapterConfiguration,
): PlatformAdapter {
  const { selectors } = configuration;
  return {
    platform: configuration.platform,
    detectModel(root) {
      const observedLabel = queryFirst(root, selectors.modelLabels)?.textContent?.trim();
      return observedLabel
        ? { label: observedLabel, observed: true }
        : { label: configuration.defaultModelLabel, observed: false };
    },
    findConversationRoot(document) {
      return queryFirst(document, selectors.conversationRoots);
    },
    readLatestTurn(root): VisibleTurnSnapshot | null {
      const assistants = queryAll(root, selectors.assistantTurns);
      const assistant = assistants.at(-1);
      if (!assistant) return null;
      const user = queryAll(root, selectors.userTurns)
        .filter((candidate) => appearsBefore(candidate, assistant))
        .at(-1);
      if (!user) return null;
      const promptText = readVisibleText(user, selectors.excludedContent);
      const responseText = assistants
        .filter((candidate) => appearsBefore(user, candidate))
        .map((candidate) => readVisibleText(candidate, selectors.excludedContent))
        .filter(Boolean)
        .join(" ");
      if (!promptText && !responseText) return null;
      const interrupted = selectors.interruptedTurns.some(
        (selector) => assistant.matches(selector) || assistant.querySelector(selector),
      );
      const streaming =
        !interrupted &&
        (assistant.getAttribute("aria-busy") === "true" ||
          assistant.getAttribute("data-is-streaming") === "true" ||
          queryFirst(root, selectors.streamingControls) !== null);
      return {
        turnElement: user,
        promptText,
        responseText,
        phase: interrupted ? "interrupted" : streaming ? "streaming" : "completed",
      };
    },
    getConversationMarker(document) {
      return markerFromDocument(document, selectors.conversationMarkers);
    },
    subscribe(root, listener) {
      return subscribeToScopedMutations(root, listener);
    },
  };
}
