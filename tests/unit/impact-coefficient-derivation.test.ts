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
    label: "GPT-4o (Mar '25)",
    provider: "openaiAzure",
    means: [0.423, 1.215, 2.875],
    meanRaw: ["0.423", "1.215", "2.875"],
    standardDeviations: [0.085, 0.241, 0.421],
    standardDeviationRaw: ["0.085", "0.241", "0.421"],
    maximumRelativeError: 1e-12,
  },
  {
    profileId: "openai-gpt-4-1-v1",
    label: "GPT-4.1",
    provider: "openaiAzure",
    means: [0.871, 3.161, 4.833],
    meanRaw: ["0.871", "3.161", "4.833"],
    standardDeviations: [0.302, 0.515, 0.65],
    standardDeviationRaw: ["0.302", "0515", "0.650"],
    maximumRelativeError: 0.077519,
  },
  {
    profileId: "anthropic-claude-3-7-sonnet-v1",
    label: "Claude 3.7 Sonnet",
    provider: "anthropicAws",
    means: [0.95, 2.989, 5.671],
    meanRaw: ["0.950", "2.989", "5.671"],
    standardDeviations: [0.04, 0.201, 0.302],
    standardDeviationRaw: ["0.040", "0.201", "0.302"],
    maximumRelativeError: 1e-12,
  },
  {
    profileId: "anthropic-claude-3-5-sonnet-v1",
    label: "Claude 3.5 Sonnet",
    provider: "anthropicAws",
    means: [0.973, 3.638, 7.772],
    meanRaw: ["0.973", "3.638", "7.772"],
    standardDeviations: [0.066, 0.256, 0.345],
    standardDeviationRaw: ["0.066", "0.256", "0.345"],
    maximumRelativeError: 0.059034,
  },
  {
    profileId: "anthropic-claude-3-5-haiku-v1",
    label: "Claude 3.5 Haiku",
    provider: "anthropicAws",
    means: [0.975, 4.464, 8.01],
    meanRaw: ["0.975", "4.464", "8.010"],
    standardDeviations: [0.063, 0.283, 0.338],
    standardDeviationRaw: ["0.063", "0.283", "0.338"],
    maximumRelativeError: 0.30713,
  },
] as const;

async function readFixture(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(new URL("../../data/how-hungry-ai-v6.json", import.meta.url), "utf8"),
  );
}

async function readRegistry(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(new URL("../../data/impact-profiles.json", import.meta.url), "utf8"),
  );
}

