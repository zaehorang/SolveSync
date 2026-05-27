import {
  DEFAULT_SETTINGS_STATE,
  EMPTY_IN_FLIGHT_SYNCS_STATE,
  EMPTY_PROCESSED_SUBMISSIONS_STATE,
  EMPTY_RETRY_PAYLOADS_STATE,
  EMPTY_SYNC_HISTORY_STATE,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  isInFlightSyncsState,
  isProcessedSubmissionsState,
  isRetryPayloadsState,
  isSettingsState,
  isSyncHistoryState,
  type InFlightSyncsState,
  type ProcessedSubmissionEntry,
  type ProcessedSubmissionsState,
  type RetryPayloadsState,
  type SettingsState,
  type StorageKey,
  type SyncHistoryState
} from "../shared/storageSchema";
import type {
  IsoDateString,
  RetryPayload,
  SubmissionIdentity,
  SyncRecord
} from "../shared/types";

export const SYNC_HISTORY_LIMIT = 20;
export const RETRY_PAYLOAD_LIMIT = 20;
export const RETRY_PAYLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const IN_FLIGHT_LOCK_TTL_MS = 10 * 60 * 1000;

export interface StorageAreaAdapter {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface MarkProcessedDetails {
  commitSha: string;
  solutionPath: string;
  processedAt?: IsoDateString;
}

export type SettingsStorageUpdate = Partial<Omit<SettingsState, "version">>;

export interface ExtensionStorage {
  getSettings(): Promise<SettingsState>;
  saveSettings(
    settings: SettingsStorageUpdate,
    now?: Date | IsoDateString | number
  ): Promise<SettingsState>;
  listProcessedSubmissions(): Promise<ProcessedSubmissionEntry[]>;
  isProcessed(identity: SubmissionIdentity): Promise<boolean>;
  markProcessed(
    identity: SubmissionIdentity,
    details: MarkProcessedDetails,
    now?: Date | IsoDateString | number
  ): Promise<ProcessedSubmissionsState>;
  appendHistory(record: SyncRecord): Promise<SyncHistoryState>;
  listHistory(): Promise<SyncRecord[]>;
  saveRetryPayload(
    payload: RetryPayload,
    now?: Date | IsoDateString | number
  ): Promise<RetryPayloadsState>;
  listRetryPayloads(): Promise<RetryPayload[]>;
  getRetryPayload(id: string): Promise<RetryPayload | null>;
  removeRetryPayload(id: string): Promise<RetryPayloadsState>;
  pruneRetryPayloads(now: Date | IsoDateString | number): Promise<RetryPayloadsState>;
  acquireInFlightLock(
    identity: SubmissionIdentity,
    now: Date | IsoDateString | number
  ): Promise<boolean>;
  releaseInFlightLock(identity: SubmissionIdentity): Promise<InFlightSyncsState>;
  pruneInFlightLocks(now: Date | IsoDateString | number): Promise<InFlightSyncsState>;
}

export function createExtensionStorage(area: StorageAreaAdapter): ExtensionStorage {
  async function getSettings(): Promise<SettingsState> {
    return readState(
      area,
      STORAGE_KEYS.settings,
      DEFAULT_SETTINGS_STATE,
      isSettingsState
    );
  }

  async function saveSettings(
    settings: SettingsStorageUpdate,
    now: Date | IsoDateString | number = new Date()
  ): Promise<SettingsState> {
    const current = await getSettings();
    const next: SettingsState = {
      ...current,
      ...settings,
      version: STORAGE_SCHEMA_VERSION,
      updatedAt: settings.updatedAt === undefined ? toIsoDateString(now) : settings.updatedAt
    };

    return writeState(area, STORAGE_KEYS.settings, next);
  }

  async function readProcessedSubmissions(): Promise<ProcessedSubmissionsState> {
    return readState(
      area,
      STORAGE_KEYS.processedSubmissions,
      EMPTY_PROCESSED_SUBMISSIONS_STATE,
      isProcessedSubmissionsState
    );
  }

  async function listProcessedSubmissions(): Promise<ProcessedSubmissionEntry[]> {
    const state = await readProcessedSubmissions();
    return state.entries;
  }

  async function isProcessed(identity: SubmissionIdentity): Promise<boolean> {
    const state = await readProcessedSubmissions();
    return state.entries.some((entry) => isSameIdentity(entry.identity, identity));
  }

  async function markProcessed(
    identity: SubmissionIdentity,
    details: MarkProcessedDetails,
    now: Date | IsoDateString | number = new Date()
  ): Promise<ProcessedSubmissionsState> {
    const state = await readProcessedSubmissions();

    if (state.entries.some((entry) => isSameIdentity(entry.identity, identity))) {
      return state;
    }

    const next: ProcessedSubmissionsState = {
      version: STORAGE_SCHEMA_VERSION,
      entries: [
        ...state.entries,
        {
          identity,
          processedAt: details.processedAt ?? toIsoDateString(now),
          commitSha: details.commitSha,
          solutionPath: details.solutionPath
        }
      ]
    };

    return writeState(area, STORAGE_KEYS.processedSubmissions, next);
  }

  async function readHistory(): Promise<SyncHistoryState> {
    return readState(
      area,
      STORAGE_KEYS.syncHistory,
      EMPTY_SYNC_HISTORY_STATE,
      isSyncHistoryState
    );
  }

  async function appendHistory(record: SyncRecord): Promise<SyncHistoryState> {
    const state = await readHistory();
    const records = [record, ...state.records.filter((item) => item.id !== record.id)];
    const next: SyncHistoryState = {
      version: STORAGE_SCHEMA_VERSION,
      records: records.slice(0, SYNC_HISTORY_LIMIT)
    };

    return writeState(area, STORAGE_KEYS.syncHistory, next);
  }

  async function listHistory(): Promise<SyncRecord[]> {
    const state = await readHistory();
    return state.records;
  }

  async function readRetryPayloads(): Promise<RetryPayloadsState> {
    return readState(
      area,
      STORAGE_KEYS.retryPayloads,
      EMPTY_RETRY_PAYLOADS_STATE,
      isRetryPayloadsState
    );
  }

  async function saveRetryPayload(
    payload: RetryPayload,
    now: Date | IsoDateString | number = payload.createdAt
  ): Promise<RetryPayloadsState> {
    const state = await readRetryPayloads();
    const normalizedPayload = normalizeRetryPayloadTtl(payload);
    const payloads = [
      normalizedPayload,
      ...state.payloads.filter((item) => item.id !== normalizedPayload.id)
    ];
    const next: RetryPayloadsState = {
      version: STORAGE_SCHEMA_VERSION,
      payloads: capRetryPayloads(pruneRetryPayloadList(payloads, now))
    };

    return writeState(area, STORAGE_KEYS.retryPayloads, next);
  }

  async function listRetryPayloads(): Promise<RetryPayload[]> {
    const state = await readRetryPayloads();
    return state.payloads;
  }

  async function getRetryPayload(id: string): Promise<RetryPayload | null> {
    const state = await readRetryPayloads();
    return state.payloads.find((payload) => payload.id === id) ?? null;
  }

  async function removeRetryPayload(id: string): Promise<RetryPayloadsState> {
    const state = await readRetryPayloads();
    const next: RetryPayloadsState = {
      version: STORAGE_SCHEMA_VERSION,
      payloads: state.payloads.filter((payload) => payload.id !== id)
    };

    return writeState(area, STORAGE_KEYS.retryPayloads, next);
  }

  async function pruneRetryPayloads(
    now: Date | IsoDateString | number
  ): Promise<RetryPayloadsState> {
    const state = await readRetryPayloads();
    const next: RetryPayloadsState = {
      version: STORAGE_SCHEMA_VERSION,
      payloads: capRetryPayloads(pruneRetryPayloadList(state.payloads, now))
    };

    return writeState(area, STORAGE_KEYS.retryPayloads, next);
  }

  async function readInFlightSyncs(): Promise<InFlightSyncsState> {
    return readState(
      area,
      STORAGE_KEYS.inFlightSyncs,
      EMPTY_IN_FLIGHT_SYNCS_STATE,
      isInFlightSyncsState
    );
  }

  async function acquireInFlightLock(
    identity: SubmissionIdentity,
    now: Date | IsoDateString | number
  ): Promise<boolean> {
    const state = await readInFlightSyncs();
    const prunedLocks = pruneInFlightLockList(state.locks, now);

    if (prunedLocks.some((lock) => isSameIdentity(lock.identity, identity))) {
      if (prunedLocks.length !== state.locks.length) {
        await writeState(area, STORAGE_KEYS.inFlightSyncs, {
          version: STORAGE_SCHEMA_VERSION,
          locks: prunedLocks
        });
      }

      return false;
    }

    const lockedAt = toIsoDateString(now);
    const expiresAt = new Date(toTimestamp(now) + IN_FLIGHT_LOCK_TTL_MS).toISOString();
    const next: InFlightSyncsState = {
      version: STORAGE_SCHEMA_VERSION,
      locks: [
        ...prunedLocks,
        {
          identity,
          lockedAt,
          expiresAt
        }
      ]
    };

    await writeState(area, STORAGE_KEYS.inFlightSyncs, next);
    return true;
  }

  async function releaseInFlightLock(
    identity: SubmissionIdentity
  ): Promise<InFlightSyncsState> {
    const state = await readInFlightSyncs();
    const next: InFlightSyncsState = {
      version: STORAGE_SCHEMA_VERSION,
      locks: state.locks.filter((lock) => !isSameIdentity(lock.identity, identity))
    };

    return writeState(area, STORAGE_KEYS.inFlightSyncs, next);
  }

  async function pruneInFlightLocks(
    now: Date | IsoDateString | number
  ): Promise<InFlightSyncsState> {
    const state = await readInFlightSyncs();
    const next: InFlightSyncsState = {
      version: STORAGE_SCHEMA_VERSION,
      locks: pruneInFlightLockList(state.locks, now)
    };

    return writeState(area, STORAGE_KEYS.inFlightSyncs, next);
  }

  return {
    getSettings,
    saveSettings,
    listProcessedSubmissions,
    isProcessed,
    markProcessed,
    appendHistory,
    listHistory,
    saveRetryPayload,
    listRetryPayloads,
    getRetryPayload,
    removeRetryPayload,
    pruneRetryPayloads,
    acquireInFlightLock,
    releaseInFlightLock,
    pruneInFlightLocks
  };
}

export function createDefaultExtensionStorage(): ExtensionStorage {
  if (typeof chrome === "undefined" || chrome.storage?.local === undefined) {
    throw new Error("chrome.storage.local is unavailable.");
  }

  return createExtensionStorage(chrome.storage.local);
}

async function readState<T>(
  area: StorageAreaAdapter,
  key: StorageKey,
  fallback: T,
  guard: (value: unknown) => value is T
): Promise<T> {
  const values = await area.get([key]);
  const value = values[key];

  return guard(value) ? cloneState(value) : cloneState(fallback);
}

async function writeState<T>(
  area: StorageAreaAdapter,
  key: StorageKey,
  state: T
): Promise<T> {
  await area.set({ [key]: state });
  return cloneState(state);
}

function isSameIdentity(left: SubmissionIdentity, right: SubmissionIdentity): boolean {
  return (
    left.submissionId === right.submissionId &&
    left.titleSlug === right.titleSlug &&
    left.language === right.language
  );
}

function capRetryPayloads(payloads: RetryPayload[]): RetryPayload[] {
  return [...payloads]
    .sort((left, right) => compareIsoDescending(left.createdAt, right.createdAt))
    .slice(0, RETRY_PAYLOAD_LIMIT);
}

function normalizeRetryPayloadTtl(payload: RetryPayload): RetryPayload {
  const createdAt = parseTimestamp(payload.createdAt);
  const expiresAt = parseTimestamp(payload.expiresAt);

  if (createdAt === null) {
    return payload;
  }

  const latestAllowedExpiresAt = createdAt + RETRY_PAYLOAD_TTL_MS;
  const nextExpiresAt =
    expiresAt === null || expiresAt > latestAllowedExpiresAt
      ? new Date(latestAllowedExpiresAt).toISOString()
      : payload.expiresAt;

  return {
    ...payload,
    expiresAt: nextExpiresAt
  };
}

function pruneRetryPayloadList(
  payloads: RetryPayload[],
  now: Date | IsoDateString | number
): RetryPayload[] {
  const nowTimestamp = toTimestamp(now);

  return payloads.filter((payload) => {
    const createdAt = parseTimestamp(payload.createdAt);
    const expiresAt = parseTimestamp(payload.expiresAt);

    if (createdAt === null || expiresAt === null) {
      return false;
    }

    return nowTimestamp < expiresAt && nowTimestamp < createdAt + RETRY_PAYLOAD_TTL_MS;
  });
}

function pruneInFlightLockList(
  locks: InFlightSyncsState["locks"],
  now: Date | IsoDateString | number
): InFlightSyncsState["locks"] {
  const nowTimestamp = toTimestamp(now);

  return locks.filter((lock) => {
    const lockedAt = parseTimestamp(lock.lockedAt);
    const expiresAt = parseTimestamp(lock.expiresAt);

    if (lockedAt === null || expiresAt === null) {
      return false;
    }

    return nowTimestamp < expiresAt && nowTimestamp < lockedAt + IN_FLIGHT_LOCK_TTL_MS;
  });
}

function compareIsoDescending(left: IsoDateString, right: IsoDateString): number {
  const leftTimestamp = parseTimestamp(left) ?? 0;
  const rightTimestamp = parseTimestamp(right) ?? 0;

  return rightTimestamp - leftTimestamp;
}

function toIsoDateString(value: Date | IsoDateString | number): IsoDateString {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  return value;
}

function toTimestamp(value: Date | IsoDateString | number): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  return parseTimestamp(value) ?? Date.now();
}

function parseTimestamp(value: IsoDateString): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function cloneState<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
