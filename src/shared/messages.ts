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
    retryPayloadId: string;
  };
}

export interface HistoryReadMessage {
  type: "history:read";
  payload: {
    limit: number;
  };
}

export interface RetryBundlesReadMessage {
  type: "retry-payloads:read";
}

export type PopupOptionsToBackgroundMessage =
  | SettingsReadMessage
  | SettingsWriteMessage
  | RepositoryListMessage
  | BranchListMessage
  | BranchCreateMessage
  | ConnectionTestMessage
  | RetrySyncMessage
  | HistoryReadMessage
  | RetryBundlesReadMessage;

export type RetryBundlesReadResponse = RetryBundleSummary[];

export interface SyncStatusMessage {
  type: "sync:status";
  payload: {
    status: SyncStatus;
    record: SyncHistoryEntry | null;
    error: NormalizedError | null;
  };
}

export interface HistoryUpdatedMessage {
  type: "history:updated";
  payload: {
    history: SyncHistoryState;
  };
}

export type BackgroundToContentPopupMessage = SyncStatusMessage | HistoryUpdatedMessage;

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
  "history:read",
  "retry-payloads:read",
  "sync:status",
  "history:updated"
] as const satisfies readonly RuntimeMessage["type"][];

export type RuntimeMessageType = (typeof RUNTIME_MESSAGE_TYPES)[number];

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
  if (!isPlainRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (hasForbiddenMessageSecretKey(value)) {
    return false;
  }

  return (RUNTIME_MESSAGE_TYPES as readonly string[]).includes(value.type);
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
