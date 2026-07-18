import type { EstimateRange } from "../shared/range";

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
    useGrouping: false,
  }).format(value);
}

function rangeLabel(range: EstimateRange, maximumFractionDigits: number, unit: string): string {
  const low = formatNumber(range.low, maximumFractionDigits);
  const high = formatNumber(range.high, maximumFractionDigits);
  return `${low === high ? low : `${low}–${high}`} ${unit}`;
}

export function formatTokenRange(range: EstimateRange): string {
  return `${Math.round(range.low)}–${Math.round(range.high)} tokens`;
}

export function formatWater(range: EstimateRange): string {
  if (range.high >= 1_000) {
    return rangeLabel(
      { low: range.low / 1_000, central: range.central / 1_000, high: range.high / 1_000 },
      2,
      "L",
    );
  }
  return rangeLabel(range, range.high < 1 ? 2 : 0, "ml");
}

export function formatCarDistance(range: EstimateRange): string {
  if (range.high >= 1_000) {
    return rangeLabel(
      { low: range.low / 1_000, central: range.central / 1_000, high: range.high / 1_000 },
      2,
      "km",
    );
  }
  return rangeLabel(range, 0, "m");
}

export function formatTelevisionTime(range: EstimateRange): string {
  if (range.high >= 3_600) {
    return `${rangeLabel(
      { low: range.low / 3_600, central: range.central / 3_600, high: range.high / 3_600 },
      1,
      "h",
    )} de TV`;
  }
  if (range.high >= 60) {
    return `${rangeLabel(
      { low: range.low / 60, central: range.central / 60, high: range.high / 60 },
      1,
      "min",
    )} de TV`;
  }
  return `${rangeLabel(range, 0, "s")} de TV`;
}

export function formatEnergy(range: EstimateRange): string {
  return rangeLabel(range, range.high < 0.1 ? 3 : 2, "Wh");
}

export function formatCarbon(range: EstimateRange): string {
  return rangeLabel(range, range.high < 0.1 ? 3 : 2, "gCO₂e");
}
