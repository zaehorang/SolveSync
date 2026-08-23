/**
 * Options의 순수 view model.
 *
 * DOM과 `chrome.*`를 건드리지 않는다. 입력을 받아 화면에 그릴 값을 돌려주기만
 * 하므로 브라우저 없이 테스트할 수 있다. Options entry는 이 값을 DOM에 옮기는
 * 일만 한다.
 */
import {
  getConnectionStatusView as getSharedConnectionStatusView,
  normalizeError,
  t,
  type ConnectionStatus,
  type ConnectionStatusCode,
  type ConnectionStatusView,
  type I18nKey,
  type NormalizedError,
  type NormalizedErrorCode,
  type PublicSettingsState,
  type RepositoryCleanupResult,
  type SyncBranch,
  type SyncRepository,
  type Tone,
  type UiLanguagePreference,
  type UiLocale
} from "../shared";

export interface InlineMessage {
  text: string;
  tone: Tone;
  i18nKey?: I18nKey;
  i18nParams?: Record<string, string | number>;
}

export interface OptionsRuntimeState {
  isGithubConnected: boolean;
  githubAccount: PublicSettingsState["githubAccount"];
  pendingAuth: PublicPendingGitHubAuth | null;
  authorizing: boolean;
  authPollTimer: ReturnType<typeof setTimeout> | null;
  repositories: SyncRepository[];
  repositoryQuery: string;
  syncRepository: SyncRepository | null;
  branches: SyncBranch[];
  syncBranch: SyncBranch | null;
  autoSyncEnabled: boolean;
  uiLanguage: UiLanguagePreference;
  locale: UiLocale;
  connectionStatus: ConnectionStatus;
  loadingSettings: boolean;
  loadingRepositories: boolean;
  loadingBranches: boolean;
  creatingBranch: boolean;
  testingConnection: boolean;
  savingSettings: boolean;
  cleanupRunning: boolean;
  cleanupResult: RepositoryCleanupResult | null;
  cleanupError: NormalizedError | null;
  authMessage: InlineMessage;
  repositoryMessage: InlineMessage;
  branchMessage: InlineMessage;
  createBranchMessage: InlineMessage;
  saveMessage: InlineMessage;
}

export const EMPTY_MESSAGE: InlineMessage = {
  text: "",
  tone: "neutral"
};

export interface RepositoryFilterState {
  query: string;
  repositories: SyncRepository[];
  visibleRepositories: SyncRepository[];
  hasMatches: boolean;
}

export type SetupFlowStepId = "auth" | "repository" | "branch" | "connection";

export type SetupFlowStepState = "active" | "complete" | "disabled";

export interface SetupFlowStateDraft {
  isGithubConnected: boolean;
  syncRepository: SyncRepository | null;
  syncBranch: SyncBranch | null;
  connectionStatus: ConnectionStatus | ConnectionStatusCode;
}

export interface SettingsValidationDraft {
  isGithubConnected: boolean;
  syncRepository: SyncRepository | null;
  syncBranch: SyncBranch | null;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: {
    githubAuth?: string;
    repository?: string;
    branch?: string;
  };
}

export interface PublicPendingGitHubAuth {
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
}

export interface DeviceFlowRenderState {
  hidden: boolean;
  userCode: string;
}

export function normalizeOptionsExtensionStateError(
  error: unknown
): NormalizedError {
  const debugMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  return normalizeError({
    code: "extension_state_unavailable",
    debugMessage
  });
}

export function getOptionsExtensionStateUnavailableMessage(
  locale: UiLocale = "en"
): string {
  return t(locale, "options.message.extensionStateUnavailable");
}

export function getOptionsAuthErrorMessage(
  error: NormalizedError,
  locale: UiLocale = "en"
): string {
  return error.code === "github_app_not_configured"
    ? t(locale, "options.message.githubAppNotConfigured")
    : error.userMessage;
}

export function getRepositoryFilterState(
  repositories: SyncRepository[],
  query: string
): RepositoryFilterState {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRepositories =
    normalizedQuery.length === 0
      ? repositories
      : repositories.filter((repository) =>
          repository.fullName.toLowerCase().includes(normalizedQuery)
        );

  return {
    query,
    repositories,
    visibleRepositories,
    hasMatches: visibleRepositories.length > 0
  };
}

export function getDefaultBranchSelection(
  repository: SyncRepository | null,
  branches: SyncBranch[],
  preferredBranchName: string | null
): string | null {
  if (branches.length === 0) {
    return null;
  }

  if (
    preferredBranchName !== null &&
    branches.some((branch) => branch.name === preferredBranchName)
  ) {
    return preferredBranchName;
  }

  if (
    repository !== null &&
    branches.some((branch) => branch.name === repository.defaultBranch)
  ) {
    return repository.defaultBranch;
  }

  return branches[0]?.name ?? null;
}

