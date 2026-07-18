export function conversationChanged(previous: string | null, current: string | null): boolean {
  return previous !== null && current !== null && previous !== current;
}

export function createEphemeralSessionId(
  randomUUID: () => string = () => crypto.randomUUID(),
): string {
  return randomUUID();
}
