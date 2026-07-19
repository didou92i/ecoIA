import { describe, expect, it } from "vitest";

import rawCatalog from "../../data/model-catalog.json";
import {
  getCurrentChatGptChoices,
  matchCurrentChatGptChoice,
  modelCatalog,
  validateModelCatalog,
} from "../../src/impact/model-catalog";

describe("current model catalog", () => {
  it("loads a small, dated ChatGPT catalog without impact coefficients", () => {
    expect(modelCatalog.version).toBe("2026-07-19.2");
    expect(modelCatalog.maximumAgeDays).toBe(90);
    expect(modelCatalog.platforms.chatgpt).toHaveLength(6);
    expect(JSON.stringify(rawCatalog)).not.toMatch(/inputPer1k|outputPer1k|perPrompt/iu);
  });

  it.each([
    ["Instantanée", "chatgpt-gpt-5-5-instant"],
    ["OpenAI GPT-5.6 Sol", "chatgpt-gpt-5-6-sol"],
    ["Très élevée", "chatgpt-gpt-5-6-sol"],
    ["Pro", "chatgpt-gpt-5-6-sol-pro"],
    ["GPT-5.4", "chatgpt-gpt-5-4-thinking"],
    ["GPT-5.3", "chatgpt-gpt-5-3-instant"],
    ["o3", "chatgpt-openai-o3"],
  ])("matches the exact current label %s", (label, expectedId) => {
    expect(matchCurrentChatGptChoice(label)?.id).toBe(expectedId);
  });

  it.each(["GPT-5.6 Sol beta", "mode Pro étendu", "o3-mini", "GPT-5.7"])(
    "does not infer an unsupported label %s",
    (label) => expect(matchCurrentChatGptChoice(label)).toBeNull(),
  );

  it("fails closed on the review deadline for choices with an announced retirement", () => {
    expect(
      modelCatalog.platforms.chatgpt
        .filter((choice) => choice.reviewBy)
        .map(({ id, reviewBy }) => [id, reviewBy]),
    ).toEqual([
      ["chatgpt-gpt-5-4-thinking", "2026-07-23"],
      ["chatgpt-openai-o3", "2026-08-26"],
    ]);

    expect(
      getCurrentChatGptChoices(new Date("2026-07-22T23:59:59Z")).some(
        (choice) => choice.id === "chatgpt-gpt-5-4-thinking",
      ),
    ).toBe(true);
    expect(
      getCurrentChatGptChoices(new Date("2026-07-23T00:00:00Z")).some(
        (choice) => choice.id === "chatgpt-gpt-5-4-thinking",
      ),
    ).toBe(false);
    expect(matchCurrentChatGptChoice("GPT-5.4", new Date("2026-07-23T00:00:00Z"))).toBeNull();
  });

  it("rejects unknown fields, duplicate aliases and a non-D target profile", () => {
    const unknownField = structuredClone(rawCatalog) as Record<string, unknown>;
    unknownField.extra = true;
    expect(() => validateModelCatalog(unknownField)).toThrow("INVALID_MODEL_CATALOG");

    const duplicateAlias = structuredClone(rawCatalog);
    duplicateAlias.platforms.chatgpt[1]?.aliases.push("Moyenne");
    expect(() => validateModelCatalog(duplicateAlias)).toThrow("INVALID_MODEL_CATALOG");

    const directMeasurementClaim = structuredClone(rawCatalog);
    const firstChoice = directMeasurementClaim.platforms.chatgpt[0];
    if (!firstChoice) throw new Error("MISSING_MODEL_FIXTURE");
    firstChoice.impactProfileId = "openai-gpt-4o-v1";
    expect(() => validateModelCatalog(directMeasurementClaim)).toThrow("INVALID_MODEL_CATALOG");
  });
});
