import { describe, expect, it } from "vitest";

import { tokenCalibration } from "../../src/token/calibration";
import { selectRecentUtf8Context } from "../../src/adapters/visible-context";

const encoder = new TextEncoder();

describe("selectRecentUtf8Context", () => {
  it("returns a complete empty snapshot when there are no fragments", () => {
    expect(selectRecentUtf8Context([], 16)).toEqual({ text: "", coverage: "complete" });
  });

  it("retains selected fragments in reading order", () => {
    expect(selectRecentUtf8Context(["ancienne question", "réponse récente"], 35)).toEqual({
      text: "ancienne question réponse récente",
      coverage: "complete",
    });
  });

  it("retains the newest fragments first when the budget omits older text", () => {
    expect(selectRecentUtf8Context(["premier", "milieu", "dernier"], 15)).toEqual({
      text: "milieu dernier",
      coverage: "partial",
    });
  });

  it("accounts for UTF-8 bytes and ASCII separators exactly", () => {
    expect(selectRecentUtf8Context(["é", "🙂"], 7)).toEqual({
      text: "é 🙂",
      coverage: "complete",
    });
    expect(selectRecentUtf8Context(["a", "bb", "ccc"], 6)).toEqual({
      text: "bb ccc",
      coverage: "partial",
    });
  });

  it("uses a valid Unicode suffix when the newest fragment exceeds the budget", () => {
    const context = selectRecentUtf8Context(["texte ancien", "é🙂"], 4);

    expect(context).toEqual({ text: "🙂", coverage: "partial" });
    expect(encoder.encode(context.text).byteLength).toBeLessThanOrEqual(4);
  });

  it("bounds a truncated result by the validated calibration limit", () => {
    const context = selectRecentUtf8Context(
      ["é".repeat(Math.ceil(tokenCalibration.maximumUtf8Bytes / 2) + 1)],
      tokenCalibration.maximumUtf8Bytes,
    );

    expect(context.coverage).toBe("partial");
    expect(encoder.encode(context.text).byteLength).toBeLessThanOrEqual(
      tokenCalibration.maximumUtf8Bytes,
    );
  });
});
