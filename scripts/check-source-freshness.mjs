import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const millisecondsPerDay = 86_400_000;
const sourceDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

function sourceAccessedAt(accessedDate) {
  if (typeof accessedDate !== "string") {
    throw new Error("INVALID_SOURCE_DATE");
  }
  const match = sourceDatePattern.exec(accessedDate);
  if (!match) {
    throw new Error("INVALID_SOURCE_DATE");
  }
  const date = new Date(`${accessedDate}T00:00:00Z`);
  const [year, month, day] = match.slice(1).map(Number);
  if (
    !Number.isFinite(date.valueOf()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("INVALID_SOURCE_DATE");
  }
  return date;
}

export function findStaleSources(sources, reviewedAt, maximumAgeDays = 366) {
  if (!Number.isInteger(maximumAgeDays) || maximumAgeDays <= 0) {
    throw new Error("INVALID_MAXIMUM_SOURCE_AGE");
  }
  if (!(reviewedAt instanceof Date) || !Number.isFinite(reviewedAt.valueOf())) {
    throw new Error("INVALID_SOURCE_DATE");
  }

  const staleSourceIds = [];
  for (const source of sources) {
    const accessedAt = sourceAccessedAt(source.accessedDate);
    if (accessedAt.valueOf() > reviewedAt.valueOf()) {
      throw new Error("SOURCE_ACCESSED_AFTER_REVIEW");
    }
    if (reviewedAt.valueOf() - accessedAt.valueOf() > maximumAgeDays * millisecondsPerDay) {
      staleSourceIds.push(source.id);
    }
  }
  return staleSourceIds.sort();
}

export function findStaleInventorySources(inventory, reviewedAt) {
  const sources = inventory?.sources;
  const modelCatalog = inventory?.domains?.modelCatalog;
  if (
    !Array.isArray(sources) ||
    !modelCatalog ||
    !Array.isArray(modelCatalog.sourceIds) ||
    modelCatalog.sourceIds.length === 0
  ) {
    throw new Error("INVALID_SOURCE_INVENTORY");
  }
  const modelSourceIds = new Set(modelCatalog.sourceIds);
  const availableSourceIds = new Set(sources.map((source) => source.id));
  if ([...modelSourceIds].some((sourceId) => !availableSourceIds.has(sourceId))) {
    throw new Error("INVALID_SOURCE_INVENTORY");
  }
  return [
    ...findStaleSources(
      sources.filter((source) => !modelSourceIds.has(source.id)),
      reviewedAt,
    ),
    ...findStaleSources(
      sources.filter((source) => modelSourceIds.has(source.id)),
      reviewedAt,
      modelCatalog.maximumAgeDays,
    ),
  ].sort();
}

export function findStaleModelCatalogEntries(catalog, reviewedAt) {
  if (!(reviewedAt instanceof Date) || !Number.isFinite(reviewedAt.valueOf())) {
    throw new Error("INVALID_SOURCE_DATE");
  }
  if (
    !catalog ||
    typeof catalog !== "object" ||
    !Number.isInteger(catalog.maximumAgeDays) ||
    catalog.maximumAgeDays <= 0 ||
    !catalog.platforms ||
    !Array.isArray(catalog.platforms.chatgpt)
  ) {
    throw new Error("INVALID_MODEL_CATALOG");
  }

  const catalogReviewedAt = sourceAccessedAt(catalog.reviewedOn);
  if (catalogReviewedAt.valueOf() > reviewedAt.valueOf()) {
    throw new Error("MODEL_CATALOG_REVIEWED_AFTER_CHECK");
  }

  const staleEntries = [];
  if (
    reviewedAt.valueOf() - catalogReviewedAt.valueOf() >
    catalog.maximumAgeDays * millisecondsPerDay
  ) {
    staleEntries.push("model-catalog");
  }

  const choiceIds = new Set();
  for (const choice of catalog.platforms.chatgpt) {
    if (
      !choice ||
      typeof choice !== "object" ||
      typeof choice.id !== "string" ||
      choice.id.length === 0 ||
      choiceIds.has(choice.id)
    ) {
      throw new Error("INVALID_MODEL_CATALOG");
    }
    choiceIds.add(choice.id);
    if (choice.reviewBy === undefined) continue;
    const reviewBy = sourceAccessedAt(choice.reviewBy);
    if (reviewBy.valueOf() <= catalogReviewedAt.valueOf()) {
      throw new Error("INVALID_MODEL_CATALOG");
    }
    if (reviewedAt.valueOf() >= reviewBy.valueOf()) {
      staleEntries.push(`model:${choice.id}`);
    }
  }
  return staleEntries.sort();
}

async function runCli() {
  const inventoryUrl = new URL("../data/source-inventory.json", import.meta.url);
  const modelCatalogUrl = new URL("../data/model-catalog.json", import.meta.url);
  const [inventory, modelCatalog] = await Promise.all([
    readFile(inventoryUrl, "utf8").then(JSON.parse),
    readFile(modelCatalogUrl, "utf8").then(JSON.parse),
  ]);
  const reviewedAt = new Date();
  reviewedAt.setUTCHours(0, 0, 0, 0);
  const staleSourceIds = [
    ...findStaleInventorySources(inventory, reviewedAt),
    ...findStaleModelCatalogEntries(modelCatalog, reviewedAt),
  ].sort();

  if (staleSourceIds.length > 0) {
    console.log(staleSourceIds.join("\n"));
    process.exitCode = 1;
  }
}

const isCliEntry = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isCliEntry) {
  await runCli();
}
