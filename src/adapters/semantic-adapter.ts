import type { PlatformId } from "../shared/contracts";
import { tokenCalibration } from "../token/calibration";
import type { PlatformAdapter, VisibleTurnSnapshot } from "./adapter-contract";
import { subscribeToScopedMutations } from "./dom-observer";
import { selectRecentNormalizedUtf8Text } from "./visible-context";

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

export interface SemanticAdapterConfiguration {
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

const utf8Encoder = new TextEncoder();

export const visibleContextDomNodeLimit = 4_096;

interface DomWorkBudget {
  remaining: number;
}

function consumeDomWork(budget: DomWorkBudget): boolean {
  if (budget.remaining <= 0) return false;
  budget.remaining -= 1;
  return true;
}

export function findPreviousNodeWithin(
  root: Node,
  current: Node,
  maximumMoves: number,
): { node: Node | null; moves: number; exhausted: boolean } {
  let cursor = current;
  let moves = 0;
  const moveTo = (next: Node): boolean => {
    if (moves >= maximumMoves) return false;
    cursor = next;
    moves += 1;
    return true;
  };

  const previousSibling = cursor.previousSibling;
  if (previousSibling) {
    if (!moveTo(previousSibling)) return { node: null, moves, exhausted: true };
    while (cursor.lastChild) {
      const lastChild = cursor.lastChild;
      if (!moveTo(lastChild)) return { node: null, moves, exhausted: true };
    }
    return { node: cursor, moves, exhausted: false };
  }

  const parent = cursor.parentNode;
  if (!parent || parent === root) return { node: null, moves, exhausted: false };
  if (!moveTo(parent)) return { node: null, moves, exhausted: true };
  return { node: cursor, moves, exhausted: false };
}

function elementIsHidden(element: Element): boolean {
  return (
    element.hasAttribute("hidden") ||
    element.getAttribute("aria-hidden") === "true" ||
    element.getAttribute("inert") !== null ||
    (element instanceof HTMLElement &&
      (element.style.display === "none" || element.style.visibility === "hidden"))
  );
}

function textBelongsToVisibleTurn(
  node: Text,
  root: HTMLElement,
  turnSelectors: string[],
  excludedSelectors: string[],
  budget: DomWorkBudget,
): boolean | null {
  let belongsToTurn = false;
  for (let current = node.parentElement; current; current = current.parentElement) {
    if (!consumeDomWork(budget)) return null;
    if (elementIsHidden(current)) return false;
    if (excludedSelectors.some((selector) => current.matches(selector))) return false;
    if (turnSelectors.some((selector) => current.matches(selector))) belongsToTurn = true;
    if (current === root) return belongsToTurn;
  }
  return false;
}

function readRecentVisibleContext(
  root: HTMLElement,
  turnElement: Element,
  turnSelectors: string[],
  excludedSelectors: string[],
  maximumUtf8Bytes: number,
): { text: string; coverage: "complete" | "partial" } {
  const selectedNewestFirst: string[] = [];
  let remainingUtf8Bytes = Math.max(0, maximumUtf8Bytes);
  const formatSelected = () => selectedNewestFirst.slice().reverse().join(" ");
  if (!root.contains(turnElement)) return { text: "", coverage: "partial" };

  const budget: DomWorkBudget = { remaining: visibleContextDomNodeLimit };
  let current: Node = turnElement;
  while (budget.remaining > 0) {
    const previous = findPreviousNodeWithin(root, current, budget.remaining);
    budget.remaining -= previous.moves;
    if (previous.exhausted) return { text: formatSelected(), coverage: "partial" };
    const node = previous.node;
    if (!node) return { text: formatSelected(), coverage: "complete" };
    current = node;
    if (!(node instanceof Text)) continue;
    const belongsToVisibleTurn = textBelongsToVisibleTurn(
      node,
      root,
      turnSelectors,
      excludedSelectors,
      budget,
    );
    if (belongsToVisibleTurn === null) {
      return { text: formatSelected(), coverage: "partial" };
    }
    if (!belongsToVisibleTurn) continue;
    const separatorBytes = selectedNewestFirst.length > 0 ? 1 : 0;
    if (remainingUtf8Bytes <= separatorBytes) {
      return { text: formatSelected(), coverage: "partial" };
    }
    const fragment = selectRecentNormalizedUtf8Text(node.data, remainingUtf8Bytes - separatorBytes);
    if (fragment.text) {
      selectedNewestFirst.push(fragment.text);
      remainingUtf8Bytes -= utf8Encoder.encode(fragment.text).byteLength + separatorBytes;
    }
    if (fragment.coverage === "partial") {
      return { text: formatSelected(), coverage: "partial" };
    }
  }
  return { text: formatSelected(), coverage: "partial" };
}

function markerFromDocument(document: Document, selectors: string[]): string | null {
  const explicitMarker = queryAll(document, selectors)
    .map(
      (element) =>
        element.getAttribute("data-conversation-id") ??
        element.getAttribute("data-thread-id") ??
        element.getAttribute("data-chat-id"),
    )
    .find((marker): marker is string => Boolean(marker));
  const path = document.location?.pathname ?? "/";
  if (path && path !== "/") return path.slice(0, 512);
  if (explicitMarker) {
    return explicitMarker.slice(0, 512);
  }
  return null;
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
    readVisibleContext(root, turnElement) {
      return readRecentVisibleContext(
        root,
        turnElement,
        [...selectors.userTurns, ...selectors.assistantTurns],
        selectors.excludedContent,
        tokenCalibration.maximumUtf8Bytes,
      );
    },
    getConversationMarker(document) {
      return markerFromDocument(document, selectors.conversationMarkers);
    },
    subscribe(root, listener) {
      return subscribeToScopedMutations(root, listener);
    },
  };
}
