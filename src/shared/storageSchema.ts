import type { NormalizedError } from "./errors";
import {
  DEFAULT_UI_LANGUAGE,
  isUiLanguagePreference,
  type UiLanguagePreference
} from "./i18n";
import {
  isSyncBranch,
  isCodingPlatform,
  isPlainRecord,
  isRetryBundle,
  isSyncDeduplicationKey,
  isSyncHistoryEntry,
  isSyncRepository,
  type SyncBranch,
  type CodingPlatform,
  type IsoDateString,
  type RetryBundle,
  type SyncDeduplicationKey,
  type SyncHistoryEntry,
  type SyncRepository
} from "./types";

export const STORAGE_SCHEMA_VERSION = 4;
const LEGACY_STORAGE_SCHEMA_VERSIONS = [1, 2, 3] as const;

export const STORAGE_KEYS = {
  settings: "settings",
  processedSyncDeduplicationKeys: "processedSyncDeduplicationKeys",
  syncHistory: "syncHistory",
  retryBundles: "retryBundles",
  syncDeduplicationKeyLocks: "syncDeduplicationKeyLocks"
} as const;

export const LEGACY_STORAGE_KEYS = {
  processedSubmissions: "processedSubmissions",
  retryPayloads: "retryPayloads",
  inFlightSyncs: "inFlightSyncs"
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export type ConnectionStatusCode =
  | "not_tested"
  | "testing"
  | "connected"
  | "no_accessible_repositories"
  | "repository_not_found"
  | "branch_not_found"
  | "branch_created"
  | "branch_create_failed"
  | "auth_failed"
  | "token_expired"
  | "rate_limited"
  | "network_failed";

export interface ConnectionStatus {
  code: ConnectionStatusCode;
  checkedAt: IsoDateString | null;
  error: NormalizedError | null;
}

export interface SettingsState {
  version: typeof STORAGE_SCHEMA_VERSION;
  githubPat: string | null;
  syncRepository: SyncRepository | null;
  syncBranch: SyncBranch | null;
  autoSyncEnabled: boolean;
  uiLanguage: UiLanguagePreference;
  connectionStatus: ConnectionStatus;
  updatedAt: IsoDateString | null;
}

export type PublicSettingsState = Omit<SettingsState, "githubPat"> & {
  hasGithubPat: boolean;
};

export type PublicSettingsUpdate = Partial<
  Pick<
    SettingsState,
    | "syncRepository"
    | "syncBranch"
    | "autoSyncEnabled"
    | "uiLanguage"
    | "connectionStatus"
  >
>;

export interface ProcessedSyncDeduplicationKeyEntry {
  syncDeduplicationKey: SyncDeduplicationKey;
  processedAt: IsoDateString;
  commitSha: string;
  solutionPath: string;
}

export interface ProcessedSyncDeduplicationKeysState {
  version: typeof STORAGE_SCHEMA_VERSION;
  entries: ProcessedSyncDeduplicationKeyEntry[];
}

export interface SyncHistoryState {
  version: typeof STORAGE_SCHEMA_VERSION;
  entries: SyncHistoryEntry[];
}

export interface RetryBundlesState {
  version: typeof STORAGE_SCHEMA_VERSION;
  bundles: RetryBundle[];
}

export interface SyncDeduplicationKeyLock {
  syncDeduplicationKey: SyncDeduplicationKey;
  lockedAt: IsoDateString;
  expiresAt: IsoDateString;
}

export interface SyncDeduplicationKeyLocksState {
  version: typeof STORAGE_SCHEMA_VERSION;
  locks: SyncDeduplicationKeyLock[];
}

export const DEFAULT_SETTINGS_STATE: SettingsState = {
  version: STORAGE_SCHEMA_VERSION,
  githubPat: null,
  syncRepository: null,
  syncBranch: null,
  autoSyncEnabled: false,
  uiLanguage: DEFAULT_UI_LANGUAGE,
  connectionStatus: {
    code: "not_tested",
    checkedAt: null,
    error: null
  },
  updatedAt: null
};

export const EMPTY_PROCESSED_SYNC_DEDUPLICATION_KEYS_STATE: ProcessedSyncDeduplicationKeysState = {
  version: STORAGE_SCHEMA_VERSION,
  entries: []
};

export const EMPTY_SYNC_HISTORY_STATE: SyncHistoryState = {
  version: STORAGE_SCHEMA_VERSION,
  entries: []
};

export const EMPTY_RETRY_BUNDLES_STATE: RetryBundlesState = {
  version: STORAGE_SCHEMA_VERSION,
  bundles: []
};

export const EMPTY_SYNC_DEDUPLICATION_KEY_LOCKS_STATE: SyncDeduplicationKeyLocksState = {
  version: STORAGE_SCHEMA_VERSION,
  locks: []
};

export function toPublicSettingsState(settings: SettingsState): PublicSettingsState {
  const { githubPat: _githubPat, ...publicSettings } = settings;

  return {
    ...publicSettings,
    hasGithubPat: settings.githubPat !== null && settings.githubPat.length > 0
  };
}

export function isVersionedStorageState(
  value: unknown
): value is Record<string, unknown> & { version: typeof STORAGE_SCHEMA_VERSION } {
  return (
    isPlainRecord(value) &&
    typeof value.version === "number" &&
    value.version === STORAGE_SCHEMA_VERSION
  );
}

export function isSettingsState(value: unknown): value is SettingsState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return (
    (typeof value.githubPat === "string" || value.githubPat === null) &&
    (isSyncRepository(value.syncRepository) || value.syncRepository === null) &&
    (isSyncBranch(value.syncBranch) || value.syncBranch === null) &&
    typeof value.autoSyncEnabled === "boolean" &&
    isUiLanguagePreference(value.uiLanguage) &&
    isConnectionStatus(value.connectionStatus) &&
    (typeof value.updatedAt === "string" || value.updatedAt === null)
  );
}