export function getSetupFlowStepStates(
  draft: SetupFlowStateDraft
): Record<SetupFlowStepId, SetupFlowStepState> {
  const connectionStatusCode =
    typeof draft.connectionStatus === "string"
      ? draft.connectionStatus
      : draft.connectionStatus.code;
  const hasAuth = draft.isGithubConnected;
  const hasRepository = draft.syncRepository !== null;
  const hasBranch = draft.syncBranch !== null;

  return {
    auth: hasAuth ? "complete" : "active",
    repository: !hasAuth ? "disabled" : hasRepository ? "complete" : "active",
    branch: !hasRepository ? "disabled" : hasBranch ? "complete" : "active",
    connection: !hasBranch
      ? "disabled"
      : connectionStatusCode === "connected"
        ? "complete"
        : "active"
  };
}

export function validateSettingsDraft(
  draft: SettingsValidationDraft,
  locale: UiLocale = "en"
): SettingsValidationResult {
  const errors: SettingsValidationResult["errors"] = {};

  if (!draft.isGithubConnected) {
    errors.githubAuth = t(locale, "validation.githubLoginRequired");
  }

  if (draft.syncRepository === null) {
    errors.repository = t(locale, "validation.repositoryRequired");
  }

  if (draft.syncBranch === null) {
    errors.branch = t(locale, "validation.branchRequired");
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function canCleanupRepository(
  state: Pick<
    OptionsRuntimeState,
    "syncRepository" | "syncBranch" | "cleanupRunning"
  >
): boolean {
  return (
    state.syncRepository !== null &&
    state.syncBranch !== null &&
    !state.cleanupRunning
  );
}

export function getRepositoryCleanupMessage(
  result: RepositoryCleanupResult | null,
  error: NormalizedError | null,
  locale: UiLocale = "en"
): InlineMessage {
  if (error !== null) {
    return {
      text: t(locale, "options.cleanup.failed", { detail: error.userMessage }),
      tone: "error"
    };
  }

  if (result?.kind === "committed") {
    return {
      text: t(locale, "options.cleanup.committed"),
      tone: "success"
    };
  }

  if (result?.kind === "no_changes") {
    return {
      text: t(locale, "options.cleanup.noChanges"),
      tone: "neutral"
    };
  }

  return EMPTY_MESSAGE;
}

export function mapConnectionErrorCode(
  code: NormalizedErrorCode
): ConnectionStatusCode {
  switch (code) {
    case "github_no_accessible_repos":
      return "no_accessible_repositories";
    case "github_repo_not_found":
      return "repository_not_found";
    case "github_branch_not_found":
    case "github_default_branch_unavailable":
      return "branch_not_found";
    case "github_branch_create_failed":
    case "github_branch_protected":
    case "github_commit_failed":
    case "github_conflict_failed":
      return "branch_create_failed";
    case "github_auth_failed":
    case "github_app_not_configured":
      return "auth_failed";
    case "github_login_required":
      return "login_required";
    case "github_device_flow_expired":
      return "device_flow_expired";
    case "github_device_flow_denied":
      return "device_flow_denied";
    case "github_token_refresh_failed":
      return "token_refresh_failed";
    case "github_token_expired":
      return "token_expired";
    case "github_rate_limited":
      return "rate_limited";
    case "network_failed":
      return "network_failed";
    case "extension_state_unavailable":
      return "not_tested";
    case "setup_required":
    case "auto_sync_disabled":
    case "unsupported_language":
    case "leetcode_auth_required":
    case "leetcode_fetch_failed":
    case "programmers_extract_failed":
    case "swea_extract_failed":
    case "malformed_index":
      return "branch_create_failed";
  }
}

export function getConnectionStatusView(
  status: ConnectionStatus | ConnectionStatusCode,
  error: NormalizedError | null = null,
  locale: UiLocale = "en"
): ConnectionStatusView {
  return getSharedConnectionStatusView(locale, status, error);
}

export function getDeviceFlowRenderState(
  pendingAuth: PublicPendingGitHubAuth | null
): DeviceFlowRenderState {
  return {
    hidden: pendingAuth === null,
    userCode: pendingAuth?.userCode ?? ""
  };
}

export function getRepositoryListRenderState(
  state: Pick<OptionsRuntimeState, "loadingRepositories" | "repositories">,
  filterState: RepositoryFilterState
): "ready" | "loading" | "empty" | "no-matches" {
  if (state.loadingRepositories) {
    return "loading";
  }

  if (state.repositories.length === 0) {
    return "empty";
  }

  return filterState.hasMatches ? "ready" : "no-matches";
}