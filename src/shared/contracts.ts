import type { EstimateRange } from "./range";

export const platformIds = ["chatgpt", "claude", "gemini", "mistral", "perplexity"] as const;
export type PlatformId = (typeof platformIds)[number];

export const interactionPhases = ["streaming", "completed", "interrupted"] as const;
export type InteractionPhase = (typeof interactionPhases)[number];

export interface VisibleTokenEstimate {
  input: EstimateRange;
  output: EstimateRange;
  source: "estimated" | "observed";
}

export interface NumericInteractionEvent {
  version: 1;
  eventId: string;
  tabSessionId: string;
  sequence: number;
  platform: PlatformId;
  modelProfileId: string;
  phase: InteractionPhase;
  tokens: VisibleTokenEstimate;
  generatedAt: number;
}
