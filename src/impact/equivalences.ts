import { scaleRange, type EstimateRange } from "../shared/range";

const referenceTelevisionWatts = 100;
export const referenceCarGramsPerKilometre = 193.2;
export const carEquivalenceSourceId = "ademe-datagir-car-193-2";

export function televisionSecondsFromEnergy(energyWh: EstimateRange): EstimateRange {
  return scaleRange(energyWh, 3_600 / referenceTelevisionWatts);
}

export function carMetersFromCarbon(carbonG: EstimateRange): EstimateRange {
  return scaleRange(carbonG, 1_000 / referenceCarGramsPerKilometre);
}
