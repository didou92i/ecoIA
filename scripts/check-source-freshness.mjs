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

  return sources
    .filter(
      (source) =>
        reviewedAt.valueOf() - sourceAccessedAt(source.accessedDate).valueOf() >
        maximumAgeDays * millisecondsPerDay,
    )
    .map((source) => source.id)
    .sort();
}

async function runCli() {
  const inventoryUrl = new URL("../data/source-inventory.json", import.meta.url);
  const inventory = JSON.parse(await readFile(inventoryUrl, "utf8"));
  const reviewedAt = new Date();
  reviewedAt.setUTCHours(0, 0, 0, 0);
  const staleSourceIds = findStaleSources(inventory.sources, reviewedAt);

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
