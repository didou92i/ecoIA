import type { SemanticAdapterConfiguration } from "../adapters/semantic-adapter";
import type {
  CreateEcoIaSemanticAdapter,
  RecognizeEcoIaModelLabel,
  StartEcoIaContentScript,
} from "./core-entry";

export function startSemanticAdapter(configuration: SemanticAdapterConfiguration): void {
  const contentGlobal = globalThis as typeof globalThis & {
    __ecoIAStartContentScript?: StartEcoIaContentScript;
    __ecoIACreateSemanticAdapter?: CreateEcoIaSemanticAdapter;
    __ecoIARecognizeModelLabel?: RecognizeEcoIaModelLabel;
  };
  const start = contentGlobal.__ecoIAStartContentScript;
  const createAdapter = contentGlobal.__ecoIACreateSemanticAdapter;
  if (typeof start === "function" && typeof createAdapter === "function") {
    const recognizeModelLabel = contentGlobal.__ecoIARecognizeModelLabel;
    const runtimeConfiguration =
      configuration.platform === "chatgpt" &&
      configuration.modelLabelIsRecognized === undefined &&
      typeof recognizeModelLabel === "function"
        ? {
            ...configuration,
            modelLabelIsRecognized: (label: string) =>
              recognizeModelLabel(configuration.platform, label),
          }
        : configuration;
    void start(createAdapter(runtimeConfiguration)).catch(() => undefined);
  }
}
