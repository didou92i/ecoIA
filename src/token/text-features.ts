export interface TextFeatures {
  utf8Bytes: number;
  codePoints: number;
  nonWhitespaceCodePoints: number;
  words: number;
  whitespace: number;
  punctuation: number;
  lineBreaks: number;
  codeMarkers: number;
  nonLatinLetters: number;
  emoji: number;
  looksLikeCode: boolean;
}

const letterOrNumberPattern = /[\p{L}\p{N}_]/u;
const latinLetterOrNumberPattern = /[\p{Script=Latin}\p{N}_]/u;
const punctuationPattern = /\p{P}/u;
const emojiPattern = /\p{Extended_Pictographic}/u;
const codeMarkerPattern = /[{}[\]();=<>:+*/|&]/u;

function utf8Width(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

export function extractTextFeatures(text: string, maximumUtf8Bytes: number): TextFeatures {
  const features: TextFeatures = {
    utf8Bytes: 0,
    codePoints: 0,
    nonWhitespaceCodePoints: 0,
    words: 0,
    whitespace: 0,
    punctuation: 0,
    lineBreaks: 0,
    codeMarkers: 0,
    nonLatinLetters: 0,
    emoji: 0,
    looksLikeCode: false,
  };
  let insideWord = false;

  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    features.utf8Bytes += utf8Width(codePoint);
    if (features.utf8Bytes > maximumUtf8Bytes) {
      throw new Error("TEXT_SIZE_LIMIT_EXCEEDED");
    }

    features.codePoints += 1;
    const isWhitespace = /\s/u.test(character);
    const isWord = letterOrNumberPattern.test(character);
    if (isWhitespace) {
      features.whitespace += 1;
      if (character === "\n" || character === "\r") features.lineBreaks += 1;
    } else {
      features.nonWhitespaceCodePoints += 1;
    }
    if (isWord && !insideWord) features.words += 1;
    insideWord = isWord;
    if (punctuationPattern.test(character)) features.punctuation += 1;
    if (codeMarkerPattern.test(character)) features.codeMarkers += 1;
    if (isWord && !latinLetterOrNumberPattern.test(character)) features.nonLatinLetters += 1;
    if (emojiPattern.test(character)) features.emoji += 1;
  }

  features.looksLikeCode =
    features.codeMarkers >= 6 &&
    (features.lineBreaks > 0 || features.codeMarkers >= Math.max(10, features.words * 0.5));
  return features;
}
