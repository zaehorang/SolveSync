import type { NormalizedError } from "./errors";
import type {
  RetryBundleSummary,
  SyncHistoryEntry,
  SyncStatus
} from "./types";
import type { SyncRepository } from "./types";
import { isPlainRecord } from "./types";
import type { PublicSettingsUpdate, SyncHistoryState } from "./storageSchema";

export type ExtensionSurface = "background" | "content" | "options" | "popup";

const SYNC_MESSAGE_PREFIX = "sync-";
const LEGACY_HISTORY_READ_TYPE = "history:read";
const LEGACY_HISTORY_UPDATED_TYPE = "history:updated";
const LEGACY_RETRY_PAYLOADS_READ_TYPE = "retry-payloads:read";

type SyncHistoryReadType =
  `${typeof SYNC_MESSAGE_PREFIX}${typeof LEGACY_HISTORY_READ_TYPE}`;
type SyncHistoryUpdatedType =
  `${typeof SYNC_MESSAGE_PREFIX}${typeof LEGACY_HISTORY_UPDATED_TYPE}`;

export const SYNC_HISTORY_READ_TYPE =
  `${SYNC_MESSAGE_PREFIX}${LEGACY_HISTORY_READ_TYPE}` as SyncHistoryReadType;
export const SYNC_HISTORY_UPDATED_TYPE =
  `${SYNC_MESSAGE_PREFIX}${LEGACY_HISTORY_UPDATED_TYPE}` as SyncHistoryUpdatedType;
export const RETRY_BUNDLES_READ_TYPE = "retry-bundles:read";

export interface ScaffoldReadyMessage {
  type: "scaffold:ready";
  surface: ExtensionSurface;
}

export interface LeetCodeAcceptedDetectedPayload {
  codingPlatform: "leetcode";
  titleSlug: string;
  pageUrl: string;
  detectedAt: string;
}

export interface ProgrammersAcceptedDetectedPayload {
  codingPlatform: "programmers";
  courseId: string;
  lessonId: string;
  problemTitle: string;
  language: string;
  code: string;
  pageUrl: string;
  detectedAt: string;
}

export type AcceptedDetectedPayload =
  | LeetCodeAcceptedDetectedPayload
  | ProgrammersAcceptedDetectedPayload;

export interface AcceptedDetectedMessage {
  type: "content:accepted_detected";
  payload: AcceptedDetectedPayload;
}

export type ToastAction =
  | "open_options"
  | "open_popup"
  | "open_commit"
  | "open_file"
  | "retry"
  | "dismiss";

export interface ToastActionMessage {
  type: "content:toast_action";
  payload: {
    action: ToastAction;
    recordId: string | null;
  };
}

export type ContentToBackgroundMessage = AcceptedDetectedMessage | ToastActionMessage;

export interface SettingsReadMessage {
  type: "settings:read";
}

export interface SettingsWriteMessage {
  type: "settings:write";
  payload: {
    update: PublicSettingsUpdate;
  };
}

export interface RepositoryListMessage {
  type: "github:repositories:list";
  payload: {
    query: string | null;
    page: number;
    perPage: number;
  };
}

export interface BranchListMessage {
  type: "github:branches:list";
  payload: {
    repository: SyncRepository;
  };
}

export interface BranchCreateMessage {
  type: "github:branch:create";
  payload: {
    repository: SyncRepository;
    branchName: string;
  };
}

export interface ConnectionTestMessage {
  type: "github:connection:test";
  payload: {
    repository: SyncRepository;
    branchName: string;
  };
}

export interface RetrySyncMessage {
  type: "sync:retry";
  payload: {
    retryBundleId: string;
  };
}

export interface SyncHistoryReadMessage {
  type: typeof SYNC_HISTORY_READ_TYPE;
  payload: {
    limit: number;
  };
}

export interface RetryBundlesReadMessage {
  type: typeof RETRY_BUNDLES_READ_TYPE;
}

export type PopupOptionsToBackgroundMessage =
  | SettingsReadMessage
  | SettingsWriteMessage
  | RepositoryListMessage
  | BranchListMessage
  | BranchCreateMessage
  | ConnectionTestMessage
  | RetrySyncMessage
  | SyncHistoryReadMessage
  | RetryBundlesReadMessage;

export type RetryBundlesReadResponse = RetryBundleSummary[];
export type SyncHistoryReadResponse = SyncHistoryEntry[];

export interface SyncStatusMessage {
  type: "sync:status";
  payload: {
    status: SyncStatus;
    syncHistoryEntry: SyncHistoryEntry | null;
    error: NormalizedError | null;
  };
}

export interface SyncHistoryUpdatedMessage {
  type: typeof SYNC_HISTORY_UPDATED_TYPE;
  payload: {
    syncHistory: SyncHistoryState;
  };
}

export type BackgroundToContentPopupMessage =
  | SyncStatusMessage
  | SyncHistoryUpdatedMessage;

