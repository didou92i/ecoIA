import rawModelCatalog from "../../data/model-catalog.json";
import { getImpactProfile } from "./profile-registry";

export interface CurrentModelChoice {
  id: string;
  label: string;
  aliases: string[];
  impactProfileId: string;
  sourceId: string;
  reviewBy?: string;
}

export interface ModelCatalog {
  version: string;
  reviewedOn: string;
  maximumAgeDays: number;
  sourceIds: string[];
  platforms: { chatgpt: CurrentModelChoice[] };
}

const identifierPattern = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

function invalidCatalog(): never {
  throw new Error("INVALID_MODEL_CATALOG");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isNonEmptyString(value: unknown, maximumLength = 512): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximumLength;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value);
}

export function normalizeCatalogModelLabel(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function validateModelCatalog(value: unknown): ModelCatalog {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "reviewedOn", "maximumAgeDays", "sourceIds", "platforms"]) ||
    !isNonEmptyString(value.version, 32) ||
    !isValidDate(value.reviewedOn) ||
    !Number.isInteger(value.maximumAgeDays) ||
    (value.maximumAgeDays as number) < 1 ||
    (value.maximumAgeDays as number) > 366 ||
    !Array.isArray(value.sourceIds) ||
    value.sourceIds.length === 0 ||
    !value.sourceIds.every(
      (sourceId) => isNonEmptyString(sourceId, 128) && identifierPattern.test(sourceId),
    ) ||
    new Set(value.sourceIds).size !== value.sourceIds.length ||
    !isRecord(value.platforms) ||
    !hasExactKeys(value.platforms, ["chatgpt"]) ||
    !Array.isArray(value.platforms.chatgpt) ||
    value.platforms.chatgpt.length === 0 ||
    value.platforms.chatgpt.length > 32
  ) {
    invalidCatalog();
  }

  const sourceIds = new Set(value.sourceIds as string[]);
  const choiceIds = new Set<string>();
  const normalizedAliases = new Set<string>();
  const baseChoiceKeys = ["id", "label", "aliases", "impactProfileId", "sourceId"] as const;
  for (const candidate of value.platforms.chatgpt) {
    const expectedChoiceKeys =
      isRecord(candidate) && candidate.reviewBy !== undefined
        ? [...baseChoiceKeys, "reviewBy"]
        : baseChoiceKeys;
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, expectedChoiceKeys) ||
      !isNonEmptyString(candidate.id, 128) ||
      !identifierPattern.test(candidate.id) ||
      choiceIds.has(candidate.id) ||
      !isNonEmptyString(candidate.label, 128) ||
      !Array.isArray(candidate.aliases) ||
      candidate.aliases.length === 0 ||
      candidate.aliases.length > 16 ||
      !candidate.aliases.every((alias) => isNonEmptyString(alias, 128)) ||
      !isNonEmptyString(candidate.impactProfileId, 128) ||
      !identifierPattern.test(candidate.impactProfileId) ||
      !isNonEmptyString(candidate.sourceId, 128) ||
      !sourceIds.has(candidate.sourceId) ||
      (candidate.reviewBy !== undefined &&
        (!isValidDate(candidate.reviewBy) ||
          new Date(`${candidate.reviewBy}T00:00:00Z`).valueOf() <=
            new Date(`${value.reviewedOn}T00:00:00Z`).valueOf()))
    ) {
      invalidCatalog();
    }
    const profile = getImpactProfile(candidate.impactProfileId);
    if (
      !profile?.platforms.includes("chatgpt") ||
      Object.values(profile.indicators).some((indicator) => indicator.confidence !== "D")
    ) {
      invalidCatalog();
    }
    choiceIds.add(candidate.id);
    for (const alias of candidate.aliases as string[]) {
      const normalized = normalizeCatalogModelLabel(alias);
      if (!normalized || normalizedAliases.has(normalized)) invalidCatalog();
      normalizedAliases.add(normalized);
    }
  }
  return value as unknown as ModelCatalog;
}

export const modelCatalog = validateModelCatalog(rawModelCatalog);

export function getCurrentChatGptChoices(reviewedAt = new Date()): CurrentModelChoice[] {
  if (!Number.isFinite(reviewedAt.valueOf())) throw new Error("INVALID_MODEL_CATALOG_DATE");
  return modelCatalog.platforms.chatgpt.filter(
    (choice) =>
      choice.reviewBy === undefined ||
      reviewedAt.valueOf() < new Date(`${choice.reviewBy}T00:00:00Z`).valueOf(),
  );
}

export function matchCurrentChatGptChoice(
  modelLabel: string,
  reviewedAt = new Date(),
): CurrentModelChoice | null {
  const normalized = normalizeCatalogModelLabel(modelLabel.slice(0, 128));
  return (
    getCurrentChatGptChoices(reviewedAt).find((choice) =>
      choice.aliases.some((alias) => {
        const normalizedAlias = normalizeCatalogModelLabel(alias);
        return normalized === normalizedAlias || normalized === `openai ${normalizedAlias}`;
      }),
    ) ?? null
  );
}
