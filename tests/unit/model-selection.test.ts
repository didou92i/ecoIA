import { describe, expect, it } from "vitest";

import { getModelProfileOptions, resolveModelProfile } from "../../src/impact/model-selection";

describe("model profile selection", () => {
  it("lists the current ChatGPT catalog plus its generic fallback", () => {
    const options = getModelProfileOptions("chatgpt");

    expect(options.map(({ id }) => id)).toEqual([
      "chatgpt-gpt-5-6-sol",
      "chatgpt-gpt-5-6-sol-pro",
      "chatgpt-gpt-5-5-instant",
      "chatgpt-gpt-5-4-thinking",
      "chatgpt-gpt-5-3-instant",
      "chatgpt-openai-o3",
      "openai-generic-v1",
    ]);
    expect(options.slice(0, -1).every((option) => option.isProxy && !option.isGeneric)).toBe(true);
    expect(
      options.slice(0, -1).every((option) => option.impactProfileId === "openai-generic-v1"),
    ).toBe(true);
    expect(options.some((option) => option.id === "openai-gpt-4o-v1")).toBe(false);
    expect(options.some((option) => option.id === "openai-gpt-4-1-v1")).toBe(false);
    expect(options.some((option) => option.id === "generic-assistant-v1")).toBe(false);
    expect(options.some((option) => option.id === "anthropic-claude-3-7-sonnet-v1")).toBe(false);
    expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
    expect(options.at(-1)?.id).toBe("openai-generic-v1");
    expect(options.every((option) => option.label.length > 0)).toBe(true);
  });

  it("offers both exact-variant Claude 3.5 profiles manually on Claude", () => {
    expect(getModelProfileOptions("claude")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "anthropic-claude-3-5-sonnet-v1", isGeneric: false }),
        expect.objectContaining({ id: "anthropic-claude-3-5-haiku-v1", isGeneric: false }),
      ]),
    );
  });

  it("prefers a compatible manual profile", () => {
    expect(
      resolveModelProfile({
        platform: "chatgpt",
        detected: { label: "Instantanée", observed: true },
        manualProfileId: "chatgpt-gpt-5-6-sol",
      }),
    ).toMatchObject({
      profileId: "openai-generic-v1",
      effectiveLabel: "GPT-5.6 Sol · proxy D",
      detectedLabel: "Instantanée",
      source: "manual",
      modelObserved: true,
      usesProxy: true,
    });
  });

  it.each([
    ["Instantanée", "GPT-5.5 Instant · proxy D"],
    ["Moyenne", "GPT-5.6 Sol · proxy D"],
    ["Élevée", "GPT-5.6 Sol · proxy D"],
    ["Très élevée", "GPT-5.6 Sol · proxy D"],
    ["Pro", "GPT-5.6 Sol Pro · proxy D"],
    ["GPT-5.4", "GPT-5.4 Thinking · proxy D"],
    ["GPT-5.3", "GPT-5.3 Instant · proxy D"],
    ["o3", "OpenAI o3 · proxy D"],
  ])(
    "recognizes the current ChatGPT label %s without claiming a direct measurement",
    (label, effectiveLabel) => {
      expect(
        resolveModelProfile({
          platform: "chatgpt",
          detected: { label, observed: true },
          manualProfileId: null,
        }),
      ).toMatchObject({
        profileId: "openai-generic-v1",
        effectiveLabel,
        source: "automatic",
        usesProxy: true,
      });
    },
  );

  it.each(["GPT-5.6 Sol beta", "GPT-5.5 Instant 2026-07-09", "super o3 mode"])(
    "fails closed for a suffixed or partial current ChatGPT label %s",
    (label) => {
      expect(
        resolveModelProfile({
          platform: "chatgpt",
          detected: { label, observed: true },
          manualProfileId: null,
        }),
      ).toMatchObject({ profileId: "openai-generic-v1", source: "generic" });
    },
  );

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
      usesProxy: false,
      methodNote: "Profil de calcul : OpenAI GPT-4o.",
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
      usesProxy: true,
      methodNote: "Modèle non identifié. Calcul via Google Gemini — profil générique, qualité D.",
    });
    expect(
      resolveModelProfile({
        platform: "chatgpt",
        detected: { label: "Future model", observed: true },
        manualProfileId: null,
      }),
    ).toEqual({
      profileId: "openai-generic-v1",
      effectiveLabel: "Future model · proxy D",
      detectedLabel: "Future model",
      source: "generic",
      modelObserved: true,
      usesProxy: true,
      methodNote:
        "Aucune donnée environnementale propre à Future model. Calcul via le proxy OpenAI générique, qualité D.",
    });
  });

  it.each([
    ["chatgpt", "GPT-4o mini", "openai-generic-v1"],
    ["chatgpt", "GPT-4.1 nano", "openai-generic-v1"],
    ["claude", "Claude 3.7 Sonnet Extended Thinking", "anthropic-generic-v1"],
    ["gemini", "Gemini 2.5 Pro", "google-generic-v1"],
    ["perplexity", "GPT-5.6 Terra Thinking", "perplexity-generic-v1"],
  ] as const)("uses %s generic for unsupported observed label %s", (platform, label, profileId) => {
    expect(
      resolveModelProfile({
        platform,
        detected: { label, observed: true },
        manualProfileId: null,
      }),
    ).toMatchObject({
      profileId,
      source: "generic",
      modelObserved: true,
      effectiveLabel: `${label} · proxy D`,
      usesProxy: true,
      methodNote: expect.stringContaining("qualité D"),
    });
  });

  it.each(["GPT-4o", "Claude 3.7 Sonnet", "GPT-5.6 Terra Thinking"])(
    "keeps a disclosed Perplexity model %s on the platform proxy",
    (label) => {
      expect(
        resolveModelProfile({
          platform: "perplexity",
          detected: { label, observed: true },
          manualProfileId: null,
        }),
      ).toMatchObject({
        profileId: "perplexity-generic-v1",
        effectiveLabel: `${label} · proxy D`,
        source: "generic",
        modelObserved: true,
        usesProxy: true,
        methodNote: expect.stringContaining("proxy Perplexity générique"),
      });
    },
  );

  it("names the Perplexity fallback as a generic profile even when manually selected", () => {
    expect(getModelProfileOptions("perplexity")).toEqual([
      expect.objectContaining({
        id: "perplexity-generic-v1",
        label: "Perplexity — profil générique",
        isGeneric: true,
        isProxy: true,
      }),
    ]);
  });
});
