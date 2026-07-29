import { normalizeError } from "../shared/errorNormalize";
import {
  RETRY_BUNDLES_READ_TYPE,
  SYNC_HISTORY_READ_TYPE,
  SYNC_HISTORY_UPDATED_TYPE,
  isRuntimeMessagePayloadTooLarge,
  normalizeRuntimeMessage,
  type AcceptedDetectedPayload,
  type RuntimeMessage,
  type RuntimeMessageType
} from "../shared/messages";
import {
  toPublicSettingsState,
  type ConnectionStatusCode,
  type PublicSettingsUpdate
} from "../shared/storageSchema";
import type { NormalizedError, NormalizedErrorCode } from "../shared/errors";
import type { SyncRepository, RetryBundle, RetryBundleSummary } from "../shared/types";
import {
  GITHUB_APP_CLIENT_ID,
  getGitHubAppInstallationUrl
} from "../shared/githubAppConfig";
import { createDefaultExtensionStorage, type ExtensionStorage } from "./storage";
import { createGitHubClient, type GitHubClient } from "./client/github";
import {
  createGitHubAuthManager,
  createPendingGitHubAuthStorage,
  type GitHubAuthManager
} from "./auth";
import { createLeetCodeClient } from "./client/leetcode";
import {
  createSyncOrchestrator,
  type SyncBroadcast,
  type SyncBroadcastTarget,
  type SyncOrchestrator
} from "./sync";

export interface RuntimeSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface RuntimeFailureResponse {
  ok: false;
  error: NormalizedError;
}

export type RuntimeResponse<T = unknown> =
  | RuntimeSuccessResponse<T>
  | RuntimeFailureResponse;

export interface BackgroundRuntimeOptions {
  storage?: ExtensionStorage;
  orchestrator?: SyncOrchestrator;
  authManager?: GitHubAuthManager;
  githubClientFactory?: () => GitHubClient;
  broadcast?: SyncBroadcast;
  ready?: Promise<void>;
}

export function registerBackgroundRuntime(options: BackgroundRuntimeOptions = {}): void {
  const storage = options.storage ?? createDefaultExtensionStorage();
  const broadcast = options.broadcast ?? createChromeBroadcast();
  const authManager =
    options.authManager ??
    createGitHubAuthManager({
      clientId: GITHUB_APP_CLIENT_ID,
      storage,
      pendingStorage: createPendingGitHubAuthStorage(chrome.storage.session)
    });
  const githubClientFactory =
    options.githubClientFactory ??
    (() => createGitHubClient({ credentialProvider: authManager }));
  const orchestrator =
    options.orchestrator ??
    createSyncOrchestrator({
      storage,
      leetcode: createLeetCodeClient(),
      githubClientFactory,
      broadcast
    });
  const ready = options.ready ?? Promise.resolve();

  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    void ready
      .then(async () => {
        const message = normalizeRuntimeMessage(rawMessage);

        if (message === null) {
          const code = isRuntimeMessagePayloadTooLarge(rawMessage)
            ? "payload_too_large"
            : "invalid_message";
          return failure(explicitError(code, "Invalid runtime message."));
        }

        if (!isMessageAllowedFromSender(message, sender)) {
          return failure(
            explicitError(
              "invalid_message",
              "Runtime message is not allowed from this sender."
            )
          );
        }

        return handleRuntimeMessage(message, sender, {
          storage,
          orchestrator,
          githubClientFactory,
          authManager
        });
      })
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse(failure(normalizeError(error))));

    return true;
  });
}

