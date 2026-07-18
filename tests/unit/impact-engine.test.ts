import { describe, expect, it } from "vitest";

import type { VisibleTokenEstimate } from "../../src/shared/contracts";
import { createRange } from "../../src/shared/range";
import { calculateIndicatorEstimate, estimateImpact } from "../../src/impact/impact-engine";
import type { PromptMedianEstimator, TokenLinearEstimator } from "../../src/impact/profile-types";

const tokens: VisibleTokenEstimate = {
  input: createRange(900, 1_000, 1_100),
  output: createRange(450, 500, 550),
  source: "estimated",
};

describe("impact engine", () => {
  it("propagates token and profile uncertainty for a linear estimator", () => {
    const estimator: TokenLinearEstimator = {
      estimator: "token-linear",
      unit: "Wh",
      base: 1,
      inputPer1k: 2,
      outputPer1k: 4,
      lowMultiplier: 0.5,
      highMultiplier: 2,
      confidence: "C",
      sourceId: "test-source",
    };
    expect(calculateIndicatorEstimate(estimator, tokens, "test-profile").range).toEqual({
      low: 2.3,
      central: 5,
      high: 10.8,
    });
  });

  it("keeps a published prompt median independent from a fake token-linear claim", () => {
    const estimator: PromptMedianEstimator = {
      estimator: "prompt-median",
      unit: "ml",
      perPrompt: 10,
      lowMultiplier: 0.5,
      highMultiplier: 2,
      confidence: "A",
      sourceId: "test-source",
    };
    expect(calculateIndicatorEstimate(estimator, tokens, "test-profile").range).toEqual({
      low: 5,
      central: 10,
      high: 20,
    });
  });

  it("returns zero for an empty visible interaction", () => {
    const empty: VisibleTokenEstimate = {
      input: createRange(0, 0, 0),
      output: createRange(0, 0, 0),
      source: "estimated",
    };
    expect(estimateImpact("google-gemini-apps-median-v1", empty).energyWh.range).toEqual({
      low: 0,
      central: 0,
      high: 0,
    });
  });

  it("preserves per-indicator provenance for Mistral", () => {
    const estimate = estimateImpact("mistral-large-2-disclosure-v1", tokens);
    expect(estimate.waterMl.confidence).toBe("A");
    expect(estimate.carbonG.confidence).toBe("A");
    expect(estimate.energyWh.confidence).toBe("D");
    expect(estimate.energyWh.sourceProfileId).toBe("generic-assistant-v1");
    expect(estimate.waterMl.sourceProfileId).toBe("mistral-large-2-disclosure-v1");
  });

  it.each([
    ["openai-gpt-4o-v1", 100, 300, 0.423],
    ["openai-gpt-4o-v1", 1_000, 1_000, 1.215],
    ["openai-gpt-4o-v1", 10_000, 1_500, 2.875],
    ["openai-gpt-4-1-v1", 100, 300, 0.871],
    ["openai-gpt-4-1-v1", 1_000, 1_000, 3.161],
    ["openai-gpt-4-1-v1", 10_000, 1_500, 4.833],
    ["anthropic-claude-3-7-sonnet-v1", 100, 300, 0.95],
    ["anthropic-claude-3-7-sonnet-v1", 1_000, 1_000, 2.989],
    ["anthropic-claude-3-7-sonnet-v1", 10_000, 1_500, 5.671],
  ])(
    "reproduces the published query shape for %s",
    (profileId, inputCount, outputCount, publishedEnergyWh) => {
      const observed: VisibleTokenEstimate = {
        input: createRange(inputCount, inputCount, inputCount),
        output: createRange(outputCount, outputCount, outputCount),
        source: "observed",
      };
      const central = estimateImpact(profileId, observed).energyWh.range.central;
      expect(Math.abs(central - publishedEnergyWh) / publishedEnergyWh).toBeLessThan(0.08);
    },
  );

  it("keeps provider prompt medians at their disclosed central values", () => {
    const gemini = estimateImpact("google-gemini-apps-median-v1", tokens);
    expect(gemini.energyWh.range.central).toBe(0.24);
    expect(gemini.waterMl.range.central).toBe(0.26);
    expect(gemini.carbonG.range.central).toBe(0.03);

    const mistral = estimateImpact("mistral-large-2-disclosure-v1", tokens);
    expect(mistral.waterMl.range.central).toBe(45);
    expect(mistral.carbonG.range.central).toBe(1.14);
  });

  it("rejects unknown profile identifiers", () => {
    expect(() => estimateImpact("invented-profile", tokens)).toThrow("UNKNOWN_IMPACT_PROFILE");
  });
});
