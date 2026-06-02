import type { NormalizedError } from "./errors";
import { t, type UiLocale } from "./i18n";
import type { ToastAction } from "./messages";
import type { CodingPlatform, SyncHistoryEntry, SyncStatus } from "./types";
import type {
  ConnectionStatus,
  ConnectionStatusCode,
  PublicSettingsState
} from "./storageSchema";

export type Tone = "neutral" | "success" | "warning" | "error";

export interface ConnectionStatusView {
  label: string;
  detail: string | null;
  tone: Tone;
}

export interface SetupStatusView {
  label: string;
  detail: string;
  tone: Tone;
}

export interface FailureDetailView {
  summary: string;
  detailLines: string[];
}

export interface ToastActionView {
  action: ToastAction;
  label: string;
  recordId: string | null;
  primary: boolean;
}

export interface ToastViewModel {
  title: string;
  detail: string | null;
  tone: Tone;
  actions: ToastActionView[];
  autoDismissMs: number | null;
}

export interface ToastModelInput {
  status: SyncStatus;
  record: SyncHistoryEntry | null;
  error: NormalizedError | null;
  canRetry?: boolean;
}

export function getConnectionStatusView(
  locale: UiLocale,
  status: ConnectionStatus | ConnectionStatusCode,
  error: NormalizedError | null = null
): ConnectionStatusView {
  const statusCode = typeof status === "string" ? status : status.code;
  const statusError = error ?? (typeof status === "string" ? null : status.error);
  const detail = statusError?.userMessage ?? null;

  switch (statusCode) {
    case "not_tested":
      return view(t(locale, "status.notTested"), detail, "neutral");
    case "testing":
      return view(t(locale, "status.testing"), detail, "neutral");
    case "connected":
      return view(t(locale, "status.connected"), detail, "success");
    case "branch_created":
      return view(t(locale, "status.branchCreated"), detail, "success");
    case "no_accessible_repositories":
      return view(
        t(locale, "status.noOwnedRepositories"),
        detail ?? t(locale, "detail.noOwnedRepositories"),
        "warning"
      );
    case "repository_not_found":
      return view(t(locale, "status.repositoryNotFound"), detail, "error");
    case "branch_not_found":
      return view(t(locale, "status.branchNotFound"), detail, "error");
    case "branch_create_failed":
      return view(t(locale, "status.branchCreateFailed"), detail, "error");
    case "auth_failed":
      return view(t(locale, "status.authFailed"), detail, "error");
    case "token_expired":
      return view(t(locale, "status.tokenExpired"), detail, "error");
    case "rate_limited":
      return view(t(locale, "status.rateLimited"), detail, "warning");
    case "network_failed":
      return view(t(locale, "status.networkFailed"), detail, "warning");
  }
}

export function getSetupStatusView(
  locale: UiLocale,
  settings: PublicSettingsState | null
): SetupStatusView {
  if (settings === null) {
    return {
      label: t(locale, "status.loadingSettings"),
      detail: t(locale, "detail.loadingSettings"),
      tone: "neutral"
    };
  }

  if (!settings.hasGithubPat) {
    return {
      label: t(locale, "status.githubConnectionRequired"),
      detail: t(locale, "detail.githubConnectionRequired"),
      tone: "warning"
    };
  }

  if (settings.selectedRepository === null) {
    return {
      label: t(locale, "status.repositoryRequired"),
      detail: t(locale, "detail.repositoryRequired"),
      tone: "warning"
    };
  }

  if (settings.selectedBranch === null) {
    return {
      label: t(locale, "status.branchRequired"),
      detail: t(locale, "detail.branchRequired"),
      tone: "warning"
    };
  }

  const target = `${settings.selectedRepository.fullName} / ${settings.selectedBranch.name}`;

  if (!settings.autoSyncEnabled) {
    return {
      label: t(locale, "status.autoSyncOff"),
      detail: t(locale, "detail.autoSyncOffConfigured", { target }),
      tone: "warning"
    };
  }

  switch (settings.connectionStatus.code) {
    case "connected":
    case "branch_created":
      return {
        label: t(locale, "status.readyToSync"),
        detail: target,
        tone: "success"
      };
    case "not_tested":
      return {
        label: t(locale, "status.connectionNotTested"),
        detail: t(locale, "detail.connectionNotTested", { target }),
        tone: "neutral"
      };
    case "testing":
      return {
        label: t(locale, "status.testing"),
        detail: target,
        tone: "neutral"
      };
    case "no_accessible_repositories":
    case "repository_not_found":
    case "branch_not_found":
    case "branch_create_failed":
    case "auth_failed":
    case "token_expired":
    case "rate_limited":
    case "network_failed": {
      const connection = getConnectionStatusView(locale, settings.connectionStatus);

      return {
        label: connection.label,
        detail: connection.detail ?? t(locale, "detail.connectionCheckSaved"),
        tone: connection.tone
      };
    }
  }
}

