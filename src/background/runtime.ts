import { normalizeError } from "../shared/errorNormalize";
import {
  RETRY_BUNDLES_READ_TYPE,
  SYNC_HISTORY_READ_TYPE,
  SYNC_HISTORY_UPDATED_TYPE,
  normalizeRuntimeMessage,
  type RuntimeMessage
} from "../shared/messages";
import { toPublicSettingsState, type ConnectionStatusCode } from "../shared/storageSchema";
import type { NormalizedError, NormalizedErrorCode } from "../shared/errors";
import type { SyncRepository, RetryBundle, RetryBundleSummary } from "../shared/types";
import { createDefaultExtensionStorage, type ExtensionStorage } from "./storage";
import { createGitHubClient, type GitHubClient } from "./client/github";
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
  githubClientFactory?: (pat: string) => GitHubClient;
  broadcast?: SyncBroadcast;
}

export function registerBackgroundRuntime(options: BackgroundRuntimeOptions = {}): void {
  const storage = options.storage ?? createDefaultExtensionStorage();
  const broadcast = options.broadcast ?? createChromeBroadcast();
  const githubClientFactory =
    options.githubClientFactory ?? ((pat: string) => createGitHubClient({ pat }));
  const orchestrator =
    options.orchestrator ??
    createSyncOrchestrator({
      storage,
      leetcode: createLeetCodeClient(),
      githubClientFactory,
      broadcast
    });

  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = normalizeRuntimeMessage(rawMessage);

    if (message === null) {
      sendResponse(failure(explicitError("github_commit_failed", "Invalid runtime message.")));
      return false;
    }

    void handleRuntimeMessage(message, sender, {
      storage,
      orchestrator,
      githubClientFactory
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
    githubClientFactory: (pat: string) => GitHubClient;
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
      return success(toPublicSettingsState(settings));
    }

    case "settings:write": {
      const settings = await context.storage.saveSettings(message.payload.update);
      return success(toPublicSettingsState(settings));
    }

    case "github:repositories:list":
      return success(
        await withGitHubClient(context, async (client) => {
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
        await withGitHubClient(context, (client) =>
          client.listBranches({
            owner: message.payload.repository.owner,
            name: message.payload.repository.name
          })
        )
      );

    case "github:branch:create":
      return success(
        await withGitHubClient(context, async (client) => {
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
        await withGitHubClient(context, async (client) => {
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

    case "sync:status":
    case SYNC_HISTORY_UPDATED_TYPE:
      return success(null);
  }
}

async function withGitHubClient<T>(
  context: {
    storage: ExtensionStorage;
    githubClientFactory: (pat: string) => GitHubClient;
  },
  operation: (client: GitHubClient) => Promise<T>
): Promise<T> {
  const settings = await context.storage.getSettings();

  if (settings.githubPat === null || settings.githubPat.trim().length === 0) {
    throw explicitError("github_auth_failed", "GitHub PAT is required.");
  }

  return operation(context.githubClientFactory(settings.githubPat));
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
    if (payload.recordId === null) {
      return null;
    }

    const record = (await storage.listSyncHistoryEntries()).find((item) => item.id === payload.recordId);

    if (record?.retryBundleId !== null && record?.retryBundleId !== undefined) {
      await orchestrator.handleRetry(record.retryBundleId, target);
    }

    return null;
  }

  if (payload.action !== "open_commit" && payload.action !== "open_file") {
    return null;
  }

  if (payload.recordId === null) {
    return null;
  }

  const record = (await storage.listSyncHistoryEntries()).find((item) => item.id === payload.recordId);
  const url = payload.action === "open_commit" ? record?.commitUrl : record?.fileUrl;

  if (url !== undefined && url !== null) {
    await chrome.tabs.create({ url });
  }

  return null;
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
