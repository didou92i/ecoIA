export interface EstimateRange {
  low: number;
  central: number;
  high: number;
}

export function createRange(low: number, central: number, high: number): EstimateRange {
  if (
    !Number.isFinite(low) ||
    !Number.isFinite(central) ||
    !Number.isFinite(high) ||
    low < 0 ||
    low > central ||
    central > high
  ) {
    throw new Error("INVALID_RANGE");
  }
  return { low, central, high };
}

export function addRanges(left: EstimateRange, right: EstimateRange): EstimateRange {
  return createRange(left.low + right.low, left.central + right.central, left.high + right.high);
}

export function scaleRange(range: EstimateRange, factor: number): EstimateRange {
  if (!Number.isFinite(factor) || factor < 0) {
    throw new Error("INVALID_SCALE");
  }
  return createRange(range.low * factor, range.central * factor, range.high * factor);
}

export function clampRange(range: EstimateRange, minimum: number, maximum: number): EstimateRange {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || minimum > maximum) {
    throw new Error("INVALID_CLAMP");
  }

  const clamp = (value: number) => Math.max(minimum, Math.min(value, maximum));
  return createRange(clamp(range.low), clamp(range.central), clamp(range.high));
}
