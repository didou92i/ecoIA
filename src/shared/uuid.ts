const canonicalUuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function isCanonicalUuidV4(value: unknown): value is string {
  return typeof value === "string" && canonicalUuidV4Pattern.test(value);
}
