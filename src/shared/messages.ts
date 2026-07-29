import { isNormalizedError, type NormalizedError } from "./errors";
import type {
  RetryBundleSummary,
  SyncHistoryEntry,
  SyncStatus
} from "./types";
import type { SyncRepository } from "./types";
import {
  isPlainRecord,
  isSyncBranch,
  isSyncHistoryEntry,
  isSyncRepository,
  isSyncStatus
} from "./types";
import {
  isConnectionStatus,
  parseSyncHistoryState,
  type PublicSettingsUpdate,
  type SyncHistoryState
} from "./storageSchema";
import type { UiLanguagePreference } from "./i18n";
import {
  MAX_ACCEPTED_CODE_BYTES,
  MAX_ACCEPTED_LANGUAGE_LENGTH,
  MAX_ACCEPTED_PLATFORM_ID_LENGTH,
  MAX_ACCEPTED_TITLE_SLUG_LENGTH,
  acceptedCodeByteLength,
  isAcceptedHttpsUrlWithinLimit,
  isAcceptedTextWithinLimit,
  isAcceptedTitleWithinLimit
} from "./acceptedSourceLimits";

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
    syncHistoryEntryId: string | null;
    retryBundleId: string | null;
  };
}

export interface UiLocaleReadMessage {
  type: "ui:locale:read";
}

export interface UiLocaleReadResponse {
  uiLanguage: UiLanguagePreference;
}

export type ContentToBackgroundMessage =
  | AcceptedDetectedMessage
  | ToastActionMessage
  | UiLocaleReadMessage;

export interface SettingsReadMessage {
  type: "settings:read";
}

export interface SettingsWriteMessage {
  type: "settings:write";
  payload: {
    update: PublicSettingsUpdate;
  };
}

export interface GitHubAuthStartMessage {
  type: "github:auth:start";
}

export interface GitHubAuthReadMessage {
  type: "github:auth:read";
}

export interface GitHubAuthPollMessage {
  type: "github:auth:poll";
}

export interface GitHubAuthDisconnectMessage {
  type: "github:auth:disconnect";
}

export interface GitHubInstallationOpenMessage {
  type: "github:installation:open";
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

export interface StorageRetryBundlesClearMessage {
  type: "storage:retry-bundles:clear";
}

export interface StorageClearAllMessage {
  type: "storage:clear-all";
}

export type PopupOptionsToBackgroundMessage =
  | SettingsReadMessage
  | SettingsWriteMessage
  | GitHubAuthStartMessage
  | GitHubAuthReadMessage
  | GitHubAuthPollMessage
  | GitHubAuthDisconnectMessage
  | GitHubInstallationOpenMessage
  | RepositoryListMessage
  | BranchListMessage
  | BranchCreateMessage
  | ConnectionTestMessage
  | RetrySyncMessage
  | SyncHistoryReadMessage
  | RetryBundlesReadMessage
  | StorageRetryBundlesClearMessage
  | StorageClearAllMessage;

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
  "ui:locale:read",
  "settings:write",
  "github:auth:start",
  "github:auth:read",
  "github:auth:poll",
  "github:auth:disconnect",
  "github:installation:open",
  "github:repositories:list",
  "github:branches:list",
  "github:branch:create",
  "github:connection:test",
  "sync:retry",
  SYNC_HISTORY_READ_TYPE,
  RETRY_BUNDLES_READ_TYPE,
  "storage:retry-bundles:clear",
  "storage:clear-all",
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
  "refreshToken",
  "deviceCode",
  "cookie",
  "leetcodeCookie",
  "sessionToken"
] as const;

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return normalizeRuntimeMessage(value) !== null;
}

