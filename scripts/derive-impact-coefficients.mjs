import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const coefficientKeys = ["base", "inputPer1k", "outputPer1k"];
const comparisonTolerance = 1e-12;
const expectedFixtureVersion = "arxiv-2505.09598v6-table1-table4";
const expectedSourceId = "how-hungry-v6";
const expectedQueryShapeIds = ["short", "medium", "long"];
const expectedInfrastructureIds = ["openaiAzure", "anthropicAws"];
const expectedModels = new Map([
  ["openai-gpt-4o-v1", { label: "GPT-4o (Mar '25)", provider: "openaiAzure" }],
  ["openai-gpt-4-1-v1", { label: "GPT-4.1", provider: "openaiAzure" }],
  ["anthropic-claude-3-7-sonnet-v1", { label: "Claude 3.7 Sonnet", provider: "anthropicAws" }],
  ["anthropic-claude-3-5-sonnet-v1", { label: "Claude 3.5 Sonnet", provider: "anthropicAws" }],
  ["anthropic-claude-3-5-haiku-v1", { label: "Claude 3.5 Haiku", provider: "anthropicAws" }],
]);
const exactNormalizationStatus = "exact-decimal-transcription";
const inferredNormalizationStatus = "inferred-missing-decimal-point";

function invalidFixture() {
  throw new Error("INVALID_SOURCE_FIXTURE");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isBoundedString(value, maximumLength = 512) {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength;
}

function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

function isFiniteNumber(value, minimum, strictlyGreater = false) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (strictlyGreater ? value > minimum : value >= minimum)
  );
}

function isPositiveBoundedTokenCount(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 10_000_000;
}

function validateNormalizedValue(raw, normalized, status, strictlyPositive) {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    raw.length > 32 ||
    !isFiniteNumber(normalized, 0, strictlyPositive) ||
    (status !== exactNormalizationStatus && status !== inferredNormalizationStatus)
  ) {
    invalidFixture();
  }
  if (status === exactNormalizationStatus && Number(raw) !== normalized) invalidFixture();
  if (status === inferredNormalizationStatus && !/^\d+$/.test(raw)) invalidFixture();
}

