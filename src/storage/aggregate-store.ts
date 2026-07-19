import type { ExtensionStorageArea } from "../browser/browser-api";
import { estimateImpact } from "../impact/impact-engine";
import type { NumericInteractionEvent, PlatformId } from "../shared/contracts";
import { createRange, type EstimateRange } from "../shared/range";
import type {
  DayAggregate,
  DeduplicationEntry,
  DeduplicationState,
  EventContribution,
  NumericAggregate,
  RecoveryJournal,
  StoredEventSnapshot,
  StoredEventState,
} from "./storage-types";
import { WriteQueue } from "./write-queue";

const dayStorageKey = "ecoia.day.v1";
const deduplicationStorageKey = "ecoia.dedupe.v1";
const recoveryJournalStorageKey = "ecoia.journal.v1";
const maximumRecentEvents = 256;
const deduplicationLifetimeMs = 30 * 60 * 1_000;
const aggregateQueueKey = "ecoia-aggregate-write";
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

interface AggregateStoreOptions {
  local: ExtensionStorageArea;
  session: ExtensionStorageArea | null;
  now?: () => number;
  localDate?: () => string;
}

export type ProcessEventResult =
  | { status: "accepted" }
  | { status: "ignored"; reason: "DUPLICATE_OR_OUT_OF_ORDER" };

class MemoryStorageArea implements ExtensionStorageArea {
  private readonly values: Record<string, unknown> = {};

  async get(keys: string | string[] | null = null): Promise<Record<string, unknown>> {
    if (keys === null) return structuredClone(this.values);
    const requested = typeof keys === "string" ? [keys] : keys;
    return Object.fromEntries(
      requested.filter((key) => key in this.values).map((key) => [key, this.values[key]]),
    );
  }

  async set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, structuredClone(values));
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of typeof keys === "string" ? [keys] : keys) delete this.values[key];
  }
}

function sessionAggregateKey(tabSessionId: string): string {
  return `ecoia.session.${tabSessionId}.v1`;
}

function sessionEventsKey(tabSessionId: string): string {
  return `ecoia.events.${tabSessionId}.v1`;
}

function zeroRange(): EstimateRange {
  return createRange(0, 0, 0);
}

function emptyAggregate(): NumericAggregate {
  return {
    version: 1,
    interactionCount: 0,
    platformCounts: { chatgpt: 0, claude: 0, gemini: 0, mistral: 0, perplexity: 0 },
    tokens: { input: zeroRange(), output: zeroRange() },
    impacts: {
      energyWh: zeroRange(),
      waterMl: zeroRange(),
      carbonG: zeroRange(),
      televisionSeconds: zeroRange(),
      carMeters: zeroRange(),
    },
  };
}

function emptyDay(localDate: string): DayAggregate {
  return { ...emptyAggregate(), localDate };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRange(value: unknown): value is EstimateRange {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, ["low", "central", "high"])) return false;
  const { low, central, high } = value;
  return (
    typeof low === "number" &&
    typeof central === "number" &&
    typeof high === "number" &&
    Number.isFinite(low) &&
    Number.isFinite(central) &&
    Number.isFinite(high) &&
    low >= 0 &&
    low <= central &&
    central <= high
  );
}

function isPlatformCounts(value: unknown): value is Record<PlatformId, number> {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, ["chatgpt", "claude", "gemini", "mistral", "perplexity"])) {
    return false;
  }
  return ["chatgpt", "claude", "gemini", "mistral", "perplexity"].every(
    (platform) => Number.isSafeInteger(value[platform]) && (value[platform] as number) >= 0,
  );
}