export function isRuntimeMessagePayloadTooLarge(raw: unknown): boolean {
  if (
    !isPlainRecord(raw) ||
    raw.type !== "content:accepted_detected" ||
    !isPlainRecord(raw.payload)
  ) {
    return false;
  }

  return (
    raw.payload.codingPlatform === "programmers" &&
    typeof raw.payload.code === "string" &&
    acceptedCodeByteLength(raw.payload.code) > MAX_ACCEPTED_CODE_BYTES
  );
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

  if (raw.type === "scaffold:ready") {
    return normalizeScaffoldReadyMessage(raw);
  }

  if (raw.type === "content:toast_action") {
    return normalizeToastActionMessage(raw);
  }

  if (raw.type === LEGACY_HISTORY_READ_TYPE) {
    return normalizeSyncHistoryReadMessage({
      ...raw,
      type: SYNC_HISTORY_READ_TYPE
    });
  }

  if (raw.type === LEGACY_RETRY_PAYLOADS_READ_TYPE) {
    return hasOnlyKeys(raw, ["type"])
      ? {
          type: RETRY_BUNDLES_READ_TYPE
        }
      : null;
  }

  if (raw.type === LEGACY_HISTORY_UPDATED_TYPE) {
    return normalizeSyncHistoryUpdatedMessage(raw, "history");
  }

  if (raw.type === SYNC_HISTORY_UPDATED_TYPE) {
    return normalizeSyncHistoryUpdatedMessage(raw, "syncHistory");
  }

  if (raw.type === "content:accepted_detected") {
    return normalizeAcceptedDetectedMessage(raw);
  }

  if (raw.type === "settings:write") {
    return normalizeSettingsWriteMessage(raw);
  }

  if (raw.type === "github:repositories:list") {
    return normalizeRepositoryListMessage(raw);
  }

  if (raw.type === "github:branches:list") {
    return normalizeBranchListMessage(raw);
  }

  if (raw.type === "github:branch:create") {
    return normalizeBranchCreateMessage(raw);
  }

  if (raw.type === "github:connection:test") {
    return normalizeConnectionTestMessage(raw);
  }

  if (raw.type === SYNC_HISTORY_READ_TYPE) {
    return normalizeSyncHistoryReadMessage(raw);
  }

  if (raw.type === "sync:status") {
    return normalizeSyncStatusMessage(raw);
  }

  if (!(RUNTIME_MESSAGE_TYPES as readonly string[]).includes(raw.type)) {
    return null;
  }

  return hasOnlyKeys(raw, ["type"]) ? (raw as unknown as RuntimeMessage) : null;
}

const MAX_RUNTIME_ID_LENGTH = 256;

function normalizeScaffoldReadyMessage(
  raw: Record<string, unknown>
): ScaffoldReadyMessage | null {
  return hasOnlyKeys(raw, ["type", "surface"]) &&
    (raw.surface === "background" ||
      raw.surface === "content" ||
      raw.surface === "options" ||
      raw.surface === "popup")
    ? (raw as unknown as ScaffoldReadyMessage)
    : null;
}

function normalizeAcceptedDetectedMessage(
  raw: Record<string, unknown>
): AcceptedDetectedMessage | null {
  const payload = raw.payload;

  if (!hasOnlyKeys(raw, ["type", "payload"]) || !isPlainRecord(payload)) {
    return null;
  }

  if (payload.codingPlatform === "leetcode") {
    if (
      !hasOnlyKeys(payload, ["codingPlatform", "titleSlug", "pageUrl", "detectedAt"]) ||
      !isAcceptedTextWithinLimit(
        payload.titleSlug,
        MAX_ACCEPTED_TITLE_SLUG_LENGTH
      ) ||
      !isAcceptedHttpsUrlWithinLimit(payload.pageUrl) ||
      !isIsoDateString(payload.detectedAt)
    ) {
      return null;
    }

    return raw as unknown as AcceptedDetectedMessage;
  }

  if (payload.codingPlatform !== "programmers") {
    return null;
  }

  if (
    !hasOnlyKeys(payload, [
      "codingPlatform",
      "courseId",
      "lessonId",
      "problemTitle",
      "language",
      "code",
      "pageUrl",
      "detectedAt"
    ]) ||
    !isAcceptedTextWithinLimit(
      payload.courseId,
      MAX_ACCEPTED_PLATFORM_ID_LENGTH
    ) ||
    !isAcceptedTextWithinLimit(
      payload.lessonId,
      MAX_ACCEPTED_PLATFORM_ID_LENGTH
    ) ||
    !isAcceptedTitleWithinLimit(payload.problemTitle) ||
    !isAcceptedTextWithinLimit(
      payload.language,
      MAX_ACCEPTED_LANGUAGE_LENGTH
    ) ||
    typeof payload.code !== "string" ||
    payload.code.length === 0 ||
    !isAcceptedHttpsUrlWithinLimit(payload.pageUrl) ||
    !isIsoDateString(payload.detectedAt)
  ) {
    return null;
  }

  return raw as unknown as AcceptedDetectedMessage;
}

