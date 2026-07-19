import type { PlatformAdapter } from "../adapters/adapter-contract";
import {
  createSemanticAdapter,
  type SemanticAdapterConfiguration,
} from "../adapters/semantic-adapter";
import { startContentScript } from "./content-entry";

export type StartEcoIaContentScript = (adapter: PlatformAdapter) => Promise<unknown>;
export type CreateEcoIaSemanticAdapter = (
  configuration: SemanticAdapterConfiguration,
) => PlatformAdapter;

const contentGlobal = globalThis as typeof globalThis & {
  __ecoIAStartContentScript?: StartEcoIaContentScript;
  __ecoIACreateSemanticAdapter?: CreateEcoIaSemanticAdapter;
};

contentGlobal.__ecoIAStartContentScript = startContentScript;
contentGlobal.__ecoIACreateSemanticAdapter = createSemanticAdapter;
