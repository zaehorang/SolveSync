import type { NormalizedError } from "./errors";
import {
  isBranchRef,
  isPlainRecord,
  isRetryPayload,
  isRepositoryRef,
  isSubmissionIdentity,
  isSyncRecord,
  type BranchRef,
  type IsoDateString,
  type RepositoryRef,
  type RetryPayload,
  type SubmissionIdentity,
  type SyncRecord
} from "./types";

export const STORAGE_SCHEMA_VERSION = 1;

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
  selectedRepository: RepositoryRef | null;
  selectedBranch: BranchRef | null;
  autoSyncEnabled: boolean;
  connectionStatus: ConnectionStatus;
  updatedAt: IsoDateString | null;
}

export type PublicSettingsState = Omit<SettingsState, "githubPat"> & {
  hasGithubPat: boolean;
};

export type PublicSettingsUpdate = Partial<
  Pick<
    SettingsState,
    "selectedRepository" | "selectedBranch" | "autoSyncEnabled" | "connectionStatus"
  >
>;

export interface ProcessedSubmissionEntry {
  identity: SubmissionIdentity;
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
  records: SyncRecord[];
}

export interface RetryPayloadsState {
  version: typeof STORAGE_SCHEMA_VERSION;
  payloads: RetryPayload[];
}

export interface InFlightSyncLock {
  identity: SubmissionIdentity;
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

export const EMPTY_RETRY_PAYLOADS_STATE: RetryPayloadsState = {
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
    (isRepositoryRef(value.selectedRepository) || value.selectedRepository === null) &&
    (isBranchRef(value.selectedBranch) || value.selectedBranch === null) &&
    typeof value.autoSyncEnabled === "boolean" &&
    isConnectionStatus(value.connectionStatus) &&
    (typeof value.updatedAt === "string" || value.updatedAt === null)
  );
}

export function isProcessedSubmissionEntry(
  value: unknown
): value is ProcessedSubmissionEntry {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isSubmissionIdentity(value.identity) &&
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

export function isSyncHistoryState(value: unknown): value is SyncHistoryState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.records) && value.records.every(isSyncRecord);
}

export function isRetryPayloadsState(value: unknown): value is RetryPayloadsState {
  if (!isVersionedStorageState(value)) {
    return false;
  }

  return Array.isArray(value.payloads) && value.payloads.every(isRetryPayload);
}

export function isInFlightSyncLock(value: unknown): value is InFlightSyncLock {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isSubmissionIdentity(value.identity) &&
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
