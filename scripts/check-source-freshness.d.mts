export interface DatedSource {
  id: string;
  accessedDate: string;
}

export declare function findStaleSources(
  sources: readonly DatedSource[],
  reviewedAt: Date,
  maximumAgeDays?: number,
): string[];