export function parseSettingsState(value: unknown): SettingsState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  const {
    selectedRepository: legacySelectedRepository,
    selectedBranch: legacySelectedBranch,
    ...rest
  } = value;
  const candidate = {
    ...rest,
    version: STORAGE_SCHEMA_VERSION,
    syncRepository: normalizeLegacyObjectField(
      value.syncRepository,
      legacySelectedRepository
    ),
    syncBranch: normalizeLegacyObjectField(value.syncBranch, legacySelectedBranch),
    uiLanguage: normalizeUiLanguagePreference(value.uiLanguage)
  };

  return isSettingsState(candidate) ? candidate : null;
}

export function isProcessedSyncDeduplicationKeyEntry(
  value: unknown
): value is ProcessedSyncDeduplicationKeyEntry {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isSyncDeduplicationKey(value.syncDeduplicationKey) &&
    typeof value.processedAt === "string" &&
    typeof value.commitSha === "string" &&
    typeof value.solutionPath === "string"
  );
}

export function isProcessedSyncDeduplicationKeysState(
  value: unknown
): value is ProcessedSyncDeduplicationKeysState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return (
    Array.isArray(value.entries) &&
    value.entries.every(isProcessedSyncDeduplicationKeyEntry)
  );
}

export function parseProcessedSyncDeduplicationKeysState(
  value: unknown
): ProcessedSyncDeduplicationKeysState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  if (!Array.isArray(value.entries)) {
    return null;
  }

  const entries = value.entries.map(normalizeProcessedSyncDeduplicationKeyEntry);

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    entries: entries as ProcessedSyncDeduplicationKeyEntry[]
  };
}

export function isSyncHistoryState(value: unknown): value is SyncHistoryState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.entries) && value.entries.every(isSyncHistoryEntry);
}

