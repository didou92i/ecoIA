import { describe, expect, it } from "vitest";

import { buildImpactDisclosure } from "../../src/impact/impact-disclosure";
import { estimateImpact } from "../../src/impact/impact-engine";
import { impactRegistry } from "../../src/impact/profile-registry";
import { createRange } from "../../src/shared/range";
import type { VisibleTokenEstimate } from "../../src/shared/contracts";

const tokens: VisibleTokenEstimate = {
  input: createRange(900, 1_000, 1_100),
  output: createRange(450, 500, 550),
  source: "estimated",
};

describe("impact data-quality disclosure", () => {
  it("uses the approved French meaning for every confidence grade", () => {
    const expectedExplanations = {
      A: "A — donnée fournisseur documentée pour un périmètre comparable",
      B: "B — donnée publiée avec adaptation limitée",
      C: "C — estimation modélisée à partir de données publiées",
      D: "D — proxy générique avec forte incertitude",
    };

    const baseImpact = estimateImpact("mistral-large-2-disclosure-v1", tokens);
    const gradeAImpact = {
      ...baseImpact,
      energyWh: { ...baseImpact.energyWh, confidence: "A" as const },
      waterMl: { ...baseImpact.waterMl, confidence: "A" as const },
      carbonG: { ...baseImpact.carbonG, confidence: "A" as const },
    };
    const gradeBImpact = {
      ...baseImpact,
      energyWh: { ...baseImpact.energyWh, confidence: "B" as const },
      waterMl: { ...baseImpact.waterMl, confidence: "B" as const },
      carbonG: { ...baseImpact.carbonG, confidence: "B" as const },
    };
    const examples = [
      [gradeAImpact, "A"],
      [gradeBImpact, "B"],
      [estimateImpact("openai-gpt-4o-v1", tokens), "C"],
      [estimateImpact("generic-assistant-v1", tokens), "D"],
    ] as const;

    for (const [impact, grade] of examples) {
      const disclosure = buildImpactDisclosure(impact);
      expect(disclosure.overallGrade).toBe(grade);
      expect(disclosure.overallExplanation).toBe(expectedExplanations[grade]);
    }
  });

  it("orders electricity, water and carbon and chooses the worst grade overall", () => {
    const disclosure = buildImpactDisclosure(
      estimateImpact("mistral-large-2-disclosure-v1", tokens),
    );

    expect(disclosure.indicators).toEqual([
      expect.objectContaining({ key: "energy", label: "Électricité", grade: "D" }),
      expect.objectContaining({ key: "water", label: "Eau", grade: "A" }),
      expect.objectContaining({ key: "carbon", label: "Carbone", grade: "A" }),
    ]);
    expect(disclosure.overallGrade).toBe("D");
    expect(disclosure.overallLabel).toBe("Qualité des données · D");
    expect(disclosure.overallExplanation).toBe("D — proxy générique avec forte incertitude");
  });

  it("orders grade C as worse than grade B", () => {
    const impact = estimateImpact("openai-gpt-4o-v1", tokens);
    const disclosure = buildImpactDisclosure({
      ...impact,
      energyWh: { ...impact.energyWh, confidence: "B" },
      waterMl: { ...impact.waterMl, confidence: "C" },
      carbonG: { ...impact.carbonG, confidence: "B" },
    });

    expect(disclosure.overallGrade).toBe("C");
    expect(disclosure.overallExplanation).toBe(
      "C — estimation modélisée à partir de données publiées",
    );
  });

  it("deduplicates source records in indicator order with their validated metadata", () => {
    const disclosure = buildImpactDisclosure(
      estimateImpact("mistral-large-2-disclosure-v1", tokens),
    );
    const howHungry = impactRegistry.sources.find((source) => source.id === "how-hungry-v6");
    const mistral = impactRegistry.sources.find((source) => source.id === "mistral-lca-2025");
    if (!howHungry || !mistral) throw new Error("MISSING_TEST_SOURCE");

    expect(disclosure.sources).toEqual([
      {
        id: howHungry.id,
        title: howHungry.title,
        url: howHungry.url,
        publicationDate: howHungry.publicationDate,
        scope: howHungry.scope,
        primaryLimitation: howHungry.limitations[0],
      },
      {
        id: mistral.id,
        title: mistral.title,
        url: mistral.url,
        publicationDate: mistral.publicationDate,
        scope: mistral.scope,
        primaryLimitation: mistral.limitations[0],
      },
    ]);
  });

  it("uses only unique limitations from the impact profile", () => {
    const impact = estimateImpact("mistral-large-2-disclosure-v1", tokens);
    const profile = impactRegistry.profiles.find((candidate) => candidate.id === impact.profileId);
    if (!profile) throw new Error("MISSING_TEST_PROFILE");

    expect(buildImpactDisclosure(impact).limitations).toEqual(profile.limitations);
  });
});
