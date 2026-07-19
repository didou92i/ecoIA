import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { impactRegistry } from "../../src/impact/profile-registry";

const queryShapes = [
  { id: "short", inputTokens: 100, outputTokens: 300 },
  { id: "medium", inputTokens: 1_000, outputTokens: 1_000 },
  { id: "long", inputTokens: 10_000, outputTokens: 1_500 },
] as const;

const sourceModels = [
  {
    profileId: "openai-gpt-4o-v1",
    label: "GPT-4o",
    provider: "openaiAzure",
    means: [0.423, 1.215, 2.875],
    standardDeviations: [0.085, 0.241, 0.421],
    maximumRelativeError: 1e-12,
  },
  {
    profileId: "openai-gpt-4-1-v1",
    label: "GPT-4.1",
    provider: "openaiAzure",
    means: [0.871, 3.161, 4.833],
    standardDeviations: [0.302, 0.515, 0.65],
    maximumRelativeError: 0.077519,
  },
  {
    profileId: "anthropic-claude-3-7-sonnet-v1",
    label: "Claude 3.7 Sonnet",
    provider: "anthropicAws",
    means: [0.95, 2.989, 5.671],
    standardDeviations: [0.04, 0.201, 0.302],
    maximumRelativeError: 1e-12,
  },
  {
    profileId: "anthropic-claude-3-5-sonnet-v1",
    label: "Claude 3.5 Sonnet",
    provider: "anthropicAws",
    means: [0.973, 3.638, 7.772],
    standardDeviations: [0.066, 0.256, 0.345],
    maximumRelativeError: 0.059034,
  },
  {
    profileId: "anthropic-claude-3-5-haiku-v1",
    label: "Claude 3.5 Haiku",
    provider: "anthropicAws",
    means: [0.975, 4.464, 8.01],
    standardDeviations: [0.063, 0.283, 0.338],
    maximumRelativeError: 0.30713,
  },
] as const;

describe("How Hungry is AI? v6 coefficient derivation", () => {
  it("versions all 15 raw Table 4 values independently from fitted coefficients", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("../../data/how-hungry-ai-v6.json", import.meta.url), "utf8"),
    );

    expect(fixture).toMatchObject({
      version: "arxiv-2505.09598v6-table1-table4",
      source: {
        version: "v6",
        publicationDate: "2025-05-14",
        revisionDate: "2025-11-24",
        accessedDate: "2026-07-19",
      },
      queryShapes,
      infrastructure: {
        openaiAzure: {
          pue: 1.12,
          onsiteWueLitresPerKwh: 0.3,
          offsiteWueLitresPerKwh: 4.35,
          carbonIntensityKgPerKwh: 0.35,
        },
        anthropicAws: {
          pue: 1.14,
          onsiteWueLitresPerKwh: 0.18,
          offsiteWueLitresPerKwh: 5.11,
          carbonIntensityKgPerKwh: 0.287,
        },
      },
    });
    expect(fixture.models).toEqual(
      sourceModels.map(({ maximumRelativeError: _tolerance, ...model }) => ({
        profileId: model.profileId,
        label: model.label,
        provider: model.provider,
        energyWh: model.means.map((mean, index) => ({
          mean,
          standardDeviation: model.standardDeviations[index],
        })),
      })),
    );
  });

  it("uses a pure active-set NNLS derivation and reports bounded residuals", async () => {
    const { deriveImpactCoefficients } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const derived = deriveImpactCoefficients({
      queryShapes,
      infrastructure: {
        openaiAzure: {
          pue: 1.12,
          onsiteWueLitresPerKwh: 0.3,
          offsiteWueLitresPerKwh: 4.35,
          carbonIntensityKgPerKwh: 0.35,
        },
        anthropicAws: {
          pue: 1.14,
          onsiteWueLitresPerKwh: 0.18,
          offsiteWueLitresPerKwh: 5.11,
          carbonIntensityKgPerKwh: 0.287,
        },
      },
      models: sourceModels.map((model) => ({
        profileId: model.profileId,
        provider: model.provider,
        energyWh: model.means.map((mean) => ({ mean })),
      })),
    });

    for (const model of sourceModels) {
      const profile = derived.profiles[model.profileId];
      expect(profile).toBeDefined();
      expect(profile?.fit.maximumRelativeError).toBeLessThanOrEqual(model.maximumRelativeError);
      expect(profile?.energy.base).toBeGreaterThanOrEqual(0);
      expect(profile?.energy.inputPer1k).toBeGreaterThanOrEqual(0);
      expect(profile?.energy.outputPer1k).toBeGreaterThanOrEqual(0);
    }
    expect(derived.profiles["openai-gpt-4-1-v1"]?.energy).toEqual({
      base: 0,
      inputPer1k: expect.closeTo(0.01494668117519, 14),
      outputPer1k: expect.closeTo(3.123414581066381, 14),
    });
    expect(derived.profiles["anthropic-claude-3-5-sonnet-v1"]?.fit.method).toBe("active-set-nnls");
    expect(derived.profiles["anthropic-claude-3-5-haiku-v1"]?.fit.maximumRelativeError).toBeCloseTo(
      0.30712982338662664,
      14,
    );
  });

  it("keeps the runtime registry aligned with every derived energy, water and carbon coefficient", async () => {
    const { deriveImpactCoefficients, readSourceFixture } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const derived = deriveImpactCoefficients(await readSourceFixture());

    for (const [profileId, expected] of Object.entries(derived.profiles)) {
      const profile = impactRegistry.profiles.find((candidate) => candidate.id === profileId);
      expect(profile, profileId).toBeDefined();
      for (const [indicator, coefficients] of Object.entries({
        energyWh: expected.energy,
        waterMl: expected.water,
        carbonG: expected.carbon,
      })) {
        const estimator = profile?.indicators[indicator as "energyWh" | "waterMl" | "carbonG"];
        expect(estimator?.estimator, `${profileId}:${indicator}`).toBe("token-linear");
        if (estimator?.estimator !== "token-linear") continue;
        expect(estimator.base).toBeCloseTo(coefficients.base, 14);
        expect(estimator.inputPer1k).toBeCloseTo(coefficients.inputPer1k, 14);
        expect(estimator.outputPer1k).toBeCloseTo(coefficients.outputPer1k, 14);
      }
    }
  });
});