export function parseSyncHistoryState(value: unknown): SyncHistoryState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  const legacyRecords = value.records;
  const rawEntries = Array.isArray(value.entries)
    ? value.entries
    : Array.isArray(legacyRecords)
      ? legacyRecords
      : null;

  if (rawEntries === null) {
    return null;
  }

  const entries = rawEntries.map(normalizeSyncHistoryEntry);

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    entries: entries as SyncHistoryEntry[]
  };
}

export function isRetryBundlesState(value: unknown): value is RetryBundlesState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.bundles) && value.bundles.every(isRetryBundle);
}

export function parseRetryBundlesState(value: unknown): RetryBundlesState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  const legacyPayloads = value.payloads;
  const rawBundles = Array.isArray(value.bundles)
    ? value.bundles
    : Array.isArray(legacyPayloads)
      ? legacyPayloads
      : null;

  if (rawBundles === null) {
    return null;
  }

  const bundles = rawBundles.map(normalizeRetryBundle);

  if (bundles.some((bundle) => bundle === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    bundles: bundles as RetryBundle[]
  };
}

export function isSyncDeduplicationKeyLock(
  value: unknown
): value is SyncDeduplicationKeyLock {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isSyncDeduplicationKey(value.syncDeduplicationKey) &&
    typeof value.lockedAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

export function isSyncDeduplicationKeyLocksState(
  value: unknown
): value is SyncDeduplicationKeyLocksState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.locks) && value.locks.every(isSyncDeduplicationKeyLock);
}

export function parseSyncDeduplicationKeyLocksState(
  value: unknown
): SyncDeduplicationKeyLocksState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  if (!Array.isArray(value.locks)) {
    return null;
  }

  const locks = value.locks.map(normalizeSyncDeduplicationKeyLock);

  if (locks.some((lock) => lock === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    locks: locks as SyncDeduplicationKeyLock[]
  };
}

export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isConnectionStatusCode(value.code) &&
    (typeof value.checkedAt === "string" || value.checkedAt === null)
  );
}

export function isConnectionStatusCode(value: unknown): value is ConnectionStatusCode {
  return (
    value === "not_tested" ||
    value === "testing" ||
    value === "connected" ||
    value === "no_accessible_repositories" ||
    value === "repository_not_found" ||
    value === "branch_not_found" ||
    value === "branch_created" ||
    value === "branch_create_failed" ||
    value === "auth_failed" ||
    value === "token_expired" ||
    value === "rate_limited" ||
    value === "network_failed"
  );
}

function isSupportedStorageVersion(value: unknown): boolean {
  return (
    value === STORAGE_SCHEMA_VERSION ||
    (LEGACY_STORAGE_SCHEMA_VERSIONS as readonly number[]).includes(value as number)
  );
}

function normalizeUiLanguagePreference(value: unknown): UiLanguagePreference {
  return isUiLanguagePreference(value) ? value : DEFAULT_UI_LANGUAGE;
}

function normalizeProcessedSyncDeduplicationKeyEntry(
  value: unknown
): ProcessedSyncDeduplicationKeyEntry | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const { identity: legacyIdentity, ...rest } = value;
  const syncDeduplicationKey = normalizeSyncDeduplicationKey(
    value.syncDeduplicationKey ?? legacyIdentity
  );
  const candidate = {
    ...rest,
    syncDeduplicationKey
  };

  return isProcessedSyncDeduplicationKeyEntry(candidate) ? candidate : null;
}

function normalizeSyncHistoryEntry(value: unknown): SyncHistoryEntry | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const {
    platform: legacyPlatform,
    identity: legacyIdentity,
    repository: legacyRepository,
    branchName: legacyBranchName,
    retryPayloadId: legacyRetryPayloadId,
    ...rest
  } = value;
  const codingPlatform = normalizeCodingPlatform(
    value.codingPlatform ?? legacyPlatform
  );
  const syncDeduplicationKeyValue = value.syncDeduplicationKey ?? legacyIdentity;
  const syncDeduplicationKey =
    syncDeduplicationKeyValue === null
      ? null
      : normalizeSyncDeduplicationKey(syncDeduplicationKeyValue, codingPlatform);
  const candidate = {
    ...rest,
    codingPlatform,
    syncDeduplicationKey,
    syncRepository: normalizeLegacyObjectField(
      value.syncRepository,
      legacyRepository
    ),
    syncBranchName: normalizeLegacyObjectField(
      value.syncBranchName,
      legacyBranchName
    ),
    retryBundleId: normalizeLegacyObjectField(
      value.retryBundleId,
      legacyRetryPayloadId
    )
  };

  return isSyncHistoryEntry(candidate) ? candidate : null;
}

