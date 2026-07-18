import { describe, expect, it } from "vitest";

import { createRange } from "../../src/shared/range";
import {
  formatCarbon,
  formatCarDistance,
  formatEnergy,
  formatTelevisionTime,
  formatTokenRange,
  formatWater,
} from "../../src/widget/format-impact";

describe("impact formatting", () => {
  it("formats tokens as rounded integers", () => {
    expect(formatTokenRange(createRange(12.2, 15.7, 20.1))).toBe("12–20 tokens");
  });

  it("switches water from millilitres to litres", () => {
    expect(formatWater(createRange(2, 3, 4))).toBe("2–4 ml");
    expect(formatWater(createRange(900, 1_100, 1_400))).toBe("0,90–1,40 L");
  });

  it("uses readable car-distance units", () => {
    expect(formatCarDistance(createRange(12, 20, 35))).toBe("12–35 m");
    expect(formatCarDistance(createRange(800, 1_200, 1_500))).toBe("0,80–1,50 km");
  });

  it("uses seconds, minutes or hours for television time", () => {
    expect(formatTelevisionTime(createRange(4, 6, 8))).toBe("4–8 s de TV");
    expect(formatTelevisionTime(createRange(60, 90, 120))).toBe("1,0–2,0 min de TV");
    expect(formatTelevisionTime(createRange(3_600, 5_400, 7_200))).toBe("1,0–2,0 h de TV");
  });

  it("formats detailed energy and carbon values without false precision", () => {
    expect(formatEnergy(createRange(0.123, 0.234, 0.456))).toBe("0,12–0,46 Wh");
    expect(formatCarbon(createRange(0.012, 0.034, 0.056))).toBe("0,012–0,056 gCO₂e");
  });
});