export function isNumericAggregate(value: unknown): value is NumericAggregate {
  if (
    !isRecord(value) ||
    (!hasExactKeys(value, ["version", "interactionCount", "platformCounts", "tokens", "impacts"]) &&
      !hasExactKeys(value, [
        "version",
        "interactionCount",
        "platformCounts",
        "tokens",
        "impacts",
        "localDate",
      ])) ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.interactionCount) ||
    (value.interactionCount as number) < 0 ||
    !isPlatformCounts(value.platformCounts) ||
    !isRecord(value.tokens) ||
    !hasExactKeys(value.tokens, ["input", "output"]) ||
    !isRange(value.tokens.input) ||
    !isRange(value.tokens.output) ||
    !isRecord(value.impacts) ||
    !hasExactKeys(value.impacts, [
      "energyWh",
      "waterMl",
      "carbonG",
      "televisionSeconds",
      "carMeters",
    ])
  ) {
    return false;
  }
  return (
    ["energyWh", "waterMl", "carbonG", "televisionSeconds", "carMeters"].every((key) =>
      isRange((value.impacts as Record<string, unknown>)[key]),
    ) &&
    (value.localDate === undefined || typeof value.localDate === "string")
  );
}

function isSessionAggregate(value: unknown): value is NumericAggregate {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["version", "interactionCount", "platformCounts", "tokens", "impacts"]) &&
    isNumericAggregate(value)
  );
}

function isDayAggregate(value: unknown): value is DayAggregate {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "version",
      "interactionCount",
      "platformCounts",
      "tokens",
      "impacts",
      "localDate",
    ])
  ) {
    return false;
  }
  const { localDate, ...aggregate } = value;
  return typeof localDate === "string" && isNumericAggregate(aggregate);
}

function isEventContribution(value: unknown): value is EventContribution {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["platform", "tokens", "impacts"]) ||
    !["chatgpt", "claude", "gemini", "mistral", "perplexity"].includes(value.platform as string) ||
    !isRecord(value.tokens) ||
    !hasExactKeys(value.tokens, ["input", "output"]) ||
    !isRange(value.tokens.input) ||
    !isRange(value.tokens.output) ||
    !isRecord(value.impacts) ||
    !hasExactKeys(value.impacts, [
      "energyWh",
      "waterMl",
      "carbonG",
      "televisionSeconds",
      "carMeters",
    ])
  ) {
    return false;
  }
  return ["energyWh", "waterMl", "carbonG", "televisionSeconds", "carMeters"].every((key) =>
    isRange((value.impacts as Record<string, unknown>)[key]),
  );
}

function isStoredEventState(value: unknown): value is StoredEventState {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "events"]) ||
    value.version !== 1 ||
    !Array.isArray(value.events) ||
    value.events.length > maximumRecentEvents
  ) {
    return false;
  }
  return value.events.every(
    (entry) =>
      isRecord(entry) &&
      hasExactKeys(entry, ["eventId", "sequence", "updatedAt", "localDate", "contribution"]) &&
      typeof entry.eventId === "string" &&
      identifierPattern.test(entry.eventId) &&
      Number.isSafeInteger(entry.sequence) &&
      (entry.sequence as number) >= 1 &&
      Number.isSafeInteger(entry.updatedAt) &&
      (entry.updatedAt as number) >= 0 &&
      typeof entry.localDate === "string" &&
      isEventContribution(entry.contribution),
  );
}

function isDeduplicationState(value: unknown): value is DeduplicationState {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "entries"]) ||
    value.version !== 1 ||
    !Array.isArray(value.entries) ||
    value.entries.length > maximumRecentEvents
  ) {
    return false;
  }
  return value.entries.every(
    (entry) =>
      isRecord(entry) &&
      hasExactKeys(entry, ["eventId", "tabSessionId", "sequence", "updatedAt"]) &&
      typeof entry.eventId === "string" &&
      identifierPattern.test(entry.eventId) &&
      typeof entry.tabSessionId === "string" &&
      identifierPattern.test(entry.tabSessionId) &&
      Number.isSafeInteger(entry.sequence) &&
      (entry.sequence as number) >= 1 &&
      Number.isSafeInteger(entry.updatedAt) &&
      (entry.updatedAt as number) >= 0,
  );
}

function isRecoveryJournal(value: unknown): value is RecoveryJournal {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["version", "tabSessionId", "sessionAggregate", "eventState"]) &&
    value.version === 1 &&
    typeof value.tabSessionId === "string" &&
    identifierPattern.test(value.tabSessionId) &&
    isSessionAggregate(value.sessionAggregate) &&
    isStoredEventState(value.eventState)
  );
}

