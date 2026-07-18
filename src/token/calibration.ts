import calibrationData from "../../data/token-calibration.json";

export const tokenizerFamilies = ["openai", "claude", "gemini", "mistral", "generic"] as const;
export type TokenizerFamily = (typeof tokenizerFamilies)[number];

export interface FamilyCalibration {
  proseCharactersPerToken: number;
  codeCharactersPerToken: number;
  nonLatinTokenWeight: number;
  emojiTokenWeight: number;
  codeMarkerTokenWeight: number;
  lowMultiplier: number;
  highMultiplier: number;
}

interface TokenCalibration {
  version: string;
  maximumUtf8Bytes: number;
  families: Record<TokenizerFamily, FamilyCalibration>;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validateCalibration(value: typeof calibrationData): TokenCalibration {
  if (!value.version || !Number.isSafeInteger(value.maximumUtf8Bytes)) {
    throw new Error("INVALID_TOKEN_CALIBRATION");
  }
  for (const family of tokenizerFamilies) {
    const profile = value.families[family];
    if (
      !profile ||
      !isPositiveFinite(profile.proseCharactersPerToken) ||
      !isPositiveFinite(profile.codeCharactersPerToken) ||
      !Number.isFinite(profile.nonLatinTokenWeight) ||
      !Number.isFinite(profile.emojiTokenWeight) ||
      !Number.isFinite(profile.codeMarkerTokenWeight) ||
      !isPositiveFinite(profile.lowMultiplier) ||
      !isPositiveFinite(profile.highMultiplier) ||
      profile.lowMultiplier > 0.9 ||
      profile.highMultiplier < 1.1
    ) {
      throw new Error("INVALID_TOKEN_CALIBRATION");
    }
  }
  return value as TokenCalibration;
}

export const tokenCalibration = validateCalibration(calibrationData);
