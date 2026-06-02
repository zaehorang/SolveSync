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

export const STORAGE_SCHEMA_VERSION = 3;
const PREVIOUS_STORAGE_SCHEMA_VERSION = 2;
const LEGACY_STORAGE_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  settings: "settings",
  processedSubmissions: "processedSubmissions",
  syncHistory: "syncHistory",
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
  selectedRepository: SyncRepository | null;
  selectedBranch: SyncBranch | null;
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
    | "selectedRepository"
    | "selectedBranch"
    | "autoSyncEnabled"
    | "uiLanguage"
    | "connectionStatus"
  >
>;

export interface ProcessedSubmissionEntry {
  syncDeduplicationKey: SyncDeduplicationKey;
  processedAt: IsoDateString;
  commitSha: string;
  solutionPath: string;
}

export interface ProcessedSubmissionsState {
  version: typeof STORAGE_SCHEMA_VERSION;
  entries: ProcessedSubmissionEntry[];
}

export interface SyncHistoryState {
  version: typeof STORAGE_SCHEMA_VERSION;
  records: SyncHistoryEntry[];
}

export interface RetryBundlesState {
  version: typeof STORAGE_SCHEMA_VERSION;
  payloads: RetryBundle[];
}

export interface InFlightSyncLock {
  syncDeduplicationKey: SyncDeduplicationKey;
  lockedAt: IsoDateString;
  expiresAt: IsoDateString;
}

export interface InFlightSyncsState {
  version: typeof STORAGE_SCHEMA_VERSION;
  locks: InFlightSyncLock[];
}

export const DEFAULT_SETTINGS_STATE: SettingsState = {
  version: STORAGE_SCHEMA_VERSION,
  githubPat: null,
  selectedRepository: null,
  selectedBranch: null,
  autoSyncEnabled: false,
  uiLanguage: DEFAULT_UI_LANGUAGE,
  connectionStatus: {
    code: "not_tested",
    checkedAt: null,
    error: null
  },
  updatedAt: null
};

export const EMPTY_PROCESSED_SUBMISSIONS_STATE: ProcessedSubmissionsState = {
  version: STORAGE_SCHEMA_VERSION,
  entries: []
};

export const EMPTY_SYNC_HISTORY_STATE: SyncHistoryState = {
  version: STORAGE_SCHEMA_VERSION,
  records: []
};

export const EMPTY_RETRY_BUNDLES_STATE: RetryBundlesState = {
  version: STORAGE_SCHEMA_VERSION,
  payloads: []
};

export const EMPTY_IN_FLIGHT_SYNCS_STATE: InFlightSyncsState = {
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
    (isSyncRepository(value.selectedRepository) || value.selectedRepository === null) &&
    (isSyncBranch(value.selectedBranch) || value.selectedBranch === null) &&
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

  const candidate = {
    ...value,
    version: STORAGE_SCHEMA_VERSION,
    uiLanguage: normalizeUiLanguagePreference(value.uiLanguage)
  };

  return isSettingsState(candidate) ? candidate : null;
}

export function isProcessedSubmissionEntry(
  value: unknown
): value is ProcessedSubmissionEntry {
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

export function isProcessedSubmissionsState(
  value: unknown
): value is ProcessedSubmissionsState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.entries) && value.entries.every(isProcessedSubmissionEntry);
}

export function parseProcessedSubmissionsState(
  value: unknown
): ProcessedSubmissionsState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  if (!Array.isArray(value.entries)) {
    return null;
  }

  const entries = value.entries.map(normalizeProcessedSubmissionEntry);

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    entries: entries as ProcessedSubmissionEntry[]
  };
}

export function isSyncHistoryState(value: unknown): value is SyncHistoryState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.records) && value.records.every(isSyncHistoryEntry);
}

export function parseSyncHistoryState(value: unknown): SyncHistoryState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  if (!Array.isArray(value.records)) {
    return null;
  }

  const records = value.records.map(normalizeSyncHistoryEntry);

  if (records.some((record) => record === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    records: records as SyncHistoryEntry[]
  };
}

export function isRetryBundlesState(value: unknown): value is RetryBundlesState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.payloads) && value.payloads.every(isRetryBundle);
}

export function parseRetryBundlesState(value: unknown): RetryBundlesState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  if (!Array.isArray(value.payloads)) {
    return null;
  }

  const payloads = value.payloads.map(normalizeRetryBundle);

  if (payloads.some((payload) => payload === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    payloads: payloads as RetryBundle[]
  };
}

export function isInFlightSyncLock(value: unknown): value is InFlightSyncLock {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isSyncDeduplicationKey(value.syncDeduplicationKey) &&
    typeof value.lockedAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

export function isInFlightSyncsState(value: unknown): value is InFlightSyncsState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.locks) && value.locks.every(isInFlightSyncLock);
}

export function parseInFlightSyncsState(value: unknown): InFlightSyncsState | null {
  if (!isPlainRecord(value) || !isSupportedStorageVersion(value.version)) {
    return null;
  }

  if (!Array.isArray(value.locks)) {
    return null;
  }

  const locks = value.locks.map(normalizeInFlightSyncLock);

  if (locks.some((lock) => lock === null)) {
    return null;
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    locks: locks as InFlightSyncLock[]
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
    value === PREVIOUS_STORAGE_SCHEMA_VERSION ||
    value === LEGACY_STORAGE_SCHEMA_VERSION
  );
}

function normalizeUiLanguagePreference(value: unknown): UiLanguagePreference {
  return isUiLanguagePreference(value) ? value : DEFAULT_UI_LANGUAGE;
}

function normalizeProcessedSubmissionEntry(
  value: unknown
): ProcessedSubmissionEntry | null {
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

  return isProcessedSubmissionEntry(candidate) ? candidate : null;
}

function normalizeSyncHistoryEntry(value: unknown): SyncHistoryEntry | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const { platform: legacyPlatform, identity: legacyIdentity, ...rest } = value;
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
    syncDeduplicationKey
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

function normalizeInFlightSyncLock(value: unknown): InFlightSyncLock | null {
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

  return isInFlightSyncLock(candidate) ? candidate : null;
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
