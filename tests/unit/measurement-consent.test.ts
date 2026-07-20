import { describe, expect, it } from "vitest";

import {
  createMeasurementConsent,
  measurementConsentStorageKey,
  parseMeasurementConsent,
} from "../../src/privacy/measurement-consent";

describe("measurement consent", () => {
  it("uses a versioned, extension-scoped storage key", () => {
    expect(measurementConsentStorageKey).toBe("ecoia.measurement-consent.v1");
  });

  it.each([true, false])("creates and accepts the strict consent contract: %s", (granted) => {
    const consent = createMeasurementConsent(granted);

    expect(consent).toEqual({ version: 1, noticeVersion: 1, granted });
    expect(parseMeasurementConsent(consent)).toEqual(consent);
  });

  it.each([
    null,
    [],
    {},
    { version: 1, noticeVersion: 1 },
    { version: 1, noticeVersion: 1, granted: "yes" },
    { version: 2, noticeVersion: 1, granted: true },
    { version: 1, noticeVersion: 2, granted: true },
    { version: 1, noticeVersion: 1, granted: true, text: "conversation privée" },
  ])("rejects malformed, stale or extended consent values", (value) => {
    expect(parseMeasurementConsent(value)).toBeNull();
  });
});
