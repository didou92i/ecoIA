import { describe, expect, it } from "vitest";

import type { ContextTokenEstimate } from "../../src/token/context-envelope";
import { createInputEnvelope } from "../../src/token/context-envelope";
import { createRange } from "../../src/shared/range";

const prompt = createRange(100, 120, 140);

function contextEstimate(hasContext: boolean, high = 60): ContextTokenEstimate {
  return {
    tokens: createRange(0, 0, high),
    coverage: hasContext ? "complete" : "none",
    hasContext,
  };
}

describe("input context envelope", () => {
  it("returns the prompt range unchanged when visible context is absent", () => {
    expect(createInputEnvelope(prompt, contextEstimate(false))).toBe(prompt);
  });

  it("adds only the contextual upper bound when visible context is present", () => {
    expect(createInputEnvelope(prompt, contextEstimate(true))).toEqual({
      low: 100,
      central: 120,
      high: 200,
    });
  });

  it("preserves valid zero and large safe-integer ranges", () => {
    expect(createInputEnvelope(createRange(0, 0, 0), contextEstimate(true, 0))).toEqual({
      low: 0,
      central: 0,
      high: 0,
    });

    expect(
      createInputEnvelope(createRange(0, 0, Number.MAX_SAFE_INTEGER - 1), contextEstimate(true, 1)),
    ).toEqual({ low: 0, central: 0, high: Number.MAX_SAFE_INTEGER });
  });

  it("rejects an unsafe contextual upper-bound sum without saturating", () => {
    expect(() =>
      createInputEnvelope(createRange(0, 0, Number.MAX_SAFE_INTEGER), contextEstimate(true, 1)),
    ).toThrow("INVALID_CONTEXT_ENVELOPE");
  });
});