describe("How Hungry is AI? v6 coefficient derivation", () => {
  it("versions all 15 raw Table 4 values independently from fitted coefficients", async () => {
    const fixture = await readFixture();

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
        energyWh: model.means.map((meanNormalized, index) => ({
          meanRaw: model.meanRaw[index],
          meanNormalized,
          meanNormalizationStatus: "exact-decimal-transcription",
          standardDeviationRaw: model.standardDeviationRaw[index],
          standardDeviationNormalized: model.standardDeviations[index],
          standardDeviationNormalizationStatus:
            model.standardDeviationRaw[index] === "0515"
              ? "inferred-missing-decimal-point"
              : "exact-decimal-transcription",
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
        label: model.label,
        provider: model.provider,
        energyWh: model.means.map((meanNormalized) => ({
          meanRaw: String(meanNormalized),
          meanNormalized,
          meanNormalizationStatus: "exact-decimal-transcription",
          standardDeviationRaw: "0.1",
          standardDeviationNormalized: 0.1,
          standardDeviationNormalizationStatus: "exact-decimal-transcription",
        })),
      })),
      version: "arxiv-2505.09598v6-table1-table4",
      source: {
        id: "how-hungry-v6",
        title:
          "How Hungry is AI? Benchmarking Energy, Water, and Carbon Footprint of LLM Inference",
        url: "https://arxiv.org/abs/2505.09598v6",
        version: "v6",
        publicationDate: "2025-05-14",
        revisionDate: "2025-11-24",
        accessedDate: "2026-07-19",
      },
      normalizationNotes: [],
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

  it.each([
    ["string PUE", "openaiAzure", "pue", "1.12"],
    ["zero PUE", "openaiAzure", "pue", 0],
    ["string CIF", "anthropicAws", "carbonIntensityKgPerKwh", "0.287"],
  ])("rejects %s before deriving coefficients", async (_label, provider, field, invalidValue) => {
    const { deriveImpactCoefficients } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const fixture = await readFixture();
    const infrastructure = fixture.infrastructure as Record<string, Record<string, unknown>>;
    const providerInfrastructure = infrastructure[provider];
    if (!providerInfrastructure) throw new Error("MISSING_TEST_INFRASTRUCTURE");
    providerInfrastructure[field] = invalidValue;
    expect(() => deriveImpactCoefficients(fixture)).toThrow("INVALID_SOURCE_FIXTURE");
  });

  it("rejects a non-identifiable design with identical query shapes", async () => {
    const { deriveImpactCoefficients } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const fixture = await readFixture();
    const shapes = fixture.queryShapes as Array<Record<string, unknown>>;
    const firstShape = shapes[0];
    if (!firstShape) throw new Error("MISSING_TEST_QUERY_SHAPE");
    shapes[1] = structuredClone(firstShape);
    expect(() => deriveImpactCoefficients(fixture)).toThrow("INVALID_SOURCE_FIXTURE");
  });

  it.each(["missing", "additional"])("rejects a %s source model", async (variant) => {
    const { deriveImpactCoefficients } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const fixture = await readFixture();
    const models = fixture.models as Array<Record<string, unknown>>;
    if (variant === "missing") models.pop();
    else models.push({ ...structuredClone(models[0]), profileId: "unexpected-profile-v1" });
    expect(() => deriveImpactCoefficients(fixture)).toThrow("INVALID_SOURCE_FIXTURE");
  });

  it("rejects duplicate profile IDs before they can overwrite derived output", async () => {
    const { deriveImpactCoefficients } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const fixture = await readFixture();
    const models = fixture.models as Array<Record<string, unknown>>;
    models[1] = { ...structuredClone(models[1]), profileId: models[0]?.profileId };
    expect(() => deriveImpactCoefficients(fixture)).toThrow("INVALID_SOURCE_FIXTURE");
  });

  it("rejects a non-finite published mean", async () => {
    const { deriveImpactCoefficients } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const fixture = await readFixture();
    const models = fixture.models as Array<{ energyWh: Array<Record<string, unknown>> }>;
    const firstValue = models[0]?.energyWh[0];
    if (!firstValue) throw new Error("MISSING_TEST_MEAN");
    firstValue.meanNormalized = Number.POSITIVE_INFINITY;
    expect(() => deriveImpactCoefficients(fixture)).toThrow("INVALID_SOURCE_FIXTURE");
  });

  it("requires the scientific profile set bidirectionally between fixture and registry", async () => {
    const { deriveImpactCoefficients, findRegistryDrift } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const fixture = await readFixture();
    const derived = deriveImpactCoefficients(fixture);
    const missingRegistry = await readRegistry();
    const missingProfiles = missingRegistry.profiles as Array<Record<string, unknown>>;
    missingRegistry.profiles = missingProfiles.filter(
      (profile) => profile.id !== "openai-gpt-4o-v1",
    );
    expect(findRegistryDrift(missingRegistry, derived, "how-hungry-v6")).toContain(
      "openai-gpt-4o-v1:missing-profile",
    );

    const extraRegistry = await readRegistry();
    const extraProfiles = extraRegistry.profiles as Array<Record<string, unknown>>;
    const generic = extraProfiles.find((profile) => profile.id === "generic-assistant-v1");
    if (!generic) throw new Error("MISSING_GENERIC_PROFILE_FIXTURE");
    generic.derivationId = "how-hungry-v6";
    expect(findRegistryDrift(extraRegistry, derived, "how-hungry-v6")).toContain(
      "generic-assistant-v1:unexpected-profile",
    );
  });

  it("reports non-finite registry coefficients as drift", async () => {
    const { deriveImpactCoefficients, findRegistryDrift } = await import(
      "../../scripts/derive-impact-coefficients.mjs"
    );
    const fixture = await readFixture();
    const registry = await readRegistry();
    const profiles = registry.profiles as Array<Record<string, unknown>>;
    const profile = profiles.find((candidate) => candidate.id === "openai-gpt-4o-v1");
    const indicators = profile?.indicators as Record<string, Record<string, unknown>> | undefined;
    if (!indicators?.energyWh) throw new Error("MISSING_SCIENTIFIC_PROFILE_FIXTURE");
    indicators.energyWh.base = Number.NaN;
    const drift = findRegistryDrift(registry, deriveImpactCoefficients(fixture), "how-hungry-v6");
    expect(drift).toContain("openai-gpt-4o-v1:energyWh:base");
  });

  it("keeps common source metadata identical across fixture, registry and inventory", async () => {
    const [fixture, registry, inventory] = await Promise.all([
      readFixture(),
      readRegistry(),
      readFile(new URL("../../data/source-inventory.json", import.meta.url), "utf8").then((value) =>
        JSON.parse(value),
      ),
    ]);
    const fixtureSource = fixture.source as Record<string, unknown>;
    const registrySource = (registry.sources as Array<Record<string, unknown>>).find(
      (source) => source.id === fixtureSource.id,
    );
    const inventorySource = (inventory.sources as Array<Record<string, unknown>>).find(
      (source) => source.id === fixtureSource.id,
    );
    for (const key of ["id", "title", "url", "publicationDate", "revisionDate", "accessedDate"]) {
      expect(registrySource?.[key], `registry:${key}`).toBe(fixtureSource[key]);
      expect(inventorySource?.[key], `inventory:${key}`).toBe(fixtureSource[key]);
    }
  });
});
