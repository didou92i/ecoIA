import type { PlatformAdapter } from "../adapters/adapter-contract";
import {
  createSemanticAdapter,
  type SemanticAdapterConfiguration,
} from "../adapters/semantic-adapter";
import { matchCurrentChatGptChoice } from "../impact/model-catalog";
import { matchImpactProfileId } from "../impact/profile-registry";
import type { PlatformId } from "../shared/contracts";
import { startContentScript } from "./content-entry";

export type StartEcoIaContentScript = (adapter: PlatformAdapter) => Promise<unknown>;
export type CreateEcoIaSemanticAdapter = (
  configuration: SemanticAdapterConfiguration,
) => PlatformAdapter;
export type RecognizeEcoIaModelLabel = (platform: PlatformId, label: string) => boolean;

const contentGlobal = globalThis as typeof globalThis & {
  __ecoIAStartContentScript?: StartEcoIaContentScript;
  __ecoIACreateSemanticAdapter?: CreateEcoIaSemanticAdapter;
  __ecoIARecognizeModelLabel?: RecognizeEcoIaModelLabel;
};

contentGlobal.__ecoIAStartContentScript = startContentScript;
contentGlobal.__ecoIACreateSemanticAdapter = createSemanticAdapter;
contentGlobal.__ecoIARecognizeModelLabel = (platform, label) =>
  (platform === "chatgpt" && matchCurrentChatGptChoice(label) !== null) ||
  matchImpactProfileId(platform, label) !== null;
