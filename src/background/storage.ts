import {
  DEFAULT_SETTINGS_STATE,
  EMPTY_PROCESSED_SYNC_DEDUPLICATION_KEYS_STATE,
  EMPTY_RETRY_BUNDLES_STATE,
  EMPTY_SYNC_DEDUPLICATION_KEY_LOCKS_STATE,
  EMPTY_SYNC_HISTORY_STATE,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  parseProcessedSyncDeduplicationKeysState,
  parseGitHubAuthSession,
  parseRetryBundlesState,
  parseSettingsState,
  parseSyncDeduplicationKeyLocksState,
  parseSyncHistoryState,
  type ProcessedSyncDeduplicationKeyEntry,
  type ProcessedSyncDeduplicationKeysState,
  type RetryBundlesState,
  type SettingsState,
  type GitHubAuthSession,
  type StorageKey,
  type SyncDeduplicationKeyLocksState,
  type SyncHistoryState
} from "../shared/storageSchema";
import type {
  IsoDateString,
  RetryBundle,
  SyncDeduplicationKey,
  SyncHistoryEntry
} from "../shared/types";

export const SYNC_HISTORY_LIMIT = 20;
export const RETRY_BUNDLE_LIMIT = 20;
export const RETRY_BUNDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SYNC_DEDUPLICATION_KEY_LOCK_TTL_MS = 10 * 60 * 1000;

export interface StorageAreaAdapter {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface MarkSyncDeduplicationKeyProcessedDetails {
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
  getGitHubAuth(): Promise<GitHubAuthSession | null>;
  saveGitHubAuth(session: GitHubAuthSession): Promise<GitHubAuthSession>;
  clearGitHubAuth(): Promise<void>;
  listProcessedSyncDeduplicationKeys(): Promise<ProcessedSyncDeduplicationKeyEntry[]>;
  hasProcessedSyncDeduplicationKey(
    syncDeduplicationKey: SyncDeduplicationKey
  ): Promise<boolean>;
  markSyncDeduplicationKeyProcessed(
    syncDeduplicationKey: SyncDeduplicationKey,
    details: MarkSyncDeduplicationKeyProcessedDetails,
    now?: Date | IsoDateString | number
  ): Promise<ProcessedSyncDeduplicationKeysState>;
  appendSyncHistoryEntry(entry: SyncHistoryEntry): Promise<SyncHistoryState>;
  listSyncHistoryEntries(): Promise<SyncHistoryEntry[]>;
  saveRetryBundle(
    bundle: RetryBundle,
    now?: Date | IsoDateString | number
  ): Promise<RetryBundlesState>;
  listRetryBundles(): Promise<RetryBundle[]>;
  getRetryBundle(id: string): Promise<RetryBundle | null>;
  removeRetryBundle(id: string): Promise<RetryBundlesState>;
  pruneRetryBundles(now: Date | IsoDateString | number): Promise<RetryBundlesState>;
  acquireSyncDeduplicationKeyLock(
    syncDeduplicationKey: SyncDeduplicationKey,
    now: Date | IsoDateString | number
  ): Promise<boolean>;
  releaseSyncDeduplicationKeyLock(
    syncDeduplicationKey: SyncDeduplicationKey
  ): Promise<SyncDeduplicationKeyLocksState>;
  pruneSyncDeduplicationKeyLocks(
    now: Date | IsoDateString | number
  ): Promise<SyncDeduplicationKeyLocksState>;
}

/** 같은 storage key의 read-modify-write를 순서대로 실행한다.
 *
 * `chrome.storage`에는 compare-and-swap이 없다. 두 flow가 같은 key를 동시에
 * 읽고 쓰면 나중 write가 앞선 변경을 통째로 덮는다. Sync History 기록이
 * 사라지는 정도가 아니라, Sync Deduplication Key lock을 둘 다 획득해 같은
 * 제출이 두 번 commit될 수 있다.
 *
 * 실패한 작업이 뒤 작업을 막지 않도록 queue tail은 항상 resolve된 promise로
 * 잇는다. */
function createStorageKeyQueue(): <T>(
  key: StorageKey,
  task: () => Promise<T>
) => Promise<T> {
  const tails = new Map<StorageKey, Promise<void>>();

  return <T>(key: StorageKey, task: () => Promise<T>): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve();
    const result = previous.then(task);

    tails.set(
      key,
      result.then(
        () => undefined,
        () => undefined
      )
    );

    return result;
  };
}