async function handleRuntimeMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  context: {
    storage: ExtensionStorage;
    orchestrator: SyncOrchestrator;
    githubClientFactory: () => GitHubClient;
    authManager: GitHubAuthManager;
  }
): Promise<RuntimeResponse> {
  switch (message.type) {
    case "scaffold:ready":
      return success({ surface: message.surface });

    case "content:accepted_detected":
      return success(
        await context.orchestrator.handleAcceptedDetected(message.payload, {
          tabId: sender.tab?.id
        })
      );

    case "content:toast_action":
      return success(
        await handleToastAction(message.payload, context.storage, context.orchestrator, {
          tabId: sender.tab?.id
        })
      );

    case "settings:read": {
      const settings = await context.storage.getSettings();
      const githubAuth = await context.storage.getGitHubAuth();
      return success(toPublicSettingsState(settings, githubAuth));
    }

    case "ui:locale:read": {
      const settings = await context.storage.getSettings();
      return success({
        uiLanguage: settings.uiLanguage
      });
    }

    case "settings:write": {
      const settings = await context.storage.saveSettings(message.payload.update);
      const githubAuth = await context.storage.getGitHubAuth();
      return success(toPublicSettingsState(settings, githubAuth));
    }

    case "github:auth:start":
      return success(await context.authManager.start());

    case "github:auth:read":
      return success(await context.authManager.readPending());

    case "github:auth:poll":
      return success(await context.authManager.poll());

    case "github:auth:disconnect":
      await context.authManager.disconnect();
      return success(null);

    case "github:installation:open": {
      const installationUrl = getGitHubAppInstallationUrl();

      if (installationUrl === null) {
        throw explicitError(
          "github_auth_failed",
          "GitHub App slug is not configured."
        );
      }

      await chrome.tabs.create({ url: installationUrl });
      return success(null);
    }

    case "github:repositories:list":
      return success(
        await withGitHubClient(context.githubClientFactory, async (client) => {
          const repositories = await client.listRepositories();
          const filtered = filterRepositories(repositories, message.payload.query);
          const page = Math.max(1, message.payload.page);
          const perPage = Math.max(1, message.payload.perPage);
          const start = (page - 1) * perPage;

          return {
            repositories: filtered.slice(start, start + perPage),
            page,
            perPage,
            totalCount: filtered.length,
            hasMore: start + perPage < filtered.length
          };
        })
      );

    case "github:branches:list":
      return success(
        await withGitHubClient(context.githubClientFactory, (client) =>
          client.listBranches({
            owner: message.payload.repository.owner,
            name: message.payload.repository.name
          })
        )
      );

    case "github:branch:create":
      return success(
        await withGitHubClient(context.githubClientFactory, async (client) => {
          try {
            const branch = await client.createBranch({
              owner: message.payload.repository.owner,
              name: message.payload.repository.name,
              branchName: message.payload.branchName
            });
            await context.storage.saveSettings({
              connectionStatus: {
                code: "branch_created",
                checkedAt: new Date().toISOString(),
                error: null
              }
            });

            return branch;
          } catch (error) {
            const normalized = normalizeError(error);
            await saveConnectionFailure(context.storage, normalized);
            throw normalized;
          }
        })
      );

    case "github:connection:test":
      return success(
        await withGitHubClient(context.githubClientFactory, async (client) => {
          try {
            const result = await client.testConnection({
              owner: message.payload.repository.owner,
              name: message.payload.repository.name,
              branchName: message.payload.branchName
            });
            await context.storage.saveSettings({
              connectionStatus: {
                code: "connected",
                checkedAt: new Date().toISOString(),
                error: null
              }
            });

            return result;
          } catch (error) {
            const normalized = normalizeError(error);
            await saveConnectionFailure(context.storage, normalized);
            throw normalized;
          }
        })
      );

    case "sync:retry":
      return success(await context.orchestrator.handleRetry(message.payload.retryBundleId));

    case SYNC_HISTORY_READ_TYPE: {
      const syncHistoryEntries = await context.storage.listSyncHistoryEntries();
      const limit = Math.max(0, message.payload.limit);

      return success(syncHistoryEntries.slice(0, limit));
    }

    case RETRY_BUNDLES_READ_TYPE: {
      const state = await context.storage.pruneRetryBundles(new Date().toISOString());

      return success(state.bundles.map(toRetryBundleSummary));
    }

    case "storage:retry-bundles:clear":
      return success({
        deletedCount: await context.storage.clearRetryBundles()
      });

    case "storage:clear-all":
      await context.authManager.disconnect();
      await context.storage.clearAllLocalData();
      return success({ cleared: true });

    case "sync:status":
    case SYNC_HISTORY_UPDATED_TYPE:
      return success(null);
  }
}

type RuntimeSenderSurface = "content" | "options" | "popup" | "background" | "unknown";

const ALLOWED_SENDER_SURFACES: Record<
  RuntimeMessageType,
  readonly RuntimeSenderSurface[]
