import { getImpactProfile, impactRegistry } from "./profile-registry";
import type { ConfidenceGrade, ImpactEstimate, ImpactIndicator } from "./profile-types";

export interface IndicatorQualityDisclosure {
  key: "energy" | "water" | "carbon";
  label: string;
  grade: ConfidenceGrade;
  explanation: string;
  sourceId: string;
}

export interface DisclosureSource {
  id: string;
  title: string;
  url: string;
  publicationDate: string;
  scope: string;
  primaryLimitation: string;
}

export interface DataQualityDisclosure {
  overallGrade: ConfidenceGrade;
  overallLabel: string;
  overallExplanation: string;
  indicators: IndicatorQualityDisclosure[];
  sources: DisclosureSource[];
  limitations: string[];
}

const gradeExplanations: Record<ConfidenceGrade, string> = {
  A: "A — donnée fournisseur documentée pour un périmètre comparable",
  B: "B — donnée publiée avec adaptation limitée",
  C: "C — estimation modélisée à partir de données publiées",
  D: "D — proxy générique avec forte incertitude",
};

const gradeSeverity: Record<ConfidenceGrade, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
};

const indicatorDefinitions = [
  { key: "energy", label: "Électricité", property: "energyWh" },
  { key: "water", label: "Eau", property: "waterMl" },
  { key: "carbon", label: "Carbone", property: "carbonG" },
] as const;

function worstGrade(indicators: IndicatorQualityDisclosure[]): ConfidenceGrade {
  let worst: ConfidenceGrade = "A";
  for (const indicator of indicators) {
    if (gradeSeverity[indicator.grade] > gradeSeverity[worst]) worst = indicator.grade;
  }
  return worst;
}

function findSource(sourceId: string): DisclosureSource {
  const source = impactRegistry.sources.find((candidate) => candidate.id === sourceId);
  const primaryLimitation = source?.limitations[0];
  if (!source || !primaryLimitation) throw new Error("UNKNOWN_IMPACT_SOURCE");

  return {
    id: source.id,
    title: source.title,
    url: source.url,
    publicationDate: source.publicationDate,
    scope: source.scope,
    primaryLimitation,
  };
}

export function buildImpactDisclosure(impact: ImpactEstimate): DataQualityDisclosure {
  const profile = getImpactProfile(impact.profileId);
  if (!profile) throw new Error("UNKNOWN_IMPACT_PROFILE");

  const indicators = indicatorDefinitions.map(({ key, label, property }) => {
    const indicator: ImpactIndicator = impact[property];
    return {
      key,
      label,
      grade: indicator.confidence,
      explanation: gradeExplanations[indicator.confidence],
      sourceId: indicator.sourceId,
    };
  });
  const overallGrade = worstGrade(indicators);
  const sourceIds = new Set<string>();
  const sources: DisclosureSource[] = [];
  for (const indicator of indicators) {
    if (sourceIds.has(indicator.sourceId)) continue;
    sourceIds.add(indicator.sourceId);
    sources.push(findSource(indicator.sourceId));
  }

  return {
    overallGrade,
    overallLabel: `Qualité des données · ${overallGrade}`,
    overallExplanation: gradeExplanations[overallGrade],
    indicators,
    sources,
    limitations: [...new Set(profile.limitations)],
  };
}
