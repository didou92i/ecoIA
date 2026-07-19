import type { PlatformId } from "../shared/contracts";
import type { EstimateRange } from "../shared/range";

export interface AggregateTokens {
  input: EstimateRange;
  output: EstimateRange;
}

export interface AggregateImpacts {
  energyWh: EstimateRange;
  waterMl: EstimateRange;
  carbonG: EstimateRange;
  televisionSeconds: EstimateRange;
  carMeters: EstimateRange;
}

export interface NumericAggregate {
  version: 1;
  interactionCount: number;
  platformCounts: Record<PlatformId, number>;
  tokens: AggregateTokens;
  impacts: AggregateImpacts;
}

export interface DayAggregate extends NumericAggregate {
  localDate: string;
}

export interface EventContribution {
  platform: PlatformId;
  tokens: AggregateTokens;
  impacts: AggregateImpacts;
}

export interface StoredEventSnapshot {
  eventId: string;
  sequence: number;
  updatedAt: number;
  localDate: string;
  contribution: EventContribution;
}

export interface StoredEventState {
  version: 1;
  events: StoredEventSnapshot[];
}

export interface DeduplicationEntry {
  eventId: string;
  tabSessionId: string;
  sequence: number;
  updatedAt: number;
}

export interface DeduplicationState {
  version: 1;
  entries: DeduplicationEntry[];
}

export interface RecoveryJournal {
  version: 1;
  tabSessionId: string;
  sessionAggregate: NumericAggregate;
  eventState: StoredEventState;
}