> = {
  "scaffold:ready": ["content", "options", "popup", "background"],
  "content:accepted_detected": ["content"],
  "content:toast_action": ["content"],
  "settings:read": ["options", "popup"],
  "ui:locale:read": ["content"],
  "settings:write": ["options", "popup"],
  "github:auth:start": ["options"],
  "github:auth:read": ["options"],
  "github:auth:poll": ["options"],
  "github:auth:disconnect": ["options"],
  "github:installation:open": ["options"],
  "github:repositories:list": ["options"],
  "github:branches:list": ["options"],
  "github:branch:create": ["options"],
  "github:connection:test": ["options"],
  "sync:retry": ["popup"],
  [SYNC_HISTORY_READ_TYPE]: ["popup"],
  [RETRY_BUNDLES_READ_TYPE]: ["popup"],
  "storage:retry-bundles:clear": ["options"],
  "storage:clear-all": ["options"],
  "sync:status": ["background"],
  [SYNC_HISTORY_UPDATED_TYPE]: ["background"]
};

function isMessageAllowedFromSender(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): boolean {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  const surface = classifyRuntimeSender(sender);

  if (!ALLOWED_SENDER_SURFACES[message.type].includes(surface)) {
    return false;
  }

  if (message.type === "scaffold:ready" && message.surface !== surface) {
    return false;
  }

  if (
    message.type === "settings:write" &&
    surface === "popup" &&
    !isPopupSettingsUpdate(message.payload.update)
  ) {
    return false;
  }

  return message.type !== "content:accepted_detected" ||
    isAcceptedPayloadConsistentWithSender(message.payload, sender);
}

function isPopupSettingsUpdate(update: PublicSettingsUpdate): boolean {
  return (
    Object.keys(update).length === 1 &&
    typeof update.autoSyncEnabled === "boolean"
  );
}

function classifyRuntimeSender(
  sender: chrome.runtime.MessageSender
): RuntimeSenderSurface {
  const senderUrl = sender.url ?? sender.tab?.url;

  if (senderUrl === undefined) {
    return "unknown";
  }

  try {
    const url = new URL(senderUrl);
    if (url.protocol === "chrome-extension:") {
      if (url.pathname.endsWith("/options/index.html")) {
        return "options";
      }

      if (url.pathname.endsWith("/popup/index.html")) {
        return "popup";
      }

      if (url.pathname.endsWith("/background/index.js")) {
        return "background";
      }
    }
  } catch {
    return "unknown";
  }

  return sender.tab !== undefined && isSupportedContentUrl(senderUrl)
    ? "content"
    : "unknown";
}

function isAcceptedPayloadConsistentWithSender(
  payload: AcceptedDetectedPayload,
  sender: chrome.runtime.MessageSender
): boolean {
  const senderUrl = parseUrl(sender.url ?? sender.tab?.url);
  const pageUrl = parseUrl(payload.pageUrl);

  if (senderUrl === null || pageUrl === null || senderUrl.origin !== pageUrl.origin) {
    return false;
  }

  if (payload.codingPlatform === "leetcode") {
    return (
      senderUrl.hostname === "leetcode.com" &&
      pageUrl.hostname === "leetcode.com" &&
      readLeetCodeTitleSlug(senderUrl.pathname) === payload.titleSlug &&
      readLeetCodeTitleSlug(pageUrl.pathname) === payload.titleSlug
    );
  }

  const senderRoute = readProgrammersRoute(senderUrl);
  const pageRoute = readProgrammersRoute(pageUrl);

  return (
    senderRoute !== null &&
    pageRoute !== null &&
    senderRoute.courseId === payload.courseId &&
    senderRoute.lessonId === payload.lessonId &&
    pageRoute.courseId === payload.courseId &&
    pageRoute.lessonId === payload.lessonId
  );
}

function isSupportedContentUrl(value: string | undefined): boolean {
  const url = parseUrl(value);

  return (
    url !== null &&
    ((url.hostname === "leetcode.com" && readLeetCodeTitleSlug(url.pathname) !== null) ||
      (url.hostname === "school.programmers.co.kr" &&
        readProgrammersRoute(url) !== null))
  );
}

