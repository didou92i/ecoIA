import type { PlatformId } from "../shared/contracts";

export interface DetectedModel {
  label: string;
  observed: boolean;
}

export interface VisibleTurnSnapshot {
  /** Stable DOM anchor for one user interaction, including all following assistant segments. */
  turnElement: Element;
  promptText: string;
  responseText: string;
  phase: "streaming" | "completed" | "interrupted";
}

export type ContextCoverage = "complete" | "partial";

export interface VisibleContextSnapshot {
  text: string;
  coverage: ContextCoverage;
}

export interface PlatformAdapter {
  readonly platform: PlatformId;
  detectModel(root: ParentNode): DetectedModel;
  findConversationRoot(document: Document): HTMLElement | null;
  readLatestTurn(root: HTMLElement): VisibleTurnSnapshot | null;
  readVisibleContext(root: HTMLElement, turnElement: Element): VisibleContextSnapshot;
  getConversationMarker(document: Document): string | null;
  subscribe(root: HTMLElement, listener: () => void): () => void;
}
