import { createRange, type EstimateRange } from "../shared/range";
import { tokenCalibration, type TokenizerFamily } from "./calibration";
import { extractTextFeatures } from "./text-features";

export type { TokenizerFamily } from "./calibration";

export function estimateVisibleTokens(text: string, family: TokenizerFamily): EstimateRange {
  const features = extractTextFeatures(text, tokenCalibration.maximumUtf8Bytes);
  if (features.nonWhitespaceCodePoints === 0) {
    return createRange(0, 0, 0);
  }

  const calibration = tokenCalibration.families[family];
  const charactersPerToken = features.looksLikeCode
    ? calibration.codeCharactersPerToken
    : calibration.proseCharactersPerToken;
  const rawCentral =
    features.codePoints / charactersPerToken +
    features.nonLatinLetters * calibration.nonLatinTokenWeight +
    features.emoji * calibration.emojiTokenWeight +
    features.codeMarkers * calibration.codeMarkerTokenWeight;
  const central = Math.max(1, Math.round(rawCentral));
  const low = Math.max(1, Math.floor(central * calibration.lowMultiplier));
  const high = Math.max(central, Math.ceil(central * calibration.highMultiplier));
  return createRange(low, central, high);
}
