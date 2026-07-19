import type { DetectedModel } from "../adapters/adapter-contract";
import type { PlatformId } from "../shared/contracts";
import {
  getImpactProfile,
  impactRegistry,
  matchImpactProfileId,
} from "./profile-registry";

export type ModelResolutionSource = "automatic" | "manual" | "generic";

export interface ModelProfileOption {
  id: string;
  label: string;
  isGeneric: boolean;
}

export interface ModelResolution {
  profileId: string;
  effectiveLabel: string;
  detectedLabel: string;
  source: ModelResolutionSource;
  modelObserved: boolean;
}

const internalGenericProfileId = "generic-assistant-v1";

function toOption(profileId: string, isGeneric: boolean): ModelProfileOption {
  const profile = getImpactProfile(profileId);
  if (!profile) throw new Error("UNKNOWN_IMPACT_PROFILE");
  return { id: profile.id, label: profile.displayName, isGeneric };
}

export function getModelProfileOptions(platform: PlatformId): ModelProfileOption[] {
  const fallbackId = impactRegistry.platformFallbacks[platform];
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

  return [...documentedProfileIds.map((profileId) => toOption(profileId, false)), toOption(fallbackId, true)];
}

function resolveFromProfile(
  profileId: string,
  detected: DetectedModel,
  source: ModelResolutionSource,
): ModelResolution {
  const profile = getImpactProfile(profileId);
  if (!profile) throw new Error("UNKNOWN_IMPACT_PROFILE");
  return {
    profileId: profile.id,
    effectiveLabel: profile.displayName,
    detectedLabel: detected.label,
    source,
    modelObserved: detected.observed,
  };
}

export function resolveModelProfile(input: {
  platform: PlatformId;
  detected: DetectedModel;
  manualProfileId: string | null;
}): ModelResolution {
  const options = getModelProfileOptions(input.platform);
  const manualProfile = options.find((option) => option.id === input.manualProfileId);
  if (manualProfile) {
    return resolveFromProfile(manualProfile.id, input.detected, "manual");
  }

  const matchedProfileId = input.detected.observed
    ? matchImpactProfileId(input.platform, input.detected.label)
    : null;
  if (matchedProfileId) {
    return resolveFromProfile(matchedProfileId, input.detected, "automatic");
  }

  return resolveFromProfile(impactRegistry.platformFallbacks[input.platform], input.detected, "generic");
}