function readLeetCodeTitleSlug(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([^/?#]+)/u);
  return match?.[1] === undefined ? null : safeDecodeURIComponent(match[1]);
}

function readProgrammersRoute(
  url: URL
): { courseId: string; lessonId: string } | null {
  if (url.hostname !== "school.programmers.co.kr") {
    return null;
  }

  const match = url.pathname.match(
    /^\/learn\/courses\/([^/?#]+)\/lessons\/([^/?#]+)/u
  );

  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }

  return {
    courseId: safeDecodeURIComponent(match[1]),
    lessonId: safeDecodeURIComponent(match[2])
  };
}

function parseUrl(value: string | undefined): URL | null {
  if (value === undefined) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

async function withGitHubClient<T>(
  githubClientFactory: () => GitHubClient,
  operation: (client: GitHubClient) => Promise<T>
): Promise<T> {
  return operation(githubClientFactory());
}

async function handleToastAction(
  payload: Extract<RuntimeMessage, { type: "content:toast_action" }>["payload"],
  storage: ExtensionStorage,
  orchestrator: SyncOrchestrator,
  target: SyncBroadcastTarget
): Promise<null> {
  if (payload.action === "open_options") {
    await chrome.runtime.openOptionsPage();
    return null;
  }

  if (payload.action === "retry") {
    const retryBundleId =
      payload.retryBundleId ??
      (await findRetryBundleIdForToastAction(payload.syncHistoryEntryId, storage));

    if (retryBundleId === null) {
      return null;
    }

    await orchestrator.handleRetry(retryBundleId, target);

    return null;
  }

  if (payload.action !== "open_commit" && payload.action !== "open_file") {
    return null;
  }

  if (payload.syncHistoryEntryId === null) {
    return null;
  }

  const syncHistoryEntry = (await storage.listSyncHistoryEntries()).find(
    (item) => item.id === payload.syncHistoryEntryId
  );
  const url =
    payload.action === "open_commit"
      ? syncHistoryEntry?.commitUrl
      : syncHistoryEntry?.fileUrl;

  if (url !== undefined && url !== null) {
    await chrome.tabs.create({ url });
  }

  return null;
}

async function findRetryBundleIdForToastAction(
  syncHistoryEntryId: string | null,
  storage: ExtensionStorage
): Promise<string | null> {
  if (syncHistoryEntryId === null) {
    return null;
  }

  const syncHistoryEntry = (await storage.listSyncHistoryEntries()).find(
    (item) => item.id === syncHistoryEntryId
  );

  return syncHistoryEntry?.retryBundleId ?? null;
}

function createChromeBroadcast(): SyncBroadcast {
  return async (message, target) => {
    await sendRuntimeMessage(message);

    if (target?.tabId !== undefined && chrome.tabs?.sendMessage !== undefined) {
      await sendTabMessage(target.tabId, message);
    }
  };
}

function sendRuntimeMessage(message: RuntimeMessage): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

function sendTabMessage(tabId: number, message: RuntimeMessage): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

function filterRepositories(
  repositories: SyncRepository[],
  query: string | null
): SyncRepository[] {
  const normalized = query?.trim().toLowerCase();

  if (normalized === undefined || normalized.length === 0) {
    return repositories;
  }

  return repositories.filter((repository) =>
    repository.fullName.toLowerCase().includes(normalized)
  );
}

function toRetryBundleSummary(bundle: RetryBundle): RetryBundleSummary {
  return {
    id: bundle.id,
    codingPlatform: bundle.codingPlatform,
    syncDeduplicationKey: bundle.syncDeduplicationKey,
    attempts: bundle.attempts,
    expiresAt: bundle.expiresAt,
    lastError: bundle.lastError
  };
}

async function saveConnectionFailure(
  storage: ExtensionStorage,
  error: NormalizedError
): Promise<void> {
  await storage.saveSettings({
    connectionStatus: {
      code: toConnectionStatusCode(error.code),
      checkedAt: new Date().toISOString(),
      error
    }
  });
}

function toConnectionStatusCode(code: NormalizedErrorCode): ConnectionStatusCode {
  switch (code) {
    case "github_no_accessible_repos":
      return "no_accessible_repositories";
    case "github_repo_not_found":
      return "repository_not_found";
    case "github_branch_not_found":
    case "github_default_branch_unavailable":
      return "branch_not_found";
    case "github_branch_create_failed":
      return "branch_create_failed";
    case "github_auth_failed":
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
    default:
      return "branch_create_failed";
  }
}

function success<T>(data: T): RuntimeSuccessResponse<T> {
  return {
    ok: true,
    data
  };
}

function failure(error: NormalizedError): RuntimeFailureResponse {
  return {
    ok: false,
    error
  };
}

function explicitError(code: NormalizedErrorCode, message: string): NormalizedError {
  return normalizeError({
    code,
    message
  });
}
