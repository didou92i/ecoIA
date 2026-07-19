import type { VisibleContextSnapshot } from "./adapter-contract";

const utf8Encoder = new TextEncoder();
const separator = " ";
const separatorUtf8Bytes = utf8Encoder.encode(separator).byteLength;

function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).byteLength;
}

function previousCodePointStart(text: string, end: number): number {
  let start = end - 1;
  const trailingCodeUnit = text.charCodeAt(start);
  if (trailingCodeUnit >= 0xdc00 && trailingCodeUnit <= 0xdfff && start > 0) {
    const leadingCodeUnit = text.charCodeAt(start - 1);
    if (leadingCodeUnit >= 0xd800 && leadingCodeUnit <= 0xdbff) start -= 1;
  }
  return start;
}

function utf8BytesAt(text: string, start: number): number {
  const codePoint = text.codePointAt(start);
  if (codePoint === undefined) throw new Error("INVALID_UNICODE_POSITION");
  return codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
}

function recentUtf8Suffix(text: string, maximumUtf8Bytes: number): string {
  if (maximumUtf8Bytes <= 0) return "";
  let remainingUtf8Bytes = maximumUtf8Bytes;
  let start = text.length;
  while (start > 0) {
    const previousStart = previousCodePointStart(text, start);
    const utf8Bytes = utf8BytesAt(text, previousStart);
    if (utf8Bytes > remainingUtf8Bytes) break;
    remainingUtf8Bytes -= utf8Bytes;
    start = previousStart;
  }
  return text.slice(start);
}

export function selectRecentNormalizedUtf8Text(
  text: string,
  maximumUtf8Bytes: number,
): VisibleContextSnapshot {
  if (maximumUtf8Bytes <= 0) {
    return { text: "", coverage: text.length === 0 ? "complete" : "partial" };
  }
  let remainingUtf8Bytes = Math.max(0, Math.floor(maximumUtf8Bytes));
  let start = text.length;
  while (start > 0) {
    const previousStart = previousCodePointStart(text, start);
    const utf8Bytes = utf8BytesAt(text, previousStart);
    if (utf8Bytes > remainingUtf8Bytes) break;
    remainingUtf8Bytes -= utf8Bytes;
    start = previousStart;
  }

  return {
    text: text.slice(start).replace(/\s+/gu, separator).trim(),
    coverage: start === 0 ? "complete" : "partial",
  };
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
