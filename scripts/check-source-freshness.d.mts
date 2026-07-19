export interface DatedSource {
  id: string;
  accessedDate: string;
}

export interface SourceInventory {
  sources: readonly DatedSource[];
  domains: {
    modelCatalog: {
      sourceIds: readonly string[];
      maximumAgeDays: number;
    };
  };
}

export interface ModelCatalogFreshnessChoice {
  id: string;
  reviewBy?: string;
}

export interface ModelCatalogFreshnessInput {
  reviewedOn: string;
  maximumAgeDays: number;
  platforms: {
    chatgpt: readonly ModelCatalogFreshnessChoice[];
  };
}

export declare function findStaleSources(
  sources: readonly DatedSource[],
  reviewedAt: Date,
  maximumAgeDays?: number,
): string[];

export declare function findStaleInventorySources(
  inventory: SourceInventory,
  reviewedAt: Date,
): string[];

export declare function findStaleModelCatalogEntries(
  catalog: ModelCatalogFreshnessInput,
  reviewedAt: Date,
): string[];
