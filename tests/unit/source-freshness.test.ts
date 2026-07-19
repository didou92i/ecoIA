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
});
