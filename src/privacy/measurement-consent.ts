export const measurementConsentStorageKey = "ecoia.measurement-consent.v1";

export interface MeasurementConsent {
  version: 1;
  noticeVersion: 1;
  granted: boolean;
}

export function createMeasurementConsent(granted: boolean): MeasurementConsent {
  return { version: 1, noticeVersion: 1, granted };
}

export function parseMeasurementConsent(value: unknown): MeasurementConsent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 3 ||
    !keys.includes("version") ||
    !keys.includes("noticeVersion") ||
    !keys.includes("granted") ||
    record.version !== 1 ||
    record.noticeVersion !== 1 ||
    typeof record.granted !== "boolean"
  ) {
    return null;
  }

  return { version: 1, noticeVersion: 1, granted: record.granted };
}