function normalizeRetryBundle(value: unknown): RetryBundle | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const {
    platform: legacyPlatform,
    identity: legacyIdentity,
    repository: legacyRepository,
    branch: legacyBranch,
    readmePath: legacyReadmePath,
    indexPath: legacyIndexPath,
    ...rest
  } = value;
  const codingPlatform = normalizeCodingPlatform(
    value.codingPlatform ?? legacyPlatform
  );
  const syncDeduplicationKey = normalizeSyncDeduplicationKey(
    value.syncDeduplicationKey ?? legacyIdentity,
    codingPlatform
  );
  const submission = normalizeAcceptedSubmission(value.submission);
  const candidate = {
    ...rest,
    codingPlatform,
    syncDeduplicationKey,
    syncRepository: normalizeLegacyObjectField(
      value.syncRepository,
      legacyRepository
    ),
    syncBranch: normalizeLegacyObjectField(value.syncBranch, legacyBranch),
    submission,
    solutionReadmePath: normalizeLegacyStringField(
      value.solutionReadmePath,
      legacyReadmePath
    ),
    solutionCatalogPath: normalizeLegacyStringField(
      value.solutionCatalogPath,
      legacyIndexPath
    )
  };

  return isRetryBundle(candidate) ? candidate : null;
}

function normalizeSyncDeduplicationKeyLock(
  value: unknown
): SyncDeduplicationKeyLock | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const { identity: legacyIdentity, ...rest } = value;
  const syncDeduplicationKey = normalizeSyncDeduplicationKey(
    value.syncDeduplicationKey ?? legacyIdentity
  );
  const candidate = {
    ...rest,
    syncDeduplicationKey
  };

  return isSyncDeduplicationKeyLock(candidate) ? candidate : null;
}

function normalizeSyncDeduplicationKey(
  value: unknown,
  defaultCodingPlatform: CodingPlatform = "leetcode"
): SyncDeduplicationKey | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const { platform: legacyPlatform, submissionId: legacySubmissionId, ...rest } = value;
  const candidate = {
    ...rest,
    codingPlatform: normalizeCodingPlatform(
      value.codingPlatform ?? legacyPlatform,
      defaultCodingPlatform
    ),
    acceptedSourceId: normalizeLegacyStringField(
      value.acceptedSourceId,
      legacySubmissionId
    )
  };

  return isSyncDeduplicationKey(candidate) ? candidate : null;
}

function normalizeAcceptedSubmission(value: unknown): unknown {
  if (!isPlainRecord(value)) {
    return value;
  }

  const { submissionId: legacySubmissionId, ...rest } = value;

  return {
    ...rest,
    acceptedSourceId: normalizeLegacyStringField(
      value.acceptedSourceId,
      legacySubmissionId
    )
  };
}

function normalizeCodingPlatform(
  value: unknown,
  defaultCodingPlatform: CodingPlatform = "leetcode"
): CodingPlatform {
  return isCodingPlatform(value) ? value : defaultCodingPlatform;
}

function normalizeLegacyStringField(
  currentValue: unknown,
  legacyValue: unknown
): unknown {
  return typeof currentValue === "string" ? currentValue : legacyValue;
}

function normalizeLegacyObjectField(
  currentValue: unknown,
  legacyValue: unknown
): unknown {
  return currentValue === undefined ? legacyValue : currentValue;
}
