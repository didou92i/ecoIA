import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const coefficientKeys = ["base", "inputPer1k", "outputPer1k"];
const comparisonTolerance = 1e-12;

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < Number.EPSILON) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let index = column; index <= size; index += 1) augmented[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const multiplier = augmented[row][column];
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= multiplier * augmented[column][index];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

function leastSquares(design, values, activeColumns) {
  if (activeColumns.length === 0) return [];
  const normalMatrix = activeColumns.map((left) =>
    activeColumns.map((right) => design.reduce((sum, row) => sum + row[left] * row[right], 0)),
  );
  const normalVector = activeColumns.map((column) =>
    design.reduce((sum, row, index) => sum + row[column] * values[index], 0),
  );
  return solveLinearSystem(normalMatrix, normalVector);
}

function fitNonNegativeTokenLinear(queryShapes, values) {
  const design = queryShapes.map((shape) => [
    1,
    shape.inputTokens / 1_000,
    shape.outputTokens / 1_000,
  ]);
  let best = null;
  for (let mask = 0; mask < 1 << coefficientKeys.length; mask += 1) {
    const activeColumns = coefficientKeys.flatMap((_key, index) =>
      mask & (1 << index) ? [index] : [],
    );
    const activeSolution = leastSquares(design, values, activeColumns);
    if (activeSolution === null || activeSolution.some((value) => value < -comparisonTolerance)) {
      continue;
    }
    const coefficients = [0, 0, 0];
    activeColumns.forEach((column, index) => {
      coefficients[column] = Math.max(0, activeSolution[index]);
    });
    const predictions = design.map((row) =>
      row.reduce((sum, value, index) => sum + value * coefficients[index], 0),
    );
    const residuals = predictions.map((prediction, index) => prediction - values[index]);
    const sumSquaredError = residuals.reduce((sum, residual) => sum + residual ** 2, 0);
    if (!best || sumSquaredError < best.sumSquaredError - Number.EPSILON) {
      best = { activeColumns, coefficients, predictions, residuals, sumSquaredError };
    }
  }
  if (!best) throw new Error("COEFFICIENT_DERIVATION_FAILED");
  const maximumRelativeError = Math.max(
    ...best.residuals.map((residual, index) => Math.abs(residual) / values[index]),
  );
  return {
    energy: Object.fromEntries(
      coefficientKeys.map((key, index) => [key, best.coefficients[index]]),
    ),
    fit: {
      method:
        best.activeColumns.length === coefficientKeys.length && maximumRelativeError <= 1e-12
          ? "unconstrained-exact"
          : "active-set-nnls",
      predictions: best.predictions,
      residuals: best.residuals,
      rmseWh: Math.sqrt(best.sumSquaredError / values.length),
      maximumRelativeError,
    },
  };
}

function scaleCoefficients(coefficients, factor) {
  return Object.fromEntries(coefficientKeys.map((key) => [key, coefficients[key] * factor]));
}

export function deriveImpactCoefficients(fixture) {
  if (!Array.isArray(fixture?.queryShapes) || fixture.queryShapes.length !== 3) {
    throw new Error("INVALID_SOURCE_FIXTURE");
  }
  if (!fixture.infrastructure || !Array.isArray(fixture.models)) {
    throw new Error("INVALID_SOURCE_FIXTURE");
  }
  const profiles = {};
  for (const model of fixture.models) {
    const infrastructure = fixture.infrastructure[model.provider];
    const means = model.energyWh?.map((value) => value.mean);
    if (
      typeof model.profileId !== "string" ||
      !infrastructure ||
      !Array.isArray(means) ||
      means.length !== fixture.queryShapes.length ||
      means.some((value) => !Number.isFinite(value) || value < 0)
    ) {
      throw new Error("INVALID_SOURCE_FIXTURE");
    }
    const result = fitNonNegativeTokenLinear(fixture.queryShapes, means);
    const waterMlPerWh =
      infrastructure.onsiteWueLitresPerKwh / infrastructure.pue +
      infrastructure.offsiteWueLitresPerKwh;
    profiles[model.profileId] = {
      energy: result.energy,
      water: scaleCoefficients(result.energy, waterMlPerWh),
      carbon: scaleCoefficients(result.energy, infrastructure.carbonIntensityKgPerKwh),
      factors: {
        waterMlPerWh,
        carbonGPerWh: infrastructure.carbonIntensityKgPerKwh,
      },
      fit: result.fit,
    };
  }
  return { profiles };
}

export async function readSourceFixture() {
  return JSON.parse(
    await readFile(new URL("../data/how-hungry-ai-v6.json", import.meta.url), "utf8"),
  );
}

function findRegistryDrift(registry, derived) {
  const drift = [];
  for (const [profileId, coefficients] of Object.entries(derived.profiles)) {
    const profile = registry.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      drift.push(`${profileId}:missing-profile`);
      continue;
    }
    for (const [indicator, expected] of Object.entries({
      energyWh: coefficients.energy,
      waterMl: coefficients.water,
      carbonG: coefficients.carbon,
    })) {
      const estimator = profile.indicators[indicator];
      if (estimator?.estimator !== "token-linear") {
        drift.push(`${profileId}:${indicator}:wrong-estimator`);
        continue;
      }
      for (const key of coefficientKeys) {
        if (Math.abs(estimator[key] - expected[key]) > comparisonTolerance) {
          drift.push(`${profileId}:${indicator}:${key}`);
        }
      }
    }
  }
  return drift.sort();
}

async function runCli() {
  const fixture = await readSourceFixture();
  const derived = deriveImpactCoefficients(fixture);
  if (process.argv.slice(2).length === 0) {
    console.log(JSON.stringify(derived, null, 2));
    return;
  }
  if (process.argv.slice(2).join(" ") !== "--check") throw new Error("INVALID_ARGUMENT");
  const registry = JSON.parse(
    await readFile(new URL("../data/impact-profiles.json", import.meta.url), "utf8"),
  );
  const drift = findRegistryDrift(registry, derived);
  if (drift.length > 0) {
    console.error(drift.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Impact coefficients match ${fixture.version} (${Object.keys(derived.profiles).length} profiles).`,
  );
}

const isCliEntry = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isCliEntry) await runCli();
