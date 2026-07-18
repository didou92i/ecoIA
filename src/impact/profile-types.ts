import type { PlatformId } from "../shared/contracts";
import type { EstimateRange } from "../shared/range";

export type ConfidenceGrade = "A" | "B" | "C" | "D";
export type IndicatorKey = "energyWh" | "waterMl" | "carbonG";
export type IndicatorUnit = "Wh" | "ml" | "gCO2e";

interface BaseEstimator {
  unit: IndicatorUnit;
  lowMultiplier: number;
  highMultiplier: number;
  confidence: ConfidenceGrade;
  sourceId: string;
}

export interface TokenLinearEstimator extends BaseEstimator {
  estimator: "token-linear";
  base: number;
  inputPer1k: number;
  outputPer1k: number;
}

export interface PromptMedianEstimator extends BaseEstimator {
  estimator: "prompt-median";
  perPrompt: number;
}

export interface ModelProxyEstimator extends BaseEstimator {
  estimator: "model-proxy";
  profileId: string;
  indicator: IndicatorKey;
}

export type IndicatorEstimator = TokenLinearEstimator | PromptMedianEstimator | ModelProxyEstimator;

export interface ImpactSource {
  id: string;
  title: string;
  url: string;
  publicationDate: string;
  accessedDate: string;
  primary: true;
  scope: string;
  limitations: string[];
}

export interface ImpactProfile {
  id: string;
  version: number;
  displayName: string;
  platforms: PlatformId[];
  modelMatchers: string[];
  limitations: string[];
  indicators: Record<IndicatorKey, IndicatorEstimator>;
}

export interface ImpactRegistry {
  methodologyVersion: string;
  sources: ImpactSource[];
  profiles: ImpactProfile[];
  platformFallbacks: Record<PlatformId, string>;
}

export interface ImpactIndicator {
  range: EstimateRange;
  confidence: ConfidenceGrade;
  sourceProfileId: string;
  sourceId: string;
}

export interface ImpactEstimate {
  energyWh: ImpactIndicator;
  waterMl: ImpactIndicator;
  carbonG: ImpactIndicator;
  televisionSeconds: ImpactIndicator;
  carMeters: ImpactIndicator;
  profileId: string;
  methodologyVersion: string;
}