export function getFailureDetailView(
  locale: UiLocale,
  record: SyncHistoryEntry
): FailureDetailView | null {
  if (record.error === null) {
    return null;
  }

  const detailLines = [
    t(locale, "failure.code", {
      code: record.error.code
    })
  ];

  if (record.error.debugMessage !== null && record.error.debugMessage.length > 0) {
    detailLines.push(
      t(locale, "failure.detail", {
        detail: record.error.debugMessage
      })
    );
  }

  if (record.error.code === "programmers_extract_failed") {
    detailLines.push(t(locale, "detail.noCommitPayloadRetryUnavailable"));
  } else if (record.retryPayloadId === null && record.status === "failed") {
    detailLines.push(t(locale, "detail.retryPayloadUnavailable"));
  }

  return {
    summary: record.error.userMessage,
    detailLines
  };
}

export function getSyncStatusLabel(locale: UiLocale, status: SyncStatus): string {
  switch (status) {
    case "setup_required":
      return t(locale, "status.setupRequired");
    case "auto_sync_disabled":
      return t(locale, "status.autoSyncOff");
    case "syncing":
      return t(locale, "status.syncing");
    case "synced":
      return t(locale, "status.synced");
    case "unsupported_language":
      return t(locale, "status.unsupportedLanguage");
    case "failed":
      return t(locale, "status.failed");
    case "retrying":
      return t(locale, "status.retrying");
  }
}

export function getSyncStatusTone(status: SyncStatus): Tone {
  switch (status) {
    case "synced":
      return "success";
    case "setup_required":
    case "auto_sync_disabled":
    case "unsupported_language":
      return "warning";
    case "failed":
      return "error";
    case "syncing":
    case "retrying":
      return "neutral";
  }
}

export function createToastViewModel(
  locale: UiLocale,
  input: ToastModelInput
): ToastViewModel {
  switch (input.status) {
    case "setup_required":
      return {
        title: t(locale, "status.githubConnectionRequired"),
        detail: t(locale, "detail.toastSetupRequired"),
        tone: "warning",
        actions: [toastAction("open_options", t(locale, "action.openOptions"), null, true)],
        autoDismissMs: null
      };
    case "auto_sync_disabled":
      return {
        title: t(locale, "toast.autoSyncOffTitle"),
        detail: t(locale, "detail.toastAutoSyncOff"),
        tone: "warning",
        actions: [toastAction("open_options", t(locale, "action.openOptions"), null, true)],
        autoDismissMs: 7000
      };
    case "syncing":
      return {
        title: t(locale, "toast.syncingTitle"),
        detail: describeRecord(locale, input.record),
        tone: "neutral",
        actions: [],
        autoDismissMs: null
      };
    case "retrying":
      return {
        title: t(locale, "toast.retryingTitle"),
        detail: describeRecord(locale, input.record),
        tone: "neutral",
        actions: [],
        autoDismissMs: null
      };
    case "synced":
      return {
        title: t(locale, "toast.syncedTitle"),
        detail: describeRecord(locale, input.record),
        tone: "success",
        actions: successActions(locale, input.record),
        autoDismissMs: 5000
      };
    case "unsupported_language":
      return {
        title: t(locale, "status.unsupportedLanguage"),
        detail: unsupportedDetail(locale, input.record),
        tone: "warning",
        actions: [],
        autoDismissMs: 8000
      };
    case "failed":
      return {
        title: t(locale, "toast.failedTitle"),
        detail: failureDetail(locale, input.error ?? input.record?.error ?? null),
        tone: "error",
        actions: failureActions(locale, input),
        autoDismissMs: null
      };
  }
}

