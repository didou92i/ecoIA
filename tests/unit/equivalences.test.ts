import { describe, expect, it } from "vitest";

import { createRange } from "../../src/shared/range";
import { carMetersFromCarbon, televisionSecondsFromEnergy } from "../../src/impact/equivalences";

describe("pedagogical equivalences", () => {
  it("converts 100 Wh to one hour of a 100 W television", () => {
    expect(televisionSecondsFromEnergy(createRange(100, 100, 100))).toEqual({
      low: 3_600,
      central: 3_600,
      high: 3_600,
    });
  });

  it("converts the ADEME 193.2 gCO2e factor to one vehicle-kilometre", () => {
    expect(carMetersFromCarbon(createRange(193.2, 193.2, 193.2))).toEqual({
      low: 1_000,
      central: 1_000,
      high: 1_000,
    });
  });

  it("preserves range ordering", () => {
    expect(carMetersFromCarbon(createRange(1, 2, 3))).toMatchObject({
      low: expect.any(Number),
      central: expect.any(Number),
      high: expect.any(Number),
    });
    const range = televisionSecondsFromEnergy(createRange(1, 2, 3));
    expect(range.low).toBeLessThan(range.central);
    expect(range.central).toBeLessThan(range.high);
  });
});