export function createExtensionStorage(area: StorageAreaAdapter): ExtensionStorage {
  // read-modify-write mutator는 전부 이 queue를 거친다. 새 mutator를 추가하면
  // 아래 반환 객체의 배선에도 함께 넣는다.
  const runExclusive = createStorageKeyQueue();

  async function getSettings(): Promise<SettingsState> {
    const values = await area.get(STORAGE_KEYS.settings);
    const raw = values[STORAGE_KEYS.settings];
    const parsed = parseSettingsState(raw) ?? cloneState(DEFAULT_SETTINGS_STATE);
    const isCurrent =
      typeof raw === "object" &&
      raw !== null &&
      "version" in raw &&
      raw.version === STORAGE_SCHEMA_VERSION &&
      !("githubPat" in raw);

    if (!isCurrent && raw !== undefined) {
      await area.set({ [STORAGE_KEYS.settings]: parsed });
    }

    return cloneState(parsed);
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

  async function getGitHubAuth(): Promise<GitHubAuthSession | null> {
    const values = await area.get(STORAGE_KEYS.githubAuth);
    const parsed = parseGitHubAuthSession(values[STORAGE_KEYS.githubAuth]);

    return parsed === null ? null : cloneState(parsed);
  }

  async function saveGitHubAuth(
    session: GitHubAuthSession
  ): Promise<GitHubAuthSession> {
    return writeState(area, STORAGE_KEYS.githubAuth, {
      ...session,
      version: STORAGE_SCHEMA_VERSION
    });
  }

  async function clearGitHubAuth(): Promise<void> {
    await area.remove(STORAGE_KEYS.githubAuth);
  }

  async function readProcessedSyncDeduplicationKeys(): Promise<ProcessedSyncDeduplicationKeysState> {
    return readState(
      area,
      STORAGE_KEYS.processedSyncDeduplicationKeys,
      EMPTY_PROCESSED_SYNC_DEDUPLICATION_KEYS_STATE,
      parseProcessedSyncDeduplicationKeysState,
      [LEGACY_STORAGE_KEYS.processedSubmissions]
    );
  }

  async function listProcessedSyncDeduplicationKeys(): Promise<ProcessedSyncDeduplicationKeyEntry[]> {
    const state = await readProcessedSyncDeduplicationKeys();
    return state.entries;
  }

  async function hasProcessedSyncDeduplicationKey(
    syncDeduplicationKey: SyncDeduplicationKey
  ): Promise<boolean> {
    const state = await readProcessedSyncDeduplicationKeys();
    return state.entries.some((entry) =>
      isSameSyncDeduplicationKey(entry.syncDeduplicationKey, syncDeduplicationKey)
    );
  }

  async function markSyncDeduplicationKeyProcessed(
    syncDeduplicationKey: SyncDeduplicationKey,
    details: MarkSyncDeduplicationKeyProcessedDetails,
    now: Date | IsoDateString | number = new Date()
  ): Promise<ProcessedSyncDeduplicationKeysState> {
    const state = await readProcessedSyncDeduplicationKeys();

    if (
      state.entries.some((entry) =>
        isSameSyncDeduplicationKey(entry.syncDeduplicationKey, syncDeduplicationKey)
      )
    ) {
      return state;
    }

    const next: ProcessedSyncDeduplicationKeysState = {
      version: STORAGE_SCHEMA_VERSION,
      entries: [
        ...state.entries,
        {
          syncDeduplicationKey,
          processedAt: details.processedAt ?? toIsoDateString(now),
          commitSha: details.commitSha,
          solutionPath: details.solutionPath
        }
      ]
    };

    return writeState(area, STORAGE_KEYS.processedSyncDeduplicationKeys, next);
  }

  async function readSyncHistory(): Promise<SyncHistoryState> {
    return readState(
      area,
      STORAGE_KEYS.syncHistory,
      EMPTY_SYNC_HISTORY_STATE,
      parseSyncHistoryState
    );
  }

  async function appendSyncHistoryEntry(
    entry: SyncHistoryEntry
  ): Promise<SyncHistoryState> {
    const state = await readSyncHistory();
    const entries = [entry, ...state.entries.filter((item) => item.id !== entry.id)];
    const next: SyncHistoryState = {
      version: STORAGE_SCHEMA_VERSION,
      entries: entries.slice(0, SYNC_HISTORY_LIMIT)
    };

    return writeState(area, STORAGE_KEYS.syncHistory, next);
  }

  async function listSyncHistoryEntries(): Promise<SyncHistoryEntry[]> {
    const state = await readSyncHistory();
    return state.entries;
  }

  async function readRetryBundles(): Promise<RetryBundlesState> {
    return readState(
      area,
      STORAGE_KEYS.retryBundles,
      EMPTY_RETRY_BUNDLES_STATE,
      parseRetryBundlesState,
      [LEGACY_STORAGE_KEYS.retryPayloads]
    );
  }

  async function saveRetryBundle(
    bundle: RetryBundle,
    now: Date | IsoDateString | number = bundle.createdAt
  ): Promise<RetryBundlesState> {
    const state = await readRetryBundles();
    const normalizedBundle = normalizeRetryBundleTtl(bundle);
    const bundles = [
      normalizedBundle,
      ...state.bundles.filter((item) => item.id !== normalizedBundle.id)
    ];
    const next: RetryBundlesState = {
      version: STORAGE_SCHEMA_VERSION,
      bundles: capRetryBundles(pruneRetryBundleList(bundles, now))
    };

    return writeState(area, STORAGE_KEYS.retryBundles, next);
  }

  async function listRetryBundles(): Promise<RetryBundle[]> {
    const state = await readRetryBundles();
    return state.bundles;
  }

  async function getRetryBundle(id: string): Promise<RetryBundle | null> {
    const state = await readRetryBundles();
    return state.bundles.find((bundle) => bundle.id === id) ?? null;
  }

  async function removeRetryBundle(id: string): Promise<RetryBundlesState> {
    const state = await readRetryBundles();
    const next: RetryBundlesState = {
      version: STORAGE_SCHEMA_VERSION,
      bundles: state.bundles.filter((bundle) => bundle.id !== id)
    };

    return writeState(area, STORAGE_KEYS.retryBundles, next);
  }

  async function pruneRetryBundles(
    now: Date | IsoDateString | number
  ): Promise<RetryBundlesState> {
    const state = await readRetryBundles();
    const next: RetryBundlesState = {
      version: STORAGE_SCHEMA_VERSION,
      bundles: capRetryBundles(pruneRetryBundleList(state.bundles, now))
    };

    return writeState(area, STORAGE_KEYS.retryBundles, next);
  }

  async function readSyncDeduplicationKeyLocks(): Promise<SyncDeduplicationKeyLocksState> {
    return readState(
      area,
      STORAGE_KEYS.syncDeduplicationKeyLocks,
      EMPTY_SYNC_DEDUPLICATION_KEY_LOCKS_STATE,
      parseSyncDeduplicationKeyLocksState,
      [LEGACY_STORAGE_KEYS.inFlightSyncs]
    );
  }

  async function acquireSyncDeduplicationKeyLock(
    syncDeduplicationKey: SyncDeduplicationKey,
    now: Date | IsoDateString | number
  ): Promise<boolean> {
    const state = await readSyncDeduplicationKeyLocks();
    const prunedLocks = pruneSyncDeduplicationKeyLockList(state.locks, now);

    if (
      prunedLocks.some((lock) =>
        isSameSyncDeduplicationKey(lock.syncDeduplicationKey, syncDeduplicationKey)
      )
    ) {
      if (prunedLocks.length !== state.locks.length) {
        await writeState(area, STORAGE_KEYS.syncDeduplicationKeyLocks, {
          version: STORAGE_SCHEMA_VERSION,
          locks: prunedLocks
        });
      }

      return false;
    }

    const lockedAt = toIsoDateString(now);
    const expiresAt = new Date(
      toTimestamp(now) + SYNC_DEDUPLICATION_KEY_LOCK_TTL_MS
    ).toISOString();
    const next: SyncDeduplicationKeyLocksState = {
      version: STORAGE_SCHEMA_VERSION,
      locks: [
        ...prunedLocks,
        {
          syncDeduplicationKey,
          lockedAt,
          expiresAt
        }
      ]
    };

    await writeState(area, STORAGE_KEYS.syncDeduplicationKeyLocks, next);
    return true;
  }

  async function releaseSyncDeduplicationKeyLock(
    syncDeduplicationKey: SyncDeduplicationKey
  ): Promise<SyncDeduplicationKeyLocksState> {
    const state = await readSyncDeduplicationKeyLocks();
    const next: SyncDeduplicationKeyLocksState = {
      version: STORAGE_SCHEMA_VERSION,
      locks: state.locks.filter(
        (lock) =>
          !isSameSyncDeduplicationKey(lock.syncDeduplicationKey, syncDeduplicationKey)
      )
    };

    return writeState(area, STORAGE_KEYS.syncDeduplicationKeyLocks, next);
  }

  async function pruneSyncDeduplicationKeyLocks(
    now: Date | IsoDateString | number
  ): Promise<SyncDeduplicationKeyLocksState> {
    const state = await readSyncDeduplicationKeyLocks();
    const next: SyncDeduplicationKeyLocksState = {
      version: STORAGE_SCHEMA_VERSION,
      locks: pruneSyncDeduplicationKeyLockList(state.locks, now)
    };

    return writeState(area, STORAGE_KEYS.syncDeduplicationKeyLocks, next);
  }

  // 읽기 전용 함수는 그대로 두고, 같은 key를 읽고 다시 쓰는 함수만 직렬화한다.
  // `getSettings`는 legacy migration write를 하지만 `saveSettings`가 내부에서
  // 호출하므로 queue에 넣지 않는다. 넣으면 서로를 기다려 교착한다.
  return {
    getSettings,
    saveSettings: (settings, now) =>
      runExclusive(STORAGE_KEYS.settings, () => saveSettings(settings, now)),
    getGitHubAuth,
    // auth write는 read-modify-write가 아니지만 같은 key를 두고 경쟁한다.
    // queue에 넣어 호출 순서가 최종 상태를 정하게 한다.
    saveGitHubAuth: (session) =>
      runExclusive(STORAGE_KEYS.githubAuth, () => saveGitHubAuth(session)),
    clearGitHubAuth: () =>
      runExclusive(STORAGE_KEYS.githubAuth, () => clearGitHubAuth()),
    listProcessedSyncDeduplicationKeys,
    hasProcessedSyncDeduplicationKey,
    markSyncDeduplicationKeyProcessed: (syncDeduplicationKey, details, now) =>
      runExclusive(STORAGE_KEYS.processedSyncDeduplicationKeys, () =>
        markSyncDeduplicationKeyProcessed(syncDeduplicationKey, details, now)
      ),
    appendSyncHistoryEntry: (entry) =>
      runExclusive(STORAGE_KEYS.syncHistory, () => appendSyncHistoryEntry(entry)),
    listSyncHistoryEntries,
    saveRetryBundle: (bundle, now) =>
      runExclusive(STORAGE_KEYS.retryBundles, () => saveRetryBundle(bundle, now)),
    listRetryBundles,
    getRetryBundle,
    removeRetryBundle: (id) =>
      runExclusive(STORAGE_KEYS.retryBundles, () => removeRetryBundle(id)),
    pruneRetryBundles: (now) =>
      runExclusive(STORAGE_KEYS.retryBundles, () => pruneRetryBundles(now)),
    acquireSyncDeduplicationKeyLock: (syncDeduplicationKey, now) =>
      runExclusive(STORAGE_KEYS.syncDeduplicationKeyLocks, () =>
        acquireSyncDeduplicationKeyLock(syncDeduplicationKey, now)
      ),
    releaseSyncDeduplicationKeyLock: (syncDeduplicationKey) =>
      runExclusive(STORAGE_KEYS.syncDeduplicationKeyLocks, () =>
        releaseSyncDeduplicationKeyLock(syncDeduplicationKey)
      ),
    pruneSyncDeduplicationKeyLocks: (now) =>
      runExclusive(STORAGE_KEYS.syncDeduplicationKeyLocks, () =>
        pruneSyncDeduplicationKeyLocks(now)
      )
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
  parse: (value: unknown) => T | null,
  legacyKeys: string[] = []
): Promise<T> {
  const keys = [key, ...legacyKeys];
  const values = await area.get(keys);

  for (const candidateKey of keys) {
    const parsed = parse(values[candidateKey]);

    if (parsed !== null) {
      return cloneState(parsed);
    }
  }

  return cloneState(fallback);
}

async function writeState<T>(
  area: StorageAreaAdapter,
  key: StorageKey,
  state: T
): Promise<T> {
  await area.set({ [key]: state });
  return cloneState(state);
}

function isSameSyncDeduplicationKey(
  left: SyncDeduplicationKey,
  right: SyncDeduplicationKey
): boolean {
  return (
    left.acceptedSourceId === right.acceptedSourceId &&
    left.codingPlatform === right.codingPlatform &&
    left.titleSlug === right.titleSlug &&
    left.language === right.language
  );
}

function capRetryBundles(bundles: RetryBundle[]): RetryBundle[] {
  return [...bundles]
    .sort((left, right) => compareIsoDescending(left.createdAt, right.createdAt))
    .slice(0, RETRY_BUNDLE_LIMIT);
}

function normalizeRetryBundleTtl(bundle: RetryBundle): RetryBundle {
  const createdAt = parseTimestamp(bundle.createdAt);
  const expiresAt = parseTimestamp(bundle.expiresAt);

  if (createdAt === null) {
    return bundle;
  }

  const latestAllowedExpiresAt = createdAt + RETRY_BUNDLE_TTL_MS;
  const nextExpiresAt =
    expiresAt === null || expiresAt > latestAllowedExpiresAt
      ? new Date(latestAllowedExpiresAt).toISOString()
      : bundle.expiresAt;

  return {
    ...bundle,
    expiresAt: nextExpiresAt
  };
}

function pruneRetryBundleList(
  bundles: RetryBundle[],
  now: Date | IsoDateString | number
): RetryBundle[] {
  const nowTimestamp = toTimestamp(now);

  return bundles.filter((bundle) => {
    const createdAt = parseTimestamp(bundle.createdAt);
    const expiresAt = parseTimestamp(bundle.expiresAt);

    if (createdAt === null || expiresAt === null) {
      return false;
    }

    return nowTimestamp < expiresAt && nowTimestamp < createdAt + RETRY_BUNDLE_TTL_MS;
  });
}

function pruneSyncDeduplicationKeyLockList(
  locks: SyncDeduplicationKeyLocksState["locks"],
  now: Date | IsoDateString | number
): SyncDeduplicationKeyLocksState["locks"] {
  const nowTimestamp = toTimestamp(now);

  return locks.filter((lock) => {
    const lockedAt = parseTimestamp(lock.lockedAt);
    const expiresAt = parseTimestamp(lock.expiresAt);

    if (lockedAt === null || expiresAt === null) {
      return false;
    }

    return (
      nowTimestamp < expiresAt &&
      nowTimestamp < lockedAt + SYNC_DEDUPLICATION_KEY_LOCK_TTL_MS
    );
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
