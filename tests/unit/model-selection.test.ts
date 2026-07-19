import { describe, expect, it } from "vitest";

import { getModelProfileOptions, resolveModelProfile } from "../../src/impact/model-selection";

describe("model profile selection", () => {
  it("lists only documented ChatGPT profiles plus its generic fallback", () => {
    const options = getModelProfileOptions("chatgpt");

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "openai-gpt-4o-v1", isGeneric: false }),
        expect.objectContaining({ id: "openai-generic-v1", isGeneric: true }),
      ]),
    );
    expect(options.some((option) => option.id === "generic-assistant-v1")).toBe(false);
    expect(options.some((option) => option.id === "anthropic-claude-3-7-sonnet-v1")).toBe(false);
    expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
    expect(options.at(-1)?.id).toBe("openai-generic-v1");
    expect(options.every((option) => option.label.length > 0)).toBe(true);
  });

  it("prefers a compatible manual profile", () => {
    expect(
      resolveModelProfile({
        platform: "chatgpt",
        detected: { label: "GPT-4o", observed: true },
        manualProfileId: "openai-gpt-4-1-v1",
      }),
    ).toEqual({
      profileId: "openai-gpt-4-1-v1",
      effectiveLabel: "OpenAI GPT-4.1",
      detectedLabel: "GPT-4o",
      source: "manual",
      modelObserved: true,
    });
  });

  it("uses a recognized observed label when no compatible manual profile exists", () => {
    expect(
      resolveModelProfile({
        platform: "chatgpt",
        detected: { label: "GPT-4o", observed: true },
        manualProfileId: null,
      }),
    ).toEqual({
      profileId: "openai-gpt-4o-v1",
      effectiveLabel: "OpenAI GPT-4o",
      detectedLabel: "GPT-4o",
      source: "automatic",
      modelObserved: true,
    });
  });

  it.each([
    ["unknown", "unknown-profile-v1"],
    ["cross-platform", "anthropic-claude-3-7-sonnet-v1"],
  ])("rejects a %s manual profile and continues resolution", (_case, manualProfileId) => {
    expect(
      resolveModelProfile({
        platform: "chatgpt",
        detected: { label: "GPT-4o", observed: true },
        manualProfileId,
      }),
    ).toMatchObject({
      profileId: "openai-gpt-4o-v1",
      source: "automatic",
    });
  });

  it("uses the platform fallback when the label is unobserved or not documented", () => {
    expect(
      resolveModelProfile({
        platform: "gemini",
        detected: { label: "Gemini · modèle non communiqué", observed: false },
        manualProfileId: null,
      }),
    ).toEqual({
      profileId: "google-generic-v1",
      effectiveLabel: "Google Gemini — profil générique",
      detectedLabel: "Gemini · modèle non communiqué",
      source: "generic",
      modelObserved: false,
    });
    expect(
      resolveModelProfile({
        platform: "chatgpt",
        detected: { label: "Future model", observed: true },
        manualProfileId: null,
      }),
    ).toMatchObject({
      profileId: "openai-generic-v1",
      source: "generic",
    });
  });
});