function determinant3(matrix) {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

export function validateSourceFixture(fixture) {
  if (
    !isRecord(fixture) ||
    !hasExactKeys(fixture, [
      "version",
      "source",
      "queryShapes",
      "infrastructure",
      "models",
      "normalizationNotes",
    ]) ||
    fixture.version !== expectedFixtureVersion ||
    !isRecord(fixture.source) ||
    !hasExactKeys(fixture.source, [
      "id",
      "title",
      "url",
      "version",
      "publicationDate",
      "revisionDate",
      "accessedDate",
    ]) ||
    fixture.source.id !== expectedSourceId ||
    !isBoundedString(fixture.source.title) ||
    fixture.source.url !== "https://arxiv.org/abs/2505.09598v6" ||
    fixture.source.version !== "v6" ||
    !isCalendarDate(fixture.source.publicationDate) ||
    !isCalendarDate(fixture.source.revisionDate) ||
    !isCalendarDate(fixture.source.accessedDate) ||
    !Array.isArray(fixture.normalizationNotes) ||
    fixture.normalizationNotes.length > 16 ||
    !fixture.normalizationNotes.every((note) => isBoundedString(note, 2_048)) ||
    !Array.isArray(fixture.queryShapes) ||
    fixture.queryShapes.length !== expectedQueryShapeIds.length
  ) {
    invalidFixture();
  }

  const queryShapeIds = new Set();
  for (const [index, shape] of fixture.queryShapes.entries()) {
    if (
      !isRecord(shape) ||
      !hasExactKeys(shape, ["id", "inputTokens", "outputTokens"]) ||
      shape.id !== expectedQueryShapeIds[index] ||
      queryShapeIds.has(shape.id) ||
      !isPositiveBoundedTokenCount(shape.inputTokens) ||
      !isPositiveBoundedTokenCount(shape.outputTokens)
    ) {
      invalidFixture();
    }
    queryShapeIds.add(shape.id);
  }
  const design = fixture.queryShapes.map((shape) => [
    1,
    shape.inputTokens / 1_000,
    shape.outputTokens / 1_000,
  ]);
  const determinant = determinant3(design);
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) invalidFixture();

  if (
    !isRecord(fixture.infrastructure) ||
    !hasExactKeys(fixture.infrastructure, expectedInfrastructureIds)
  ) {
    invalidFixture();
  }
  for (const infrastructureId of expectedInfrastructureIds) {
    const infrastructure = fixture.infrastructure[infrastructureId];
    if (
      !isRecord(infrastructure) ||
      !hasExactKeys(infrastructure, [
        "pue",
        "onsiteWueLitresPerKwh",
        "offsiteWueLitresPerKwh",
        "carbonIntensityKgPerKwh",
      ]) ||
      !isFiniteNumber(infrastructure.pue, 0, true) ||
      !isFiniteNumber(infrastructure.onsiteWueLitresPerKwh, 0) ||
      !isFiniteNumber(infrastructure.offsiteWueLitresPerKwh, 0) ||
      !isFiniteNumber(infrastructure.carbonIntensityKgPerKwh, 0)
    ) {
      invalidFixture();
    }
  }

  if (!Array.isArray(fixture.models) || fixture.models.length !== expectedModels.size) {
    invalidFixture();
  }
  const profileIds = new Set();
  for (const model of fixture.models) {
    if (
      !isRecord(model) ||
      !hasExactKeys(model, ["profileId", "label", "provider", "energyWh"]) ||
      typeof model.profileId !== "string" ||
      profileIds.has(model.profileId)
    ) {
      invalidFixture();
    }
    const expectedModel = expectedModels.get(model.profileId);
    if (
      !expectedModel ||
      model.label !== expectedModel.label ||
      model.provider !== expectedModel.provider ||
      !Array.isArray(model.energyWh) ||
      model.energyWh.length !== fixture.queryShapes.length
    ) {
      invalidFixture();
    }
    profileIds.add(model.profileId);
    for (const value of model.energyWh) {
      if (
        !isRecord(value) ||
        !hasExactKeys(value, [
          "meanRaw",
          "meanNormalized",
          "meanNormalizationStatus",
          "standardDeviationRaw",
          "standardDeviationNormalized",
          "standardDeviationNormalizationStatus",
        ])
      ) {
        invalidFixture();
      }
      validateNormalizedValue(
        value.meanRaw,
        value.meanNormalized,
        value.meanNormalizationStatus,
        true,
      );
      validateNormalizedValue(
        value.standardDeviationRaw,
        value.standardDeviationNormalized,
        value.standardDeviationNormalizationStatus,
        false,
      );
    }
  }
  if (profileIds.size !== expectedModels.size) invalidFixture();
  return fixture;
}

function assertFiniteNumbers(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalidFixture();
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertFiniteNumbers(item);
    return;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) assertFiniteNumbers(item);
  }
}

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
  const solution = augmented.map((row) => row[size]);
  return solution.every(Number.isFinite) ? solution : null;
}

function leastSquares(design, values, activeColumns) {
  if (activeColumns.length === 0) return [];
  const normalMatrix = activeColumns.map((left) =>
    activeColumns.map((right) => design.reduce((sum, row) => sum + row[left] * row[right], 0)),
  );
  const normalVector = activeColumns.map((column) =>
    design.reduce((sum, row, index) => sum + row[column] * values[index], 0),
  );
  if (![...normalMatrix.flat(), ...normalVector].every(Number.isFinite)) return null;
  return solveLinearSystem(normalMatrix, normalVector);
}

