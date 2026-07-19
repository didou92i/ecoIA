import { describe, expect, it } from "vitest";

import rawRegistry from "../../data/impact-profiles.json";
import {
  impactRegistry,
  matchImpactProfileId,
  resolveImpactProfileId,
  validateImpactRegistry,
} from "../../src/impact/profile-registry";

interface MutableSource {
  url: string;
  publicationDate: string;
  revisionDate?: string;
  scope: string;
  limitations: string[];
}

interface MutableProfile {
  id: string;
  modelAliases?: {
    aliases: string[];
    providerPrefixes: string[];
  };
  indicators: {
    energyWh: Record<string, unknown>;
  };
}

interface MutableRegistry {
  sources: MutableSource[];
  profiles: MutableProfile[];
  platformFallbacks: Record<string, string>;
}

function requireFirst<T>(items: T[]): T {
  const item = items[0];
  if (!item) throw new Error("MISSING_TEST_FIXTURE");
  return item;
}

describe("impact profile registry", () => {
  it("loads the versioned published registry", () => {
    expect(impactRegistry.methodologyVersion).toBe("2026-07-19.2");
    expect(impactRegistry.profiles.length).toBeGreaterThanOrEqual(8);
    expect(impactRegistry.sources.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["chatgpt", "GPT-4o", "openai-gpt-4o-v1"],
    ["chatgpt", "OpenAI · GPT-4o", "openai-gpt-4o-v1"],
    ["chatgpt", "GPT-4.1", "openai-gpt-4-1-v1"],
    ["chatgpt", "OpenAI GPT-4.1", "openai-gpt-4-1-v1"],
    ["claude", "Claude 3.7 Sonnet", "anthropic-claude-3-7-sonnet-v1"],
    ["claude", "Anthropic Claude 3.7 Sonnet", "anthropic-claude-3-7-sonnet-v1"],
    ["claude", "Claude 3.5 Sonnet", "anthropic-claude-3-5-sonnet-v1"],
    ["claude", "Anthropic Claude 3.5 Haiku", "anthropic-claude-3-5-haiku-v1"],
    ["gemini", "Gemini Apps", "google-gemini-apps-median-v1"],
    ["gemini", "Google Gemini Apps", "google-gemini-apps-median-v1"],
    ["mistral", "Mistral Large 2", "mistral-large-2-disclosure-v1"],
    ["perplexity", "Claude 3.7 Sonnet", "anthropic-claude-3-7-sonnet-v1"],
    ["perplexity", "GPT-4o", "openai-gpt-4o-v1"],
    ["perplexity", "Claude 3.5 Sonnet", "anthropic-claude-3-5-sonnet-v1"],
    ["perplexity", "model not disclosed", "perplexity-generic-v1"],
  ] as const)("resolves %s / %s", (platform, model, expectedProfileId) => {
    expect(resolveImpactProfileId(platform, model)).toBe(expectedProfileId);
  });

  it.each([
    ["chatgpt", "GPT-4o mini"],
    ["chatgpt", "OpenAI GPT-4o mini"],
    ["chatgpt", "GPT-4.1 mini"],
    ["chatgpt", "GPT-4.1 nano"],
    ["chatgpt", "GPT-4o 2024-08-06"],
    ["chatgpt", "GPT-4.1 2025-04-14"],
    ["claude", "Claude 3.7 Sonnet Extended Thinking"],
    ["claude", "Anthropic Claude 3.7 Sonnet Extended Thinking"],
    ["claude", "Claude 3.7 Sonnet 2025-02-24"],
    ["claude", "Claude 3.5"],
    ["claude", "Claude 3.5 Sonnet Extended Thinking"],
    ["claude", "Claude 3.5 Haiku 2025-06-01"],
    ["gemini", "Gemini 2.5 Pro"],
    ["gemini", "Gemini 2.5 Flash"],
    ["perplexity", "GPT-4o mini"],
    ["perplexity", "GPT-4.1 nano"],
    ["perplexity", "Claude 3.7 Sonnet Extended Thinking"],
    ["perplexity", "Claude 3.7 Sonnet 2025-02-24"],
    ["perplexity", "Claude 3.5"],
    ["perplexity", "Claude 3.5 Sonnet Extended Thinking"],
  ] as const)("fails closed for unsupported %s label %s", (platform, model) => {
    expect(matchImpactProfileId(platform, model)).toBeNull();
    expect(resolveImpactProfileId(platform, model)).toBe(
      impactRegistry.platformFallbacks[platform],
    );
  });

  it("uses structured aliases instead of free substring matchers", () => {
    for (const profile of rawRegistry.profiles) {
      expect(profile).not.toHaveProperty("modelMatchers");
      expect(profile).toHaveProperty("modelAliases");
      expect(profile.modelAliases).toEqual({
        aliases: expect.any(Array),
        providerPrefixes: expect.any(Array),
      });
    }
  });

  it("uses a platform-specific fallback for an unknown model", () => {
    expect(resolveImpactProfileId("chatgpt", "Future model")).toBe("openai-generic-v1");
    expect(resolveImpactProfileId("mistral", "Future model")).toBe("mistral-generic-v1");
  });

  it("uses grade-D generic fallbacks for every platform", () => {
    for (const fallbackId of Object.values(impactRegistry.platformFallbacks)) {
      const fallback = impactRegistry.profiles.find((profile) => profile.id === fallbackId);
      if (!fallback) throw new Error("MISSING_PLATFORM_FALLBACK");
      expect(fallback.indicators.energyWh.confidence).toBe("D");
      expect(fallback.indicators.waterMl.confidence).toBe("D");
      expect(fallback.indicators.carbonG.confidence).toBe("D");
    }
    expect(impactRegistry.platformFallbacks.gemini).toBe("google-generic-v1");
  });

  it("rejects a grade-D fallback assigned to another platform", () => {
    const copy = structuredClone(rawRegistry) as unknown as MutableRegistry;
    copy.platformFallbacks.chatgpt = "anthropic-generic-v1";

    expect(() => validateImpactRegistry(copy)).toThrow("INVALID_IMPACT_REGISTRY");
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
      "unsafe empty model alias",
      (copy) => {
        requireFirst(copy.profiles).modelAliases = {
          aliases: [""],
          providerPrefixes: [],
        };
      },
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
