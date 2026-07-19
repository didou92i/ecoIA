import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { findStaleSources } from "../../scripts/check-source-freshness.mjs";

const reviewedAt = new Date("2026-07-19T00:00:00Z");

describe("source freshness", () => {
  it("keeps a source accessed less than 366 days ago", () => {
    expect(findStaleSources([{ id: "recent", accessedDate: "2026-07-18" }], reviewedAt)).toEqual(
      [],
    );
  });

  it("keeps a source accessed exactly 366 days ago", () => {
    expect(findStaleSources([{ id: "boundary", accessedDate: "2025-07-18" }], reviewedAt)).toEqual(
      [],
    );
  });

  it("returns sorted IDs for sources older than 366 days", () => {
    expect(
      findStaleSources(
        [
          { id: "zeta", accessedDate: "2025-07-17" },
          { id: "recent", accessedDate: "2026-07-18" },
          { id: "alpha", accessedDate: "2025-01-01" },
        ],
        reviewedAt,
      ),
    ).toEqual(["alpha", "zeta"]);
  });

  it("rejects an invalid accessed date", () => {
    expect(() =>
      findStaleSources([{ id: "invalid", accessedDate: "not-a-date" }], reviewedAt),
    ).toThrow("INVALID_SOURCE_DATE");
  });

  it("rejects an impossible calendar date", () => {
    expect(() =>
      findStaleSources([{ id: "invalid-calendar", accessedDate: "2025-02-29" }], reviewedAt),
    ).toThrow("INVALID_SOURCE_DATE");
  });

  it("rejects an invalid review date", () => {
    expect(() => findStaleSources([], new Date("not-a-date"))).toThrow("INVALID_SOURCE_DATE");
  });

  it("rejects a review value that is not a Date", () => {
    expect(() => findStaleSources([], 0 as unknown as Date)).toThrow("INVALID_SOURCE_DATE");
  });

  it("rejects a maximum age that is not a positive integer", () => {
    for (const maximumAgeDays of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => findStaleSources([], reviewedAt, maximumAgeDays)).toThrow(
        "INVALID_MAXIMUM_SOURCE_AGE",
      );
    }
  });

  it("inventories every quantitative domain source and links only known IDs", async () => {
    const inventory = JSON.parse(
      await readFile(new URL("../../data/source-inventory.json", import.meta.url), "utf8"),
    );
    const sourceIds = inventory.sources.map((source: { id: string }) => source.id);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(sourceIds).toEqual(
      expect.arrayContaining([
        "how-hungry-v6",
        "google-gemini-median-2025",
        "mistral-lca-2025",
        "ademe-datagir-car-193-2",
        "token-openai-tiktoken",
        "token-anthropic-tokenizer",
        "token-mistral-common",
        "token-google-gemini-docs",
      ]),
    );

    const linkedIds = [
      ...inventory.domains.impactProfiles.sourceIds,
      inventory.domains.carEquivalence.sourceId,
      ...Object.values(inventory.domains.tokenCalibration).flat(),
    ];
    expect(linkedIds.every((sourceId) => sourceIds.includes(sourceId))).toBe(true);
  });

  it("connects impact, car-equivalence and token-calibration domain data to inventory IDs", async () => {
    const inventory = JSON.parse(
      await readFile(new URL("../../data/source-inventory.json", import.meta.url), "utf8"),
    );
    const rawRegistry = JSON.parse(
      await readFile(new URL("../../data/impact-profiles.json", import.meta.url), "utf8"),
    );
    const rawCalibration = JSON.parse(
      await readFile(new URL("../../data/token-calibration.json", import.meta.url), "utf8"),
    );
    const equivalences = (await import("../../src/impact/equivalences")) as unknown as Record<
      string,
      unknown
    >;

    expect(inventory.domains.impactProfiles.sourceIds.sort()).toEqual(
      rawRegistry.sources.map((source: { id: string }) => source.id).sort(),
    );
    expect(inventory.domains.carEquivalence).toEqual({
      sourceId: equivalences.carEquivalenceSourceId,
      gramsCo2ePerVehicleKilometre: equivalences.referenceCarGramsPerKilometre,
    });
    expect(Object.keys(inventory.domains.tokenCalibration).sort()).toEqual(
      Object.keys(rawCalibration.families).sort(),
    );
    expect(
      Object.values(inventory.domains.tokenCalibration).every(
        (sourceIds) => Array.isArray(sourceIds) && sourceIds.length > 0,
      ),
    ).toBe(true);
  });

  it("reads only the development inventory and leaves it unchanged offline", async () => {
    const script = await readFile(
      new URL("../../scripts/check-source-freshness.mjs", import.meta.url),
      "utf8",
    );
    expect(script).not.toMatch(/\bfetch\b|https?\.request|writeFile|appendFile/u);
    const inventoryUrl = new URL("../../data/source-inventory.json", import.meta.url);
    const before = await readFile(inventoryUrl, "utf8");
    const result = spawnSync(process.execPath, ["scripts/check-source-freshness.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const after = await readFile(inventoryUrl, "utf8");
    expect(result.status, result.stderr).toBe(0);
    expect(after).toBe(before);
  });

  it("requires the freshness check in CI before build and in the release checklist", async () => {
    const [workflow, checklist] = await Promise.all([
      readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8"),
      readFile(new URL("../../docs/release-checklist.md", import.meta.url), "utf8"),
    ]);
    expect(workflow).toContain("run: npm run source-freshness");
    expect(workflow.indexOf("run: npm run source-freshness")).toBeLessThan(
      workflow.indexOf("run: npm run build"),
    );
    expect(checklist).toContain("npm run source-freshness");
  });
});
