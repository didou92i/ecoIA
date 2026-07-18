import { describe, expect, it } from "vitest";

import rawRegistry from "../../data/impact-profiles.json";
import {
  impactRegistry,
  resolveImpactProfileId,
  validateImpactRegistry,
} from "../../src/impact/profile-registry";

interface MutableSource {
  url: string;
  publicationDate: string;
  scope: string;
  limitations: string[];
}

interface MutableProfile {
  id: string;
  indicators: {
    energyWh: Record<string, unknown>;
  };
}

interface MutableRegistry {
  sources: MutableSource[];
  profiles: MutableProfile[];
}

function requireFirst<T>(items: T[]): T {
  const item = items[0];
  if (!item) throw new Error("MISSING_TEST_FIXTURE");
  return item;
}

describe("impact profile registry", () => {
  it("loads the versioned published registry", () => {
    expect(impactRegistry.methodologyVersion).toBe("2026-07-18.1");
    expect(impactRegistry.profiles.length).toBeGreaterThanOrEqual(8);
    expect(impactRegistry.sources.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["chatgpt", "GPT-4o", "openai-gpt-4o-v1"],
    ["chatgpt", "GPT-4.1", "openai-gpt-4-1-v1"],
    ["claude", "Claude 3.7 Sonnet", "anthropic-claude-3-7-sonnet-v1"],
    ["gemini", "Gemini 2.5 Pro", "google-gemini-apps-median-v1"],
    ["mistral", "Mistral Large 2", "mistral-large-2-disclosure-v1"],
    ["perplexity", "Claude 3.7 Sonnet", "anthropic-claude-3-7-sonnet-v1"],
    ["perplexity", "model not disclosed", "perplexity-generic-v1"],
  ] as const)("resolves %s / %s", (platform, model, expectedProfileId) => {
    expect(resolveImpactProfileId(platform, model)).toBe(expectedProfileId);
  });

  it("uses a platform-specific fallback for an unknown model", () => {
    expect(resolveImpactProfileId("chatgpt", "Future model")).toBe("openai-generic-v1");
    expect(resolveImpactProfileId("mistral", "Future model")).toBe("mistral-generic-v1");
  });

  it.each<[string, (copy: MutableRegistry) => void]>([
    ["non-HTTPS source", (copy) => (requireFirst(copy.sources).url = "http://example.com")],
    ["invalid source date", (copy) => (requireFirst(copy.sources).publicationDate = "2025/01/01")],
    ["missing source scope", (copy) => (requireFirst(copy.sources).scope = "")],
    ["missing source limits", (copy) => (requireFirst(copy.sources).limitations = [])],
    ["unsupported unit", (copy) => (requireFirst(copy.profiles).indicators.energyWh.unit = "kWh")],
    [
      "invalid multiplier",
      (copy) => (requireFirst(copy.profiles).indicators.energyWh.lowMultiplier = 2),
    ],
    [
      "circular proxy",
      (copy) => {
        const firstProfile = requireFirst(copy.profiles);
        firstProfile.indicators.energyWh = {
          estimator: "model-proxy",
          unit: "Wh",
          profileId: firstProfile.id,
          indicator: "energyWh",
          lowMultiplier: 0.5,
          highMultiplier: 2,
          confidence: "D",
          sourceId: "how-hungry-v6",
        };
      },
    ],
  ])("rejects %s", (_name, mutate) => {
    const copy = structuredClone(rawRegistry) as unknown as MutableRegistry;
    mutate(copy);
    expect(() => validateImpactRegistry(copy)).toThrow("INVALID_IMPACT_REGISTRY");
  });
});