function normalizeSettingsWriteMessage(
  raw: Record<string, unknown>
): SettingsWriteMessage | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, ["update"]) ||
    !isPlainRecord(payload.update)
  ) {
    return null;
  }

  const update = payload.update;
  if (
    Object.keys(update).length === 0 ||
    !hasOnlyKeys(update, [
      "syncRepository",
      "syncBranch",
      "autoSyncEnabled",
      "uiLanguage",
      "connectionStatus"
    ]) ||
    (update.syncRepository !== undefined &&
      update.syncRepository !== null &&
      !isSyncRepository(update.syncRepository)) ||
    (update.syncBranch !== undefined &&
      update.syncBranch !== null &&
      !isSyncBranch(update.syncBranch)) ||
    (update.autoSyncEnabled !== undefined &&
      typeof update.autoSyncEnabled !== "boolean") ||
    (update.uiLanguage !== undefined &&
      update.uiLanguage !== "system" &&
      update.uiLanguage !== "en" &&
      update.uiLanguage !== "ko") ||
    (update.connectionStatus !== undefined &&
      !isConnectionStatus(update.connectionStatus))
  ) {
    return null;
  }

  return raw as unknown as SettingsWriteMessage;
}

function normalizeRepositoryListMessage(
  raw: Record<string, unknown>
): RepositoryListMessage | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, ["query", "page", "perPage"]) ||
    !(
      payload.query === null ||
      (typeof payload.query === "string" && payload.query.length <= 256)
    ) ||
    !isIntegerInRange(payload.page, 1, 10_000) ||
    !isIntegerInRange(payload.perPage, 1, 100)
  ) {
    return null;
  }

  return raw as unknown as RepositoryListMessage;
}

function normalizeBranchListMessage(
  raw: Record<string, unknown>
): BranchListMessage | null {
  return normalizeRepositoryPayloadMessage(raw, ["repository"]) as BranchListMessage | null;
}

function normalizeBranchCreateMessage(
  raw: Record<string, unknown>
): BranchCreateMessage | null {
  const normalized = normalizeRepositoryPayloadMessage(raw, [
    "repository",
    "branchName"
  ]);

  if (
    normalized === null ||
    !isPlainRecord(normalized.payload) ||
    !isValidBranchName(normalized.payload.branchName)
  ) {
    return null;
  }

  return raw as unknown as BranchCreateMessage;
}

function normalizeConnectionTestMessage(
  raw: Record<string, unknown>
): ConnectionTestMessage | null {
  const normalized = normalizeRepositoryPayloadMessage(raw, [
    "repository",
    "branchName"
  ]);

  if (
    normalized === null ||
    !isPlainRecord(normalized.payload) ||
    !isValidBranchName(normalized.payload.branchName)
  ) {
    return null;
  }

  return raw as unknown as ConnectionTestMessage;
}

function normalizeRepositoryPayloadMessage(
  raw: Record<string, unknown>,
  payloadKeys: readonly string[]
): Record<string, unknown> | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, payloadKeys) ||
    !isSyncRepository(payload.repository)
  ) {
    return null;
  }

  return raw;
}

function normalizeSyncHistoryReadMessage(
  raw: Record<string, unknown>
): SyncHistoryReadMessage | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, ["limit"]) ||
    !isIntegerInRange(payload.limit, 0, 100)
  ) {
    return null;
  }

  return raw as unknown as SyncHistoryReadMessage;
}

function normalizeRetrySyncMessage(raw: Record<string, unknown>): RetrySyncMessage | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, ["retryBundleId", "retryPayloadId"])
  ) {
    return null;
  }

  const retryBundleId =
    typeof payload.retryBundleId === "string"
      ? payload.retryBundleId
      : payload.retryPayloadId;

  if (!isBoundedNonEmptyString(retryBundleId, MAX_RUNTIME_ID_LENGTH)) {
    return null;
  }

  return {
    type: "sync:retry",
    payload: {
      retryBundleId
    }
  };
}