function replaceRange(
  total: EstimateRange,
  previous: EstimateRange | null,
  next: EstimateRange,
): EstimateRange {
  const low = Math.max(0, total.low - (previous?.low ?? 0) + next.low);
  const central = Math.max(low, total.central - (previous?.central ?? 0) + next.central);
  const high = Math.max(central, total.high - (previous?.high ?? 0) + next.high);
  return createRange(low, central, high);
}

function applyContribution(
  aggregate: NumericAggregate,
  previous: EventContribution | null,
  next: EventContribution,
  isNewInteraction: boolean,
): NumericAggregate {
  const result = structuredClone(aggregate);
  if (isNewInteraction) {
    result.interactionCount += 1;
    result.platformCounts[next.platform] += 1;
  }
  result.tokens.input = replaceRange(
    result.tokens.input,
    previous?.tokens.input ?? null,
    next.tokens.input,
  );
  result.tokens.output = replaceRange(
    result.tokens.output,
    previous?.tokens.output ?? null,
    next.tokens.output,
  );
  for (const key of ["energyWh", "waterMl", "carbonG", "televisionSeconds", "carMeters"] as const) {
    result.impacts[key] = replaceRange(
      result.impacts[key],
      previous?.impacts[key] ?? null,
      next.impacts[key],
    );
  }
  return result;
}

function contributionFromEvent(event: NumericInteractionEvent): EventContribution {
  const impact = estimateImpact(event.modelProfileId, event.tokens);
  return {
    platform: event.platform,
    tokens: {
      input: structuredClone(event.tokens.input),
      output: structuredClone(event.tokens.output),
    },
    impacts: {
      energyWh: impact.energyWh.range,
      waterMl: impact.waterMl.range,
      carbonG: impact.carbonG.range,
      televisionSeconds: impact.televisionSeconds.range,
      carMeters: impact.carMeters.range,
    },
  };
}

async function readKey(area: ExtensionStorageArea, key: string): Promise<unknown> {
  const stored = await area.get(key);
  return stored[key];
}

export class AggregateStore {
  private readonly local: ExtensionStorageArea;
  private readonly session: ExtensionStorageArea;
  private readonly now: () => number;
  private readonly localDate: () => string;
  private readonly queue = new WriteQueue();

  constructor(options: AggregateStoreOptions) {
    this.local = options.local;
    this.session = options.session ?? new MemoryStorageArea();
    this.now = options.now ?? Date.now;
    this.localDate = options.localDate ?? (() => new Date().toLocaleDateString("en-CA"));
  }

  async getDayAggregate(): Promise<DayAggregate> {
    const currentDate = this.localDate();
    const stored = await readKey(this.local, dayStorageKey);
    return isDayAggregate(stored) && stored.localDate === currentDate
      ? stored
      : emptyDay(currentDate);
  }

  async getSessionAggregate(tabSessionId: string): Promise<NumericAggregate | null> {
    if (!identifierPattern.test(tabSessionId)) throw new Error("INVALID_SESSION_ID");
    const stored = await readKey(this.session, sessionAggregateKey(tabSessionId));
    return isSessionAggregate(stored) ? stored : null;
  }

  private async recoverPendingWrite(): Promise<void> {
    const storedJournal = await readKey(this.local, recoveryJournalStorageKey);
    if (storedJournal === undefined) return;
    if (!isRecoveryJournal(storedJournal)) {
      await this.local.remove(recoveryJournalStorageKey);
      return;
    }
    await this.session.set({
      [sessionAggregateKey(storedJournal.tabSessionId)]: storedJournal.sessionAggregate,
      [sessionEventsKey(storedJournal.tabSessionId)]: storedJournal.eventState,
    });
    await this.local.remove(recoveryJournalStorageKey);
  }

