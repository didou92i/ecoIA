import type { VisibleContextSnapshot } from "./adapter-contract";

const utf8Encoder = new TextEncoder();
const separator = " ";
const separatorUtf8Bytes = utf8Encoder.encode(separator).byteLength;

function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).byteLength;
}

function recentUtf8Suffix(text: string, maximumUtf8Bytes: number): string {
  if (maximumUtf8Bytes <= 0) return "";

  const codePoints = Array.from(text);
  let lowerBound = 0;
  let upperBound = codePoints.length;

  while (lowerBound < upperBound) {
    const middle = Math.floor((lowerBound + upperBound) / 2);
    const suffix = codePoints.slice(middle).join("");
    if (utf8ByteLength(suffix) <= maximumUtf8Bytes) {
      upperBound = middle;
    } else {
      lowerBound = middle + 1;
    }
  }

  const suffix = codePoints.slice(lowerBound).join("");
  return utf8ByteLength(suffix) <= maximumUtf8Bytes ? suffix : "";
}

export function selectRecentUtf8Context(
  fragments: readonly string[],
  maximumUtf8Bytes: number,
): VisibleContextSnapshot {
  const nonEmptyFragments = fragments.filter((fragment) => fragment.length > 0);
  if (nonEmptyFragments.length === 0) return { text: "", coverage: "complete" };

  let remainingUtf8Bytes = Math.max(0, maximumUtf8Bytes);
  let coverage: VisibleContextSnapshot["coverage"] = "complete";
  const selected: string[] = [];

  for (let index = nonEmptyFragments.length - 1; index >= 0; index -= 1) {
    const fragment = nonEmptyFragments[index];
    if (fragment === undefined) continue;
    const requiredUtf8Bytes =
      utf8ByteLength(fragment) + (selected.length > 0 ? separatorUtf8Bytes : 0);
    if (requiredUtf8Bytes <= remainingUtf8Bytes) {
      selected.unshift(fragment);
      remainingUtf8Bytes -= requiredUtf8Bytes;
      continue;
    }

    coverage = "partial";
    if (selected.length === 0) {
      const suffix = recentUtf8Suffix(fragment, remainingUtf8Bytes);
      if (suffix) selected.unshift(suffix);
    }
    break;
  }

  return { text: selected.join(separator), coverage };
}
