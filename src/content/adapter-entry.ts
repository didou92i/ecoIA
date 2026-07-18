import type { PlatformAdapter } from "../adapters/adapter-contract";
import type { StartEcoIaContentScript } from "./core-entry";

export function startAdapter(adapter: PlatformAdapter): void {
  const contentGlobal = globalThis as typeof globalThis & {
    __ecoIAStartContentScript?: StartEcoIaContentScript;
  };
  const start = contentGlobal.__ecoIAStartContentScript;
  if (typeof start === "function") void start(adapter).catch(() => undefined);
}
