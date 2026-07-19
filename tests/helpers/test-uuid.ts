export function testUuid(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0 || index > 0xffff_ffff_ffff) {
    throw new Error("INVALID_TEST_UUID_INDEX");
  }
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}