export function fitNonNegativeTokenLinear(queryShapes, values) {
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
    if (
      activeSolution === null ||
      activeSolution.some((value) => !Number.isFinite(value) || value < -comparisonTolerance)
    ) {
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
    if (![...coefficients, ...predictions, ...residuals, sumSquaredError].every(Number.isFinite)) {
      continue;
    }
    if (!best || sumSquaredError < best.sumSquaredError - Number.EPSILON) {
      best = { activeColumns, coefficients, predictions, residuals, sumSquaredError };
    }
  }
  if (!best) throw new Error("COEFFICIENT_DERIVATION_FAILED");
  const maximumRelativeError = Math.max(
    ...best.residuals.map((residual, index) => Math.abs(residual) / values[index]),
  );
  const result = {
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
  assertFiniteNumbers(result);
  return result;
}

function scaleCoefficients(coefficients, factor) {
  const scaled = Object.fromEntries(
    coefficientKeys.map((key) => [key, coefficients[key] * factor]),
  );
  assertFiniteNumbers(scaled);
  return scaled;
}

export function deriveImpactCoefficients(sourceFixture) {
  const fixture = validateSourceFixture(sourceFixture);
  const profiles = {};
  for (const model of fixture.models) {
    if (Object.hasOwn(profiles, model.profileId)) invalidFixture();
    const infrastructure = fixture.infrastructure[model.provider];
    const means = model.energyWh.map((value) => value.meanNormalized);
    const result = fitNonNegativeTokenLinear(fixture.queryShapes, means);
    const waterMlPerWh =
      infrastructure.onsiteWueLitresPerKwh / infrastructure.pue +
      infrastructure.offsiteWueLitresPerKwh;
    const carbonGPerWh = infrastructure.carbonIntensityKgPerKwh;
    const profile = {
      energy: result.energy,
      water: scaleCoefficients(result.energy, waterMlPerWh),
      carbon: scaleCoefficients(result.energy, carbonGPerWh),
      factors: { waterMlPerWh, carbonGPerWh },
      fit: result.fit,
    };
    assertFiniteNumbers(profile);
    profiles[model.profileId] = profile;
  }
  if (Object.keys(profiles).length !== expectedModels.size) invalidFixture();
  return { profiles };
}

export async function readSourceFixture() {
  return JSON.parse(
    await readFile(new URL("../data/how-hungry-ai-v6.json", import.meta.url), "utf8"),
  );
}

export function findRegistryDrift(registry, derived, derivationId) {
  const drift = [];
  if (
    !isRecord(registry) ||
    !Array.isArray(registry.profiles) ||
    !isRecord(derived) ||
    !isRecord(derived.profiles) ||
    derivationId !== expectedSourceId
  ) {
    return ["invalid-registry-or-derivation"];
  }
  const derivedProfileIds = Object.keys(derived.profiles).sort();
  const scientificProfiles = registry.profiles.filter(
    (profile) => isRecord(profile) && profile.derivationId === derivationId,
  );
  const scientificProfileIds = scientificProfiles
    .map((profile) => profile.id)
    .filter((profileId) => typeof profileId === "string");
  for (const profileId of derivedProfileIds) {
    const matches = scientificProfiles.filter((profile) => profile.id === profileId);
    if (matches.length === 0) {
      drift.push(`${profileId}:missing-profile`);
      continue;
    }
    if (matches.length > 1) drift.push(`${profileId}:duplicate-profile`);
    const profile = matches[0];
    const coefficients = derived.profiles[profileId];
    if (!isRecord(profile.indicators) || !isRecord(coefficients)) {
      drift.push(`${profileId}:invalid-profile`);
      continue;
    }
    for (const [indicator, expected] of Object.entries({
      energyWh: coefficients.energy,
      waterMl: coefficients.water,
      carbonG: coefficients.carbon,
    })) {
      const estimator = profile.indicators[indicator];
      if (!isRecord(estimator) || estimator.estimator !== "token-linear" || !isRecord(expected)) {
        drift.push(`${profileId}:${indicator}:wrong-estimator`);
        continue;
      }
      for (const key of coefficientKeys) {
        if (
          !Number.isFinite(estimator[key]) ||
          !Number.isFinite(expected[key]) ||
          Math.abs(estimator[key] - expected[key]) > comparisonTolerance
        ) {
          drift.push(`${profileId}:${indicator}:${key}`);
        }
      }
    }
  }
  for (const profileId of scientificProfileIds) {
    if (!derivedProfileIds.includes(profileId)) drift.push(`${profileId}:unexpected-profile`);
  }
  return [...new Set(drift)].sort();
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
  const drift = findRegistryDrift(registry, derived, fixture.source.id);
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