export type RuntimeMessage =
  | ScaffoldReadyMessage
  | ContentToBackgroundMessage
  | PopupOptionsToBackgroundMessage
  | BackgroundToContentPopupMessage;

export const RUNTIME_MESSAGE_TYPES = [
  "scaffold:ready",
  "content:accepted_detected",
  "content:toast_action",
  "settings:read",
  "settings:write",
  "github:repositories:list",
  "github:branches:list",
  "github:branch:create",
  "github:connection:test",
  "sync:retry",
  SYNC_HISTORY_READ_TYPE,
  RETRY_BUNDLES_READ_TYPE,
  "sync:status",
  SYNC_HISTORY_UPDATED_TYPE
] as const satisfies readonly RuntimeMessage["type"][];

export type RuntimeMessageType = (typeof RUNTIME_MESSAGE_TYPES)[number];

export const LEGACY_RUNTIME_MESSAGE_TYPES = [
  LEGACY_HISTORY_READ_TYPE,
  LEGACY_RETRY_PAYLOADS_READ_TYPE,
  LEGACY_HISTORY_UPDATED_TYPE
] as const;

const FORBIDDEN_MESSAGE_SECRET_KEYS = [
  "pat",
  "githubPat",
  "token",
  "accessToken",
  "cookie",
  "leetcodeCookie",
  "sessionToken"
] as const;

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return normalizeRuntimeMessage(value) !== null;
}

export function normalizeRuntimeMessage(raw: unknown): RuntimeMessage | null {
  if (!isPlainRecord(raw) || typeof raw.type !== "string") {
    return null;
  }

  if (hasForbiddenMessageSecretKey(raw)) {
    return null;
  }

  if (raw.type === "sync:retry") {
    return normalizeRetrySyncMessage(raw);
  }

  if (raw.type === LEGACY_HISTORY_READ_TYPE) {
    return {
      ...raw,
      type: SYNC_HISTORY_READ_TYPE
    } as SyncHistoryReadMessage;
  }

  if (raw.type === LEGACY_RETRY_PAYLOADS_READ_TYPE) {
    return {
      type: RETRY_BUNDLES_READ_TYPE
    };
  }

  if (raw.type === LEGACY_HISTORY_UPDATED_TYPE) {
    return normalizeSyncHistoryUpdatedMessage(raw, "history");
  }

  if (raw.type === SYNC_HISTORY_UPDATED_TYPE) {
    return normalizeSyncHistoryUpdatedMessage(raw, "syncHistory");
  }

  if (raw.type === "sync:status") {
    return normalizeSyncStatusMessage(raw);
  }

  if (!(RUNTIME_MESSAGE_TYPES as readonly string[]).includes(raw.type)) {
    return null;
  }

  return raw as unknown as RuntimeMessage;
}

function normalizeRetrySyncMessage(raw: Record<string, unknown>): RetrySyncMessage | null {
  const payload = raw.payload;

  if (!isPlainRecord(payload)) {
    return null;
  }

  const retryBundleId =
    typeof payload.retryBundleId === "string"
      ? payload.retryBundleId
      : payload.retryPayloadId;

  if (typeof retryBundleId !== "string") {
    return null;
  }

  return {
    type: "sync:retry",
    payload: {
      retryBundleId
    }
  };
}

function normalizeSyncStatusMessage(
  raw: Record<string, unknown>
): SyncStatusMessage | null {
  const payload = raw.payload;

  if (!isPlainRecord(payload)) {
    return null;
  }

  const syncHistoryEntry =
    payload.syncHistoryEntry === undefined ? payload.record : payload.syncHistoryEntry;

  return {
    type: "sync:status",
    payload: {
      ...payload,
      syncHistoryEntry
    }
  } as SyncStatusMessage;
}

function normalizeSyncHistoryUpdatedMessage(
  raw: Record<string, unknown>,
  preferredField: "syncHistory" | "history"
): SyncHistoryUpdatedMessage | null {
  const payload = raw.payload;

  if (!isPlainRecord(payload)) {
    return null;
  }

  const syncHistory =
    preferredField === "syncHistory"
      ? payload.syncHistory ?? payload.history
      : payload.history ?? payload.syncHistory;

  if (syncHistory === undefined) {
    return null;
  }

  return {
    type: SYNC_HISTORY_UPDATED_TYPE,
    payload: {
      syncHistory: syncHistory as SyncHistoryState
    }
  };
}

export function hasForbiddenMessageSecretKey(value: unknown): boolean {
  return hasForbiddenMessageSecretKeyInternal(value, new WeakSet<object>());
}

function hasForbiddenMessageSecretKeyInternal(
  value: unknown,
  seen: WeakSet<object>
): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenMessageSecretKeyInternal(item, seen));
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if ((FORBIDDEN_MESSAGE_SECRET_KEYS as readonly string[]).includes(key)) {
      return true;
    }

    if (hasForbiddenMessageSecretKeyInternal(nestedValue, seen)) {
      return true;
    }
  }

  return false;
}
