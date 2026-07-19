import rawRegistry from "../../data/impact-profiles.json";
import { platformIds, type PlatformId } from "../shared/contracts";
import type {
  ImpactProfile,
  ImpactRegistry,
  IndicatorEstimator,
  IndicatorKey,
  IndicatorUnit,
} from "./profile-types";

const indicatorKeys = ["energyWh", "waterMl", "carbonG"] as const;
const expectedUnits: Record<IndicatorKey, IndicatorUnit> = {
  energyWh: "Wh",
  waterMl: "ml",
  carbonG: "gCO2e",
};
const confidenceGrades = ["A", "B", "C", "D"] as const;
const identifierPattern = /^[a-z0-9][a-z0-9-]{0,127}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function invalidRegistry(): never {
  throw new Error("INVALID_IMPACT_REGISTRY");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStringList(value: unknown, allowEmpty = false): value is string[] {
  return (
    Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every((item) => isNonEmptyString(item))
  );
}

function validateEstimator(
  value: unknown,
  key: IndicatorKey,
  sourceIds: Set<string>,
): asserts value is IndicatorEstimator {
  if (
    !isRecord(value) ||
    value.unit !== expectedUnits[key] ||
    !isNonNegativeFinite(value.lowMultiplier) ||
    value.lowMultiplier > 1 ||
    !isNonNegativeFinite(value.highMultiplier) ||
    value.highMultiplier < 1 ||
    !confidenceGrades.includes(value.confidence as (typeof confidenceGrades)[number]) ||
    !isIdentifier(value.sourceId) ||
    !sourceIds.has(value.sourceId)
  ) {
    invalidRegistry();
  }

  if (value.estimator === "token-linear") {
    if (
      !isNonNegativeFinite(value.base) ||
      !isNonNegativeFinite(value.inputPer1k) ||
      !isNonNegativeFinite(value.outputPer1k)
    ) {
      invalidRegistry();
    }
    return;
  }
  if (value.estimator === "prompt-median") {
    if (!isNonNegativeFinite(value.perPrompt)) invalidRegistry();
    return;
  }
  if (value.estimator === "model-proxy") {
    if (
      !isIdentifier(value.profileId) ||
      !indicatorKeys.includes(value.indicator as IndicatorKey)
    ) {
      invalidRegistry();
    }
    return;
  }
  invalidRegistry();
}

function normalizeModelLabel(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesStructuredAlias(profile: ImpactProfile, normalizedLabel: string): boolean {
  return profile.modelAliases.aliases.some((alias) => {
    const normalizedAlias = normalizeModelLabel(alias);
    if (normalizedLabel === normalizedAlias) return true;
    return profile.modelAliases.providerPrefixes.some(
      (prefix) => normalizedLabel === `${normalizeModelLabel(prefix)} ${normalizedAlias}`,
    );
  });
}

function validateProxyGraph(profiles: ImpactProfile[]): void {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  function visit(profileId: string, indicator: IndicatorKey, path: Set<string>): void {
    const nodeId = `${profileId}:${indicator}`;
    if (path.has(nodeId)) invalidRegistry();
    const profile = profilesById.get(profileId);
    if (!profile) invalidRegistry();
    const estimator = profile.indicators[indicator];
    if (estimator.estimator !== "model-proxy") return;
    const nextPath = new Set(path);
    nextPath.add(nodeId);
    visit(estimator.profileId, estimator.indicator, nextPath);
  }

  for (const profile of profiles) {
    for (const indicator of indicatorKeys) visit(profile.id, indicator, new Set());
  }
}

export function validateImpactRegistry(value: unknown): ImpactRegistry {
  if (!isRecord(value) || !isNonEmptyString(value.methodologyVersion)) invalidRegistry();
  if (!Array.isArray(value.sources) || !Array.isArray(value.profiles)) invalidRegistry();

  const sourceIds = new Set<string>();
  for (const source of value.sources) {
    if (
      !isRecord(source) ||
      !isIdentifier(source.id) ||
      sourceIds.has(source.id) ||
      !isNonEmptyString(source.title) ||
      !isNonEmptyString(source.url) ||
      !source.url.startsWith("https://") ||
      !isValidDate(source.publicationDate) ||
      (source.revisionDate !== undefined && !isValidDate(source.revisionDate)) ||
      !isValidDate(source.accessedDate) ||
      source.primary !== true ||
      !isNonEmptyString(source.scope) ||
      !isStringList(source.limitations)
    ) {
      invalidRegistry();
    }
    sourceIds.add(source.id);
  }

  const profileIds = new Set<string>();
  const profiles: ImpactProfile[] = [];
  for (const profile of value.profiles) {
    if (
      !isRecord(profile) ||
      !isIdentifier(profile.id) ||
      profileIds.has(profile.id) ||
      !Number.isSafeInteger(profile.version) ||
      (profile.version as number) < 1 ||
      (profile.derivationId !== undefined && !isIdentifier(profile.derivationId)) ||
      !isNonEmptyString(profile.displayName) ||
      !Array.isArray(profile.platforms) ||
      profile.platforms.length === 0 ||
      !profile.platforms.every((platform) => platformIds.includes(platform as PlatformId)) ||
      !isRecord(profile.modelAliases) ||
      !isStringList(profile.modelAliases.aliases, true) ||
      !isStringList(profile.modelAliases.providerPrefixes, true) ||
      (profile.modelAliases.aliases.length === 0 &&
        profile.modelAliases.providerPrefixes.length > 0) ||
      !isStringList(profile.limitations) ||
      !isRecord(profile.indicators)
    ) {
      invalidRegistry();
    }
    for (const indicator of indicatorKeys) {
      validateEstimator(profile.indicators[indicator], indicator, sourceIds);
    }
    profileIds.add(profile.id);
    profiles.push(profile as unknown as ImpactProfile);
  }

  if (!profileIds.has("generic-assistant-v1")) invalidRegistry();
  if (!isRecord(value.platformFallbacks)) invalidRegistry();
  for (const platform of platformIds) {
    const fallbackId = value.platformFallbacks[platform];
    if (!isIdentifier(fallbackId) || !profileIds.has(fallbackId)) invalidRegistry();
    const fallback = profiles.find((profile) => profile.id === fallbackId);
    if (
      !fallback?.platforms.includes(platform) ||
      indicatorKeys.some((indicator) => fallback.indicators[indicator].confidence !== "D")
    ) {
      invalidRegistry();
    }
  }
  validateProxyGraph(profiles);
  return value as unknown as ImpactRegistry;
}

export const impactRegistry = validateImpactRegistry(rawRegistry);

export function getImpactProfile(profileId: string): ImpactProfile | null {
  return impactRegistry.profiles.find((profile) => profile.id === profileId) ?? null;
}

export function matchImpactProfileId(platform: PlatformId, modelLabel: string): string | null {
  const normalizedLabel = normalizeModelLabel(modelLabel.slice(0, 128));
  const platformProfiles = impactRegistry.profiles.filter(
    (profile) => profile.platforms.includes(platform) && profile.modelAliases.aliases.length > 0,
  );
  const directMatch = platformProfiles.find((profile) =>
    matchesStructuredAlias(profile, normalizedLabel),
  );
  if (directMatch) return directMatch.id;

  if (platform === "perplexity") {
    const underlyingModel = impactRegistry.profiles.find(
      (profile) =>
        profile.id !== "generic-assistant-v1" &&
        profile.modelAliases.aliases.length > 0 &&
        matchesStructuredAlias(profile, normalizedLabel),
    );
    if (underlyingModel) return underlyingModel.id;
  }

  return null;
}

export function resolveImpactProfileId(platform: PlatformId, modelLabel: string): string {
  return matchImpactProfileId(platform, modelLabel) ?? impactRegistry.platformFallbacks[platform];
}
