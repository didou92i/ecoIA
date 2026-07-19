import type { DetectedModel } from "../adapters/adapter-contract";
import type { PlatformId } from "../shared/contracts";
import { getCurrentChatGptChoices, matchCurrentChatGptChoice } from "./model-catalog";
import { getImpactProfile, impactRegistry, matchImpactProfileId } from "./profile-registry";

export type ModelResolutionSource = "automatic" | "manual" | "generic";

export interface ModelProfileOption {
  id: string;
  label: string;
  isGeneric: boolean;
  isProxy: boolean;
  impactProfileId: string;
}

export interface ModelResolution {
  profileId: string;
  effectiveLabel: string;
  detectedLabel: string;
  source: ModelResolutionSource;
  modelObserved: boolean;
  usesProxy: boolean;
  methodNote: string;
}

const internalGenericProfileId = "generic-assistant-v1";

const genericProxyDescriptions: Readonly<Record<string, string>> = {
  "openai-generic-v1": "le proxy OpenAI générique",
  "anthropic-generic-v1": "le proxy Claude générique",
  "google-generic-v1": "le proxy Gemini générique",
  "mistral-generic-v1": "le proxy Mistral générique",
  "perplexity-generic-v1": "le proxy Perplexity générique",
};

function toOption(profileId: string, isGeneric: boolean): ModelProfileOption {
  const profile = getImpactProfile(profileId);
  if (!profile) throw new Error("UNKNOWN_IMPACT_PROFILE");
  return {
    id: profile.id,
    label: profile.displayName,
    isGeneric,
    isProxy: isGeneric,
    impactProfileId: profile.id,
  };
}

function currentChatGptOptions(): ModelProfileOption[] {
  return getCurrentChatGptChoices().map((choice) => ({
    id: choice.id,
    label: choice.label,
    isGeneric: false,
    isProxy: true,
    impactProfileId: choice.impactProfileId,
  }));
}

export function getModelProfileOptions(platform: PlatformId): ModelProfileOption[] {
  const fallbackId = impactRegistry.platformFallbacks[platform];
  if (platform === "chatgpt") {
    return [...currentChatGptOptions(), toOption(fallbackId, true)];
  }
  const documentedProfileIds = impactRegistry.profiles
    .filter(
      (profile) =>
        profile.platforms.includes(platform) &&
        profile.id !== internalGenericProfileId &&
        profile.id !== fallbackId,
    )
    .map((profile) => profile.id)
    .sort((leftId, rightId) => {
      const left = getImpactProfile(leftId);
      const right = getImpactProfile(rightId);
      if (!left || !right) throw new Error("UNKNOWN_IMPACT_PROFILE");
      return left.displayName.localeCompare(right.displayName, "fr");
    });

  return [
    ...documentedProfileIds.map((profileId) => toOption(profileId, false)),
    toOption(fallbackId, true),
  ];
}

function resolveFromProfile(
  profileId: string,
  detected: DetectedModel,
  source: ModelResolutionSource,
  usesProxy = false,
  effectiveLabelOverride?: string,
): ModelResolution {
  const profile = getImpactProfile(profileId);
  if (!profile) throw new Error("UNKNOWN_IMPACT_PROFILE");
  const effectiveLabel = effectiveLabelOverride ?? profile.displayName;
  const displayedModelLabel = effectiveLabel.replace(/ · proxy D$/u, "");
  const proxyDescription =
    genericProxyDescriptions[profile.id] ?? `le profil ${profile.displayName}`;
  return {
    profileId: profile.id,
    effectiveLabel,
    detectedLabel: detected.label,
    source,
    modelObserved: detected.observed,
    usesProxy,
    methodNote:
      source === "generic" && !detected.observed
        ? `Modèle non identifié. Calcul via ${profile.displayName}, qualité D.`
        : usesProxy
          ? `Aucune donnée environnementale propre à ${displayedModelLabel}. Calcul via ${proxyDescription}, qualité D.`
          : `Profil de calcul : ${profile.displayName}.`,
  };
}

function resolveFromOption(
  option: ModelProfileOption,
  detected: DetectedModel,
  source: ModelResolutionSource,
): ModelResolution {
  return resolveFromProfile(
    option.impactProfileId,
    detected,
    source,
    option.isProxy,
    option.isProxy && !option.isGeneric ? `${option.label} · proxy D` : undefined,
  );
}

export function resolveModelProfile(input: {
  platform: PlatformId;
  detected: DetectedModel;
  manualProfileId: string | null;
}): ModelResolution {
  const options = getModelProfileOptions(input.platform);
  const manualProfile = options.find((option) => option.id === input.manualProfileId);
  if (manualProfile) {
    return resolveFromOption(manualProfile, input.detected, "manual");
  }

  const currentChatGptChoice =
    input.platform === "chatgpt" && input.detected.observed
      ? matchCurrentChatGptChoice(input.detected.label)
      : null;
  if (currentChatGptChoice) {
    return resolveFromProfile(
      currentChatGptChoice.impactProfileId,
      input.detected,
      "automatic",
      true,
      `${currentChatGptChoice.label} · proxy D`,
    );
  }

  const matchedProfileId = input.detected.observed
    ? matchImpactProfileId(input.platform, input.detected.label)
    : null;
  if (matchedProfileId) {
    return resolveFromProfile(matchedProfileId, input.detected, "automatic");
  }

  const observedLabel = input.detected.observed
    ? input.detected.label.replace(/\s+/gu, " ").trim().slice(0, 128)
    : "";
  return resolveFromProfile(
    impactRegistry.platformFallbacks[input.platform],
    input.detected,
    "generic",
    true,
    observedLabel ? `${observedLabel} · proxy D` : undefined,
  );
}
