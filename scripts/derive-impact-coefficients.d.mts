export interface DerivedCoefficients {
  base: number;
  inputPer1k: number;
  outputPer1k: number;
}

export interface DerivedProfile {
  energy: DerivedCoefficients;
  water: DerivedCoefficients;
  carbon: DerivedCoefficients;
  factors: { waterMlPerWh: number; carbonGPerWh: number };
  fit: {
    method: "unconstrained-exact" | "active-set-nnls";
    predictions: number[];
    residuals: number[];
    rmseWh: number;
    maximumRelativeError: number;
  };
}

export declare function deriveImpactCoefficients(fixture: unknown): {
  profiles: Record<string, DerivedProfile>;
};

export declare function readSourceFixture(): Promise<unknown>;

export declare function validateSourceFixture(fixture: unknown): Record<string, unknown>;

export declare function findRegistryDrift(
  registry: unknown,
  derived: { profiles: Record<string, DerivedProfile> },
  derivationId: string,
): string[];
