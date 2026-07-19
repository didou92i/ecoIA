import type { SemanticAdapterConfiguration } from "../adapters/semantic-adapter";
import type { CreateEcoIaSemanticAdapter, StartEcoIaContentScript } from "./core-entry";

export function startSemanticAdapter(configuration: SemanticAdapterConfiguration): void {
  const contentGlobal = globalThis as typeof globalThis & {
    __ecoIAStartContentScript?: StartEcoIaContentScript;
    __ecoIACreateSemanticAdapter?: CreateEcoIaSemanticAdapter;
  };
  const start = contentGlobal.__ecoIAStartContentScript;
  const createAdapter = contentGlobal.__ecoIACreateSemanticAdapter;
  if (typeof start === "function" && typeof createAdapter === "function") {
    void start(createAdapter(configuration)).catch(() => undefined);
  }
}
