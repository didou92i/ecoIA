import type { VisibleTokenEstimate } from "../shared/contracts";
import { createRange } from "../shared/range";
import { carMetersFromCarbon, televisionSecondsFromEnergy } from "./equivalences";
import { getImpactProfile, impactRegistry } from "./profile-registry";
import type {
  ImpactEstimate,
  ImpactIndicator,
  IndicatorEstimator,
  IndicatorKey,
  ModelProxyEstimator,
} from "./profile-types";

const maximumProxyDepth = 12;

function hasVisibleTokens(tokens: VisibleTokenEstimate): boolean {
  return tokens.input.high > 0 || tokens.output.high > 0;
}

function linearValue(
  base: number,
  inputPer1k: number,
  outputPer1k: number,
  inputTokens: number,
  outputTokens: number,
): number {
  return base + (inputTokens / 1_000) * inputPer1k + (outputTokens / 1_000) * outputPer1k;
}

function calculateProxy(
  estimator: ModelProxyEstimator,
  tokens: VisibleTokenEstimate,
  depth: number,
): ImpactIndicator {
  if (depth >= maximumProxyDepth) throw new Error("IMPACT_PROXY_DEPTH_EXCEEDED");
  const targetProfile = getImpactProfile(estimator.profileId);
  if (!targetProfile) throw new Error("UNKNOWN_IMPACT_PROFILE");
  const target = calculateIndicatorEstimate(
    targetProfile.indicators[estimator.indicator],
    tokens,
    targetProfile.id,
    depth + 1,
  );
  return {
    range: createRange(
      target.range.low * estimator.lowMultiplier,
      target.range.central,
      target.range.high * estimator.highMultiplier,
    ),
    confidence: estimator.confidence,
    sourceProfileId: target.sourceProfileId,
    sourceId: estimator.sourceId,
  };
}

export function calculateIndicatorEstimate(
  estimator: IndicatorEstimator,
  tokens: VisibleTokenEstimate,
  profileId: string,
  depth = 0,
): ImpactIndicator {
  if (!hasVisibleTokens(tokens)) {
    return {
      range: createRange(0, 0, 0),
      confidence: estimator.confidence,
      sourceProfileId: profileId,
      sourceId: estimator.sourceId,
    };
  }
  if (estimator.estimator === "model-proxy") {
    return calculateProxy(estimator, tokens, depth);
  }
  if (estimator.estimator === "prompt-median") {
    return {
      range: createRange(
        estimator.perPrompt * estimator.lowMultiplier,
        estimator.perPrompt,
        estimator.perPrompt * estimator.highMultiplier,
      ),
      confidence: estimator.confidence,
      sourceProfileId: profileId,
      sourceId: estimator.sourceId,
    };
  }

  const low =
    linearValue(
      estimator.base,
      estimator.inputPer1k,
      estimator.outputPer1k,
      tokens.input.low,
      tokens.output.low,
    ) * estimator.lowMultiplier;
  const central = linearValue(
    estimator.base,
    estimator.inputPer1k,
    estimator.outputPer1k,
    tokens.input.central,
    tokens.output.central,
  );
  const high =
    linearValue(
      estimator.base,
      estimator.inputPer1k,
      estimator.outputPer1k,
      tokens.input.high,
      tokens.output.high,
    ) * estimator.highMultiplier;
  return {
    range: createRange(low, central, high),
    confidence: estimator.confidence,
    sourceProfileId: profileId,
    sourceId: estimator.sourceId,
  };
}

function derivedIndicator(
  source: ImpactIndicator,
  range: ImpactIndicator["range"],
): ImpactIndicator {
  return { ...source, range };
}

export function estimateImpact(profileId: string, tokens: VisibleTokenEstimate): ImpactEstimate {
  const profile = getImpactProfile(profileId);
  if (!profile) throw new Error("UNKNOWN_IMPACT_PROFILE");

  const estimate = (indicator: IndicatorKey) =>
    calculateIndicatorEstimate(profile.indicators[indicator], tokens, profile.id);
  const energyWh = estimate("energyWh");
  const waterMl = estimate("waterMl");
  const carbonG = estimate("carbonG");
  return {
    energyWh,
    waterMl,
    carbonG,
    televisionSeconds: derivedIndicator(energyWh, televisionSecondsFromEnergy(energyWh.range)),
    carMeters: derivedIndicator(carbonG, carMetersFromCarbon(carbonG.range)),
    profileId: profile.id,
    methodologyVersion: impactRegistry.methodologyVersion,
  };
}
