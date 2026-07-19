import {
  interactionPhases,
  type NumericInteractionEvent,
  platformIds,
  type ResetSessionMessage,
} from "./contracts";

const maximumTokenCount = 10_000_000;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: "INVALID_MESSAGE" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(record);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}

function isBoundedIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function isNonNegativeBoundedInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveBoundedInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function isEstimateRange(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["low", "central", "high"])) {
    return false;
  }
  const { low, central, high } = value;
  return (
    typeof low === "number" &&
    typeof central === "number" &&
    typeof high === "number" &&
    Number.isFinite(low) &&
    Number.isFinite(central) &&
    Number.isFinite(high) &&
    low >= 0 &&
    low <= central &&
    central <= high &&
    high <= maximumTokenCount
  );
}

function isVisibleTokenEstimate(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["input", "output", "source"])) {
    return false;
  }
  return (
    isEstimateRange(value.input) &&
    isEstimateRange(value.output) &&
    (value.source === "estimated" || value.source === "observed")
  );
}

export function validateNumericInteractionEvent(
  value: unknown,
): ValidationResult<NumericInteractionEvent> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "version",
      "eventId",
      "tabSessionId",
      "sequence",
      "platform",
      "modelProfileId",
      "phase",
      "tokens",
      "generatedAt",
    ]) ||
    value.version !== 1 ||
    !isBoundedIdentifier(value.eventId) ||
    !isBoundedIdentifier(value.tabSessionId) ||
    !isPositiveBoundedInteger(value.sequence) ||
    !platformIds.includes(value.platform as (typeof platformIds)[number]) ||
    !isBoundedIdentifier(value.modelProfileId) ||
    !interactionPhases.includes(value.phase as (typeof interactionPhases)[number]) ||
    !isVisibleTokenEstimate(value.tokens) ||
    !isNonNegativeBoundedInteger(value.generatedAt)
  ) {
    return { ok: false, error: "INVALID_MESSAGE" };
  }

  return { ok: true, value: value as unknown as NumericInteractionEvent };
}

export function validateResetSessionMessage(value: unknown): ValidationResult<ResetSessionMessage> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "kind", "tabSessionId"]) ||
    value.version !== 1 ||
    value.kind !== "reset-session" ||
    !isBoundedIdentifier(value.tabSessionId)
  ) {
    return { ok: false, error: "INVALID_MESSAGE" };
  }
  return { ok: true, value: value as unknown as ResetSessionMessage };
}