function normalizeToastActionMessage(
  raw: Record<string, unknown>
): ToastActionMessage | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, [
      "action",
      "syncHistoryEntryId",
      "recordId",
      "retryBundleId"
    ])
  ) {
    return null;
  }

  const action = payload.action;
  if (!isToastAction(action)) {
    return null;
  }

  const syncHistoryEntryId =
    typeof payload.syncHistoryEntryId === "string"
      ? payload.syncHistoryEntryId
      : payload.recordId;
  const retryBundleId = payload.retryBundleId;

  if (
    (payload.syncHistoryEntryId !== undefined &&
      payload.syncHistoryEntryId !== null &&
      !isBoundedNonEmptyString(
        payload.syncHistoryEntryId,
        MAX_RUNTIME_ID_LENGTH
      )) ||
    (payload.recordId !== undefined &&
      payload.recordId !== null &&
      !isBoundedNonEmptyString(payload.recordId, MAX_RUNTIME_ID_LENGTH)) ||
    (syncHistoryEntryId !== undefined &&
      syncHistoryEntryId !== null &&
      !isBoundedNonEmptyString(syncHistoryEntryId, MAX_RUNTIME_ID_LENGTH)) ||
    (retryBundleId !== undefined &&
      retryBundleId !== null &&
      !isBoundedNonEmptyString(retryBundleId, MAX_RUNTIME_ID_LENGTH))
  ) {
    return null;
  }

  return {
    type: "content:toast_action",
    payload: {
      action,
      syncHistoryEntryId:
        syncHistoryEntryId === undefined ? null : syncHistoryEntryId,
      retryBundleId:
        retryBundleId === undefined ? null : retryBundleId
    }
  };
}

function isToastAction(value: unknown): value is ToastAction {
  return (
    value === "open_options" ||
    value === "open_popup" ||
    value === "open_commit" ||
    value === "open_file" ||
    value === "retry" ||
    value === "dismiss"
  );
}

function normalizeSyncStatusMessage(
  raw: Record<string, unknown>
): SyncStatusMessage | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, ["status", "syncHistoryEntry", "record", "error"])
  ) {
    return null;
  }

  const syncHistoryEntry =
    payload.syncHistoryEntry === undefined ? payload.record : payload.syncHistoryEntry;

  if (
    !isSyncStatus(payload.status) ||
    !(syncHistoryEntry === null || isSyncHistoryEntry(syncHistoryEntry)) ||
    !(payload.error === null || isNormalizedError(payload.error))
  ) {
    return null;
  }

  return {
    type: "sync:status",
    payload: {
      status: payload.status,
      syncHistoryEntry,
      error: payload.error
    }
  };
}

function normalizeSyncHistoryUpdatedMessage(
  raw: Record<string, unknown>,
  preferredField: "syncHistory" | "history"
): SyncHistoryUpdatedMessage | null {
  const payload = raw.payload;

  if (
    !hasOnlyKeys(raw, ["type", "payload"]) ||
    !isPlainRecord(payload) ||
    !hasOnlyKeys(payload, ["syncHistory", "history"])
  ) {
    return null;
  }

  const syncHistory =
    preferredField === "syncHistory"
      ? payload.syncHistory ?? payload.history
      : payload.history ?? payload.syncHistory;

  const parsedSyncHistory = parseSyncHistoryState(syncHistory);
  if (parsedSyncHistory === null) {
    return null;
  }

  return {
    type: SYNC_HISTORY_UPDATED_TYPE,
    payload: {
      syncHistory: parsedSyncHistory
    }
  };
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isBoundedNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isValidBranchName(value: unknown): value is string {
  return (
    isBoundedNonEmptyString(value, 255) &&
    !/[\u0000-\u0020\u007f~^:?*[\]\\]/u.test(value) &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.endsWith(".") &&
    !value.includes("..") &&
    !value.includes("@{")
  );
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
