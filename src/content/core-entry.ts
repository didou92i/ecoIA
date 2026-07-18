import type { PlatformAdapter } from "../adapters/adapter-contract";
import { startContentScript } from "./content-entry";

export type StartEcoIaContentScript = (adapter: PlatformAdapter) => Promise<unknown>;

const contentGlobal = globalThis as typeof globalThis & {
  __ecoIAStartContentScript?: StartEcoIaContentScript;
};

contentGlobal.__ecoIAStartContentScript = startContentScript;
