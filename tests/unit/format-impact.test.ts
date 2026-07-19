import { describe, expect, it } from "vitest";

import { createRange } from "../../src/shared/range";
import {
  formatCarbon,
  formatCarDistance,
  formatContextTokenEstimate,
  formatEnergy,
  formatTelevisionTime,
  formatTokenRange,
  formatWater,
} from "../../src/widget/format-impact";

describe("impact formatting", () => {
  it("shows a central token estimate and spells out its uncertainty", () => {
    expect(formatTokenRange(createRange(12.2, 15.7, 20.1))).toEqual({
      value: "≈ 16 tokens",
      range: "de 12 à 20 tokens",
    });
  });

  it("describes visible context as a bounded additional token estimate", () => {
    expect(formatContextTokenEstimate(createRange(120, 180, 240))).toBe(
      "Contexte visible : jusqu’à ≈ 240 tokens supplémentaires",
    );
  });

  it("switches water from millilitres to litres", () => {
    expect(formatWater(createRange(2, 3, 4))).toEqual({
      value: "≈ 3 ml",
      range: "de 2 à 4 ml",
    });
    expect(formatWater(createRange(900, 1_100, 1_400))).toEqual({
      value: "≈ 1,10 L",
      range: "de 0,90 à 1,40 L",
    });
  });

  it("uses readable car-distance units", () => {
    expect(formatCarDistance(createRange(12, 20, 35))).toEqual({
      value: "≈ 20 m",
      range: "de 12 à 35 m",
    });
    expect(formatCarDistance(createRange(800, 1_200, 1_500))).toEqual({
      value: "≈ 1,20 km",
      range: "de 0,80 à 1,50 km",
    });
  });

  it("uses seconds, minutes or hours for television time", () => {
    expect(formatTelevisionTime(createRange(4, 6, 8))).toEqual({
      value: "≈ 6 s de TV",
      range: "de 4 à 8 s",
    });
    expect(formatTelevisionTime(createRange(60, 90, 120))).toEqual({
      value: "≈ 1,5 min de TV",
      range: "de 1,0 à 2,0 min",
    });
    expect(formatTelevisionTime(createRange(3_600, 5_400, 7_200))).toEqual({
      value: "≈ 1,5 h de TV",
      range: "de 1,0 à 2,0 h",
    });
  });

  it("formats detailed energy and carbon values without false precision", () => {
    expect(formatEnergy(createRange(0.123, 0.234, 0.456))).toEqual({
      value: "≈ 0,23 Wh",
      range: "de 0,12 à 0,46 Wh",
    });
    expect(formatCarbon(createRange(0.012, 0.034, 0.056))).toEqual({
      value: "≈ 0,034 gCO₂e",
      range: "de 0,012 à 0,056 gCO₂e",
    });
  });

  it("never uses a dash as an uncertainty separator", () => {
    const formatted = [
      formatTokenRange(createRange(12, 16, 20)),
      formatWater(createRange(2, 3, 4)),
      formatCarDistance(createRange(12, 20, 35)),
      formatTelevisionTime(createRange(60, 90, 120)),
      formatEnergy(createRange(0.1, 0.2, 0.3)),
      formatCarbon(createRange(0.01, 0.02, 0.03)),
    ];
    expect(JSON.stringify(formatted)).not.toMatch(/[–—]/u);
  });
});
