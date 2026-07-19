import type { ContextCoverage } from "../adapters/adapter-contract";
import { createRange, type EstimateRange } from "../shared/range";

export interface ContextTokenEstimate {
  tokens: EstimateRange;
  coverage: "none" | ContextCoverage;
  hasContext: boolean;
}

function isSafeTokenCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function createInputEnvelope(
  prompt: EstimateRange,
  context: ContextTokenEstimate,
): EstimateRange {
  if (!context.hasContext) return prompt;

  if (!isSafeTokenCount(prompt.high) || !isSafeTokenCount(context.tokens.high)) {
    throw new Error("INVALID_CONTEXT_ENVELOPE");
  }

  const high = prompt.high + context.tokens.high;
  if (!isSafeTokenCount(high)) {
    throw new Error("INVALID_CONTEXT_ENVELOPE");
  }

  return createRange(prompt.low, prompt.central, high);
}
