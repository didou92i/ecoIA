import { describe, expect, it } from "vitest";

import type { NumericInteractionEvent } from "../../src/shared/contracts";
import {
  validateNumericInteractionEvent,
  validateResetSessionMessage,
} from "../../src/shared/validation";

const validEvent: NumericInteractionEvent = {
  version: 1,
  eventId: "event-123",
  tabSessionId: "tab-session-456",
  sequence: 3,
  platform: "chatgpt",
  modelProfileId: "openai-gpt-4o-v1",
  phase: "completed",
  tokens: {
    input: { low: 90, central: 100, high: 110 },
    output: { low: 180, central: 200, high: 220 },
    source: "estimated",
  },
  generatedAt: 1_721_318_400_000,
};

describe("numeric interaction event validation", () => {
  it("accepts the strict public contract", () => {
    expect(validateNumericInteractionEvent(validEvent)).toEqual({ ok: true, value: validEvent });
  });

  it.each(["prompt", "response", "text", "url", "conversationId", "unexpected"])(
    "rejects forbidden or unknown root field %s",
    (propertyName) => {
      const payload = { ...validEvent, [propertyName]: "sensitive value" };
      expect(validateNumericInteractionEvent(payload)).toEqual({
        ok: false,
        error: "INVALID_MESSAGE",
      });
    },
  );

  it("rejects malformed nested ranges and unknown nested fields", () => {
    const malformed = {
      ...validEvent,
      tokens: {
        ...validEvent.tokens,
        input: { low: 100, central: 80, high: 110, rawText: "never allowed" },
      },
    };
    expect(validateNumericInteractionEvent(malformed)).toEqual({
      ok: false,
      error: "INVALID_MESSAGE",
    });
  });

  it.each(["openai", "unknown", "", null])("rejects unsupported platform %s", (platform) => {
    expect(validateNumericInteractionEvent({ ...validEvent, platform })).toEqual({
      ok: false,
      error: "INVALID_MESSAGE",
    });
  });

  it.each(["starting", "error", "", null])("rejects unsupported phase %s", (phase) => {
    expect(validateNumericInteractionEvent({ ...validEvent, phase })).toEqual({
      ok: false,
      error: "INVALID_MESSAGE",
    });
  });

  it("bounds token estimates", () => {
    const tooLarge = {
      ...validEvent,
      tokens: {
        ...validEvent.tokens,
        output: { low: 1, central: 2, high: 10_000_001 },
      },
    };
    expect(validateNumericInteractionEvent(tooLarge).ok).toBe(false);
  });

  it.each([
    { eventId: "" },
    { eventId: "a".repeat(129) },
    { tabSessionId: "contains spaces" },
    { modelProfileId: "../profile" },
    { sequence: -1 },
    { sequence: 1.5 },
    { generatedAt: Number.POSITIVE_INFINITY },
  ])("rejects unsafe identifiers and numbers: $eventId", (change) => {
    expect(validateNumericInteractionEvent({ ...validEvent, ...change }).ok).toBe(false);
  });

  it("does not reflect rejected values in the stable error", () => {
    const secret = "private prompt content";
    const result = validateNumericInteractionEvent({ ...validEvent, prompt: secret });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

describe("session reset validation", () => {
  it("accepts only an ephemeral numeric-boundary reset message", () => {
    expect(
      validateResetSessionMessage({ version: 1, kind: "reset-session", tabSessionId: "tab-1" }),
    ).toEqual({
      ok: true,
      value: { version: 1, kind: "reset-session", tabSessionId: "tab-1" },
    });
  });

  it("rejects conversation identifiers and unknown fields", () => {
    expect(
      validateResetSessionMessage({
        version: 1,
        kind: "reset-session",
        tabSessionId: "tab-1",
        conversationId: "private-id",
      }),
    ).toEqual({ ok: false, error: "INVALID_MESSAGE" });
  });
});
