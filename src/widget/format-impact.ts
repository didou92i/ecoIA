import type { EstimateRange } from "../shared/range";

export interface FormattedEstimate {
  value: string;
  range: string;
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).format(value);
}

function formatEstimate(
  range: EstimateRange,
  maximumFractionDigits: number,
  unit: string,
  valueSuffix = "",
): FormattedEstimate {
  const low = formatNumber(range.low, maximumFractionDigits);
  const central = formatNumber(range.central, maximumFractionDigits);
  const high = formatNumber(range.high, maximumFractionDigits);
  return {
    value: `≈ ${central} ${unit}${valueSuffix}`,
    range: low === high ? "estimation unique" : `de ${low} à ${high} ${unit}`,
  };
}

function scaleRange(range: EstimateRange, divisor: number): EstimateRange {
  return {
    low: range.low / divisor,
    central: range.central / divisor,
    high: range.high / divisor,
  };
}

export function formatTokenRange(range: EstimateRange): FormattedEstimate {
  return formatEstimate(
    {
      low: Math.round(range.low),
      central: Math.round(range.central),
      high: Math.round(range.high),
    },
    0,
    "tokens",
  );
}

export function formatWater(range: EstimateRange): FormattedEstimate {
  if (range.high >= 1_000) {
    return formatEstimate(scaleRange(range, 1_000), 2, "L");
  }
  return formatEstimate(range, range.high < 1 ? 2 : 0, "ml");
}

export function formatCarDistance(range: EstimateRange): FormattedEstimate {
  if (range.high >= 1_000) {
    return formatEstimate(scaleRange(range, 1_000), 2, "km");
  }
  return formatEstimate(range, 0, "m");
}

export function formatTelevisionTime(range: EstimateRange): FormattedEstimate {
  if (range.high >= 3_600) {
    return formatEstimate(scaleRange(range, 3_600), 1, "h", " de TV");
  }
  if (range.high >= 60) {
    return formatEstimate(scaleRange(range, 60), 1, "min", " de TV");
  }
  return formatEstimate(range, 0, "s", " de TV");
}

export function formatEnergy(range: EstimateRange): FormattedEstimate {
  return formatEstimate(range, range.high < 0.1 ? 3 : 2, "Wh");
}

export function formatCarbon(range: EstimateRange): FormattedEstimate {
  return formatEstimate(range, range.high < 0.1 ? 3 : 2, "gCO₂e");
}