  processEvent(event: NumericInteractionEvent): Promise<ProcessEventResult> {
    return this.queue.enqueue(aggregateQueueKey, async () => {
      await this.recoverPendingWrite();
      const currentDate = this.localDate();
      const timestamp = this.now();
      const eventsKey = sessionEventsKey(event.tabSessionId);
      const [storedDay, storedSession, storedEvents, storedDeduplication] = await Promise.all([
        readKey(this.local, dayStorageKey),
        readKey(this.session, sessionAggregateKey(event.tabSessionId)),
        readKey(this.session, eventsKey),
        readKey(this.local, deduplicationStorageKey),
      ]);
      const day =
        isDayAggregate(storedDay) && storedDay.localDate === currentDate
          ? storedDay
          : emptyDay(currentDate);
      const session = isSessionAggregate(storedSession) ? storedSession : emptyAggregate();
      const eventState: StoredEventState = isStoredEventState(storedEvents)
        ? storedEvents
        : { version: 1, events: [] };
      const deduplication: DeduplicationState = isDeduplicationState(storedDeduplication)
        ? storedDeduplication
        : { version: 1, entries: [] };
      const recentDeduplication = deduplication.entries.filter(
        (entry) => timestamp - entry.updatedAt <= deduplicationLifetimeMs,
      );
      const previous = eventState.events.find((entry) => entry.eventId === event.eventId) ?? null;
      const duplicate = recentDeduplication.find(
        (entry) => entry.eventId === event.eventId && entry.tabSessionId === event.tabSessionId,
      );
      if (
        (previous && previous.sequence >= event.sequence) ||
        (duplicate && duplicate.sequence >= event.sequence)
      ) {
        return { status: "ignored", reason: "DUPLICATE_OR_OUT_OF_ORDER" };
      }

      const contribution = contributionFromEvent(event);
      const previousForDay = previous?.localDate === currentDate ? previous.contribution : null;
      const nextDay = applyContribution(day, previousForDay, contribution, previousForDay === null);
      const nextSession = applyContribution(
        session,
        previous?.contribution ?? null,
        contribution,
        previous === null,
      );
      const nextSnapshot: StoredEventSnapshot = {
        eventId: event.eventId,
        sequence: event.sequence,
        updatedAt: timestamp,
        localDate: currentDate,
        contribution,
      };
      const nextEvents = [
        ...eventState.events.filter((entry) => entry.eventId !== event.eventId),
        nextSnapshot,
      ]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, maximumRecentEvents);
      const nextDeduplicationEntry: DeduplicationEntry = {
        eventId: event.eventId,
        tabSessionId: event.tabSessionId,
        sequence: event.sequence,
        updatedAt: timestamp,
      };
      const nextDeduplication = [
        ...recentDeduplication.filter(
          (entry) =>
            !(entry.eventId === event.eventId && entry.tabSessionId === event.tabSessionId),
        ),
        nextDeduplicationEntry,
      ]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, maximumRecentEvents);

      const recoveryJournal: RecoveryJournal = {
        version: 1,
        tabSessionId: event.tabSessionId,
        sessionAggregate: nextSession,
        eventState: { version: 1, events: nextEvents },
      };
      await this.local.set({
        [dayStorageKey]: nextDay,
        [deduplicationStorageKey]: { version: 1, entries: nextDeduplication },
        [recoveryJournalStorageKey]: recoveryJournal,
      });
      await this.session.set({
        [sessionAggregateKey(event.tabSessionId)]: nextSession,
        [eventsKey]: { version: 1, events: nextEvents },
      });
      await this.local.remove(recoveryJournalStorageKey);
      return { status: "accepted" };
    });
  }

  resetSession(tabSessionId: string): Promise<void> {
    if (!identifierPattern.test(tabSessionId))
      return Promise.reject(new Error("INVALID_SESSION_ID"));
    return this.queue.enqueue(aggregateQueueKey, async () => {
      await this.recoverPendingWrite();
      await this.session.remove([
        sessionAggregateKey(tabSessionId),
        sessionEventsKey(tabSessionId),
      ]);
      const stored = await readKey(this.local, deduplicationStorageKey);
      if (isDeduplicationState(stored)) {
        await this.local.set({
          [deduplicationStorageKey]: {
            version: 1,
            entries: stored.entries.filter((entry) => entry.tabSessionId !== tabSessionId),
          },
        });
      }
    });
  }
}
