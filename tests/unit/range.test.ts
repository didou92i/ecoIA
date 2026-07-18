import { describe, expect, it } from "vitest";

import { addRanges, clampRange, createRange, scaleRange } from "../../src/shared/range";

describe("estimate ranges", () => {
  it("creates an ordered finite range", () => {
    expect(createRange(1, 2, 3)).toEqual({ low: 1, central: 2, high: 3 });
  });

  it.each([
    [-1, 0, 1],
    [2, 1, 3],
    [1, 3, 2],
    [0, Number.NaN, 1],
    [0, 1, Number.POSITIVE_INFINITY],
  ])("rejects invalid bounds %s/%s/%s", (low, central, high) => {
    expect(() => createRange(low, central, high)).toThrow("INVALID_RANGE");
  });

  it("adds uncertainty bounds component by component", () => {
    expect(addRanges(createRange(1, 2, 4), createRange(2, 3, 5))).toEqual({
      low: 3,
      central: 5,
      high: 9,
    });
  });

  it("scales a range while preserving its order", () => {
    expect(scaleRange(createRange(2, 3, 5), 4)).toEqual({ low: 8, central: 12, high: 20 });
    expect(() => scaleRange(createRange(1, 2, 3), -1)).toThrow("INVALID_SCALE");
  });

  it("clamps every bound and restores a valid order", () => {
    expect(clampRange(createRange(1, 5, 10), 3, 7)).toEqual({ low: 3, central: 5, high: 7 });
  });
});