export function getPlatformLabel(codingPlatform: CodingPlatform): string {
  return codingPlatform === "programmers" ? "Programmers" : "LeetCode";
}

export function getSyncHistoryEntryLanguageLabel(
  locale: UiLocale,
  record: Pick<SyncHistoryEntry, "language" | "supportedLanguage">
): string {
  if (record.supportedLanguage === "python3") {
    return "Python3";
  }

  if (record.supportedLanguage === "swift") {
    return "Swift";
  }

  return record.language.trim().length > 0
    ? record.language
    : t(locale, "label.unknownLanguage");
}

export function getUnsupportedLanguageReason(locale: UiLocale): string {
  return t(locale, "detail.unsupportedNoCommit");
}

function successActions(
  locale: UiLocale,
  record: SyncHistoryEntry | null
): ToastActionView[] {
  const actions: ToastActionView[] = [];

  if (record?.commitUrl !== null && record?.commitUrl !== undefined) {
    actions.push(toastAction("open_commit", t(locale, "action.commit"), record.id, true));
  }

  if (record?.fileUrl !== null && record?.fileUrl !== undefined) {
    actions.push(toastAction("open_file", t(locale, "action.file"), record.id, false));
  }

  actions.push(
    toastAction("dismiss", t(locale, "action.dismiss"), null, actions.length === 0)
  );

  return actions;
}

function failureActions(
  locale: UiLocale,
  input: ToastModelInput
): ToastActionView[] {
  const error = input.error ?? input.record?.error ?? null;

  if (error?.code === "programmers_extract_failed") {
    return [];
  }

  const canRetry =
    input.canRetry !== false && typeof input.record?.retryPayloadId === "string";

  if (canRetry) {
    return [
      toastAction("retry", t(locale, "action.retry"), input.record?.id ?? null, true),
      toastAction("open_options", t(locale, "action.openOptions"), null, false)
    ];
  }

  return [toastAction("open_options", t(locale, "action.openOptions"), null, true)];
}

function failureDetail(locale: UiLocale, error: NormalizedError | null): string {
  return error?.userMessage ?? t(locale, "detail.toastFailureFallback");
}

function unsupportedDetail(locale: UiLocale, record: SyncHistoryEntry | null): string {
  if (record?.language !== undefined && record.language.trim().length > 0) {
    return t(locale, "detail.unsupportedLanguageNamed", {
      language: record.language
    });
  }

  return t(locale, "detail.unsupportedLanguageDefault");
}

function describeRecord(
  locale: UiLocale,
  record: SyncHistoryEntry | null
): string | null {
  if (record === null) {
    return null;
  }

  const title = getToastRecordTitle(record);
  const language = getSyncHistoryEntryLanguageLabel(locale, record);

  if (title.length === 0 && language.length === 0) {
    return null;
  }

  if (language.length === 0) {
    return title;
  }

  return t(locale, "detail.recordInLanguage", { title, language });
}

function getToastRecordTitle(record: SyncHistoryEntry): string {
  const title = record.problemTitle?.trim() ?? "";
  const titleSlug = record.titleSlug.trim();
  const frontendId = record.problemFrontendId?.trim() ?? "";

  if (title.length > 0) {
    return title;
  }

  if (titleSlug.length > 0) {
    return titleSlug;
  }

  if (frontendId.length > 0) {
    return `${getPlatformLabel(record.codingPlatform)} ${frontendId}`;
  }

  return getPlatformLabel(record.codingPlatform);
}

function toastAction(
  action: ToastAction,
  label: string,
  recordId: string | null,
  primary: boolean
): ToastActionView {
  return {
    action,
    label,
    recordId,
    primary
  };
}

function view(
  label: string,
  detail: string | null,
  tone: Tone
): ConnectionStatusView {
  return {
    label,
    detail,
    tone
  };
}
