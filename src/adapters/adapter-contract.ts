import type { PlatformId } from "../shared/contracts";

export interface DetectedModel {
  label: string;
}

export interface VisibleTurnSnapshot {
  turnElement: Element;
  promptText: string;
  responseText: string;
  phase: "streaming" | "completed" | "interrupted";
}

export interface PlatformAdapter {
  readonly platform: PlatformId;
  detectModel(root: ParentNode): DetectedModel;
  findConversationRoot(document: Document): HTMLElement | null;
  readLatestTurn(root: HTMLElement): VisibleTurnSnapshot | null;
  getConversationMarker(document: Document): string | null;
  subscribe(root: HTMLElement, listener: () => void): () => void;
}
