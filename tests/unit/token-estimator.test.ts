import { describe, expect, it } from "vitest";

import codeFixtures from "../fixtures/tokens/code.json";
import latinFixtures from "../fixtures/tokens/latin.json";
import multilingualFixtures from "../fixtures/tokens/multilingual.json";
import { estimateVisibleTokens, type TokenizerFamily } from "../../src/token/token-estimator";

const fixtures = [...latinFixtures, ...codeFixtures, ...multilingualFixtures];
const exactReferenceFamilies = ["openai", "claude", "mistral"] as const;

describe("visible token estimator", () => {
  it("returns an exact zero range for empty and whitespace-only text", () => {
    expect(estimateVisibleTokens("", "generic")).toEqual({ low: 0, central: 0, high: 0 });
    expect(estimateVisibleTokens(" \n\t ", "openai")).toEqual({ low: 0, central: 0, high: 0 });
  });

  it.each(fixtures)("covers calibrated references for $id", (fixture) => {
    for (const family of exactReferenceFamilies) {
      const estimate = estimateVisibleTokens(fixture.text, family);
      const reference = fixture.references[family];
      expect(estimate.low, `${fixture.id}/${family} lower bound`).toBeLessThanOrEqual(reference);
      expect(estimate.high, `${fixture.id}/${family} upper bound`).toBeGreaterThanOrEqual(
        reference,
      );
    }

    const geminiEstimate = estimateVisibleTokens(fixture.text, "gemini");
    expect(geminiEstimate.low).toBeLessThanOrEqual(fixture.references.gemini.high);
    expect(geminiEstimate.high).toBeGreaterThanOrEqual(fixture.references.gemini.low);
  });

  it.each(["openai", "claude", "gemini", "mistral", "generic"] as TokenizerFamily[])(
    "returns an ordered deterministic range for %s",
    (family) => {
      const text = codeFixtures[0]?.text;
      if (!text) throw new Error("MISSING_CODE_FIXTURE");
      const first = estimateVisibleTokens(text, family);
      expect(estimateVisibleTokens(text, family)).toEqual(first);
      expect(first.low).toBeGreaterThanOrEqual(0);
      expect(first.low).toBeLessThanOrEqual(first.central);
      expect(first.central).toBeLessThanOrEqual(first.high);
    },
  );

  it("is monotonic as visible text grows", () => {
    const short = estimateVisibleTokens("Une phrase courte.", "generic");
    const long = estimateVisibleTokens("Une phrase courte. ".repeat(50), "generic");
    expect(long.low).toBeGreaterThan(short.low);
    expect(long.central).toBeGreaterThan(short.central);
    expect(long.high).toBeGreaterThan(short.high);
  });

  it("rejects text larger than two MiB without truncating silently", () => {
    expect(() => estimateVisibleTokens("é".repeat(1_048_577), "generic")).toThrow(
      "TEXT_SIZE_LIMIT_EXCEEDED",
    );
  });
});
