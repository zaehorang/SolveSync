import { afterEach, describe, expect, it, vi } from "vitest";

import { createExtensionStorage, type StorageAreaAdapter } from "./storage";
import { registerBackgroundRuntime } from "./runtime";
import {
  createGitHubAuthManager,
  createPendingGitHubAuthStorage,
  type GitHubAuthManager
} from "./auth";
import type { SyncOrchestrator } from "./sync";
import type { RetryBundle, SyncHistoryEntry } from "../shared/types";
import { STORAGE_SCHEMA_VERSION } from "../shared/storageSchema";

describe("background runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers a top-level listener and returns public settings", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    const response = await dispatchMessage(chromeMock.listener, {
      type: "settings:read"
    });

    expect(response).toMatchObject({
      ok: true,
      data: {
        isGithubConnected: false,
        githubAccount: null
      }
    });
  });

  it("keeps repository settings when GitHub is disconnected and reconnected", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();
    const repository = {
      owner: "octo",
      name: "algorithms",
      fullName: "octo/algorithms",
      defaultBranch: "main",
      private: true,
      htmlUrl: "https://github.com/octo/algorithms"
    };
    const branch = {
      name: "main",
      sha: "branch-sha",
      protected: false
    };
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          device_code: "device-code",
          user_code: "ABCD-1234",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "new-access-token",
          expires_in: 28_800,
          refresh_token: "new-refresh-token",
          refresh_token_expires_in: 15_552_000,
          token_type: "bearer"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 2,
          login: "octo-reconnected",
          avatar_url: null
        })
      );
    const authManager = createGitHubAuthManager({
      clientId: "client-id",
      storage,
      pendingStorage: createPendingGitHubAuthStorage(
        createMemoryStorageArea()
      ),
      fetchImpl: authFetch,
      now: () => new Date("2026-01-01T00:00:00.000Z")
    });

    await storage.saveSettings({
      syncRepository: repository,
      syncBranch: branch,
      autoSyncEnabled: true
    });
    await storage.saveGitHubAuth({
      version: STORAGE_SCHEMA_VERSION,
      accessToken: "old-access-token",
      accessTokenExpiresAt: "2026-01-01T08:00:00.000Z",
      refreshToken: "old-refresh-token",
      refreshTokenExpiresAt: "2026-07-01T00:00:00.000Z",
      tokenType: "bearer",
      account: {
        id: 1,
        login: "octo",
        avatarUrl: null
      },
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    registerBackgroundRuntime({
      storage,
      orchestrator,
      authManager,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await dispatchMessage(chromeMock.listener, {
      type: "github:auth:disconnect"
    });
    expect(await dispatchMessage(chromeMock.listener, {
      type: "settings:read"
    })).toMatchObject({
      ok: true,
      data: {
        isGithubConnected: false,
        syncRepository: repository,
        syncBranch: branch
      }
    });

    await dispatchMessage(chromeMock.listener, {
      type: "github:auth:start"
    });
    await dispatchMessage(chromeMock.listener, {
      type: "github:auth:poll"
    });

    expect(await dispatchMessage(chromeMock.listener, {
      type: "settings:read"
    })).toMatchObject({
      ok: true,
      data: {
        isGithubConnected: true,
        githubAccount: {
          login: "octo-reconnected"
        },
        syncRepository: repository,
        syncBranch: branch
      }
    });
  });

  it("routes accepted detected and retry messages to the orchestrator", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await dispatchMessage(
      chromeMock.listener,
      {
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "leetcode",
          titleSlug: "two-sum",
          pageUrl: "https://leetcode.com/problems/two-sum/",
          detectedAt: "2026-01-01T00:00:00.000Z"
        }
      },
      {
        id: "test",
        url: "https://leetcode.com/problems/two-sum/",
        tab: {
          id: 123,
          url: "https://leetcode.com/problems/two-sum/"
        } as chrome.tabs.Tab
      }
    );
    await dispatchMessage(
      chromeMock.listener,
      {
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "programmers",
          courseId: "30",
          lessonId: "120804",
          problemTitle: "두 수의 곱 구하기",
          language: "Swift",
          code: "func solution() -> Int { 1 }",
          pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
          detectedAt: "2026-01-01T00:00:00.000Z"
        }
      },
      {
        id: "test",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
        tab: {
          id: 456,
          url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804"
        } as chrome.tabs.Tab
      }
    );
    await dispatchMessage(chromeMock.listener, {
      type: "sync:retry",
      payload: {
        retryBundleId: "retry-1"
      }
    });

    expect(orchestrator.handleAcceptedDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        titleSlug: "two-sum"
      }),
      {
        tabId: 123
      }
    );
    expect(orchestrator.handleAcceptedDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        codingPlatform: "programmers",
        lessonId: "120804"
      }),
      {
        tabId: 456
      }
    );
    expect(orchestrator.handleRetry).toHaveBeenCalledWith("retry-1");
  });

  it("routes content toast retry actions through the existing toast action flow", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();
    await storage.appendSyncHistoryEntry(makeSyncHistoryEntry({ retryBundleId: "retry-1" }));

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await dispatchMessage(
      chromeMock.listener,
      {
        type: "content:toast_action",
        payload: {
          action: "retry",
          syncHistoryEntryId: null,
          retryBundleId: "retry-1"
        }
      },
      {
        id: "test",
        url: "https://leetcode.com/problems/two-sum/",
        tab: {
          id: 789,
          url: "https://leetcode.com/problems/two-sum/"
        } as chrome.tabs.Tab
      }
    );

    expect(orchestrator.handleRetry).toHaveBeenCalledWith("retry-1", {
      tabId: 789
    });
  });

  it("does not retry a toast failure without a retry bundle", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();
    await storage.appendSyncHistoryEntry(makeSyncHistoryEntry({ retryBundleId: null }));

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await dispatchMessage(chromeMock.listener, {
      type: "content:toast_action",
      payload: {
        action: "retry",
        syncHistoryEntryId: "record-1",
        retryBundleId: null
      }
    });

    expect(orchestrator.handleRetry).not.toHaveBeenCalled();
  });

  it("returns retry bundle summaries without exposing stored solution code", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();
    await storage.saveRetryBundle(makeRetryBundle("retry-1"));

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    const response = await dispatchMessage(chromeMock.listener, {
      type: "retry-bundles:read"
    });

    expect(response).toMatchObject({
      ok: true,
      data: [
        {
          id: "retry-1",
          attempts: 0,
          expiresAt: "2099-01-08T00:00:00.000Z"
        }
      ]
    });
    expect(JSON.stringify(response)).not.toContain("class Solution");
  });

  it("normalizes legacy retry and read aliases at ingress", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();
    await storage.saveRetryBundle(makeRetryBundle("retry-1"));

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    const retryResponse = await dispatchMessage(chromeMock.listener, {
      type: "sync:retry",
      payload: {
        retryPayloadId: "retry-1"
      }
    });
    const retryBundlesResponse = await dispatchMessage(chromeMock.listener, {
      type: "retry-payloads:read"
    });

    expect(retryResponse).toMatchObject({
      ok: true
    });
    expect(orchestrator.handleRetry).toHaveBeenCalledWith("retry-1");
    expect(retryBundlesResponse).toMatchObject({
      ok: true,
      data: [
        {
          id: "retry-1"
        }
      ]
    });
  });

  it("waits for storage access hardening before handling messages", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const getSettings = vi.spyOn(storage, "getSettings");
    const readyControl: { release?: () => void } = {};
    const ready = new Promise<void>((resolve) => {
      readyControl.release = resolve;
    });

    registerBackgroundRuntime({
      storage,
      orchestrator: makeOrchestrator(),
      ready,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    const responsePromise = dispatchMessage(chromeMock.listener, {
      type: "settings:read"
    });
    await Promise.resolve();
    expect(getSettings).not.toHaveBeenCalled();

    readyControl.release?.();
    await expect(responsePromise).resolves.toMatchObject({ ok: true });
    expect(getSettings).toHaveBeenCalledTimes(1);
  });

  it("exposes only locale settings to supported content pages", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    await storage.saveSettings({
      uiLanguage: "ko",
      autoSyncEnabled: true
    });

    registerBackgroundRuntime({
      storage,
      orchestrator: makeOrchestrator(),
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await expect(
      dispatchMessage(
        chromeMock.listener,
        { type: "settings:read" },
        contentSender("https://leetcode.com/problems/two-sum/")
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid_message"
      }
    });
    await expect(
      dispatchMessage(chromeMock.listener, { type: "ui:locale:read" })
    ).resolves.toEqual({
      ok: true,
      data: {
        uiLanguage: "ko"
      }
    });
  });

  it("rejects privileged messages from the wrong surface and mismatched pages", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    const acceptedMessage = {
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "leetcode",
        titleSlug: "two-sum",
        pageUrl: "https://leetcode.com/problems/two-sum/",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    };

    await expect(
      dispatchMessage(
        chromeMock.listener,
        acceptedMessage,
        extensionSender("options")
      )
    ).resolves.toMatchObject({ ok: false });
    await expect(
      dispatchMessage(
        chromeMock.listener,
        acceptedMessage,
        contentSender("https://leetcode.com/problems/three-sum/")
      )
    ).resolves.toMatchObject({ ok: false });
    expect(orchestrator.handleAcceptedDetected).not.toHaveBeenCalled();
  });

  it("limits popup settings writes to the Auto Sync toggle", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());

    registerBackgroundRuntime({
      storage,
      orchestrator: makeOrchestrator(),
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await expect(
      dispatchMessage(
        chromeMock.listener,
        {
          type: "settings:write",
          payload: {
            update: {
              uiLanguage: "ko"
            }
          }
        },
        extensionSender("popup")
      )
    ).resolves.toMatchObject({ ok: false });
    await expect(
      dispatchMessage(
        chromeMock.listener,
        {
          type: "settings:write",
          payload: {
            update: {
              autoSyncEnabled: true
            }
          }
        },
        extensionSender("popup")
      )
    ).resolves.toMatchObject({
      ok: true,
      data: {
        autoSyncEnabled: true
      }
    });
  });

  it("validates extension identity and scaffold surface claims", async () => {
    const chromeMock = installChromeRuntimeMock();

    registerBackgroundRuntime({
      storage: createExtensionStorage(createMemoryStorageArea()),
      orchestrator: makeOrchestrator(),
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await expect(
      dispatchMessage(
        chromeMock.listener,
        {
          type: "scaffold:ready",
          surface: "popup"
        },
        extensionSender("options")
      )
    ).resolves.toMatchObject({ ok: false });
    await expect(
      dispatchMessage(
        chromeMock.listener,
        {
          type: "settings:read"
        },
        {
          ...extensionSender("options"),
          id: "another-extension"
        }
      )
    ).resolves.toMatchObject({ ok: false });
  });

  it("disconnects GitHub including pending auth before clearing all local data", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const clearAllLocalData = vi.spyOn(storage, "clearAllLocalData");
    const authManager = makeAuthManager();

    registerBackgroundRuntime({
      storage,
      orchestrator: makeOrchestrator(),
      authManager,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    await expect(
      dispatchMessage(chromeMock.listener, {
        type: "storage:clear-all"
      })
    ).resolves.toEqual({
      ok: true,
      data: {
        cleared: true
      }
    });
    expect(authManager.disconnect).toHaveBeenCalledTimes(1);
    expect(clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(authManager.disconnect).mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY
    ).toBeLessThan(
      clearAllLocalData.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it("routes oversized Accepted code to orchestration for durable failure history", async () => {
    const chromeMock = installChromeRuntimeMock();
    const storage = createExtensionStorage(createMemoryStorageArea());
    const orchestrator = makeOrchestrator();

    registerBackgroundRuntime({
      storage,
      orchestrator,
      githubClientFactory: () => {
        throw new Error("GitHub client should not be created.");
      }
    });

    const response = await dispatchMessage(chromeMock.listener, {
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "programmers",
        courseId: "30",
        lessonId: "120804",
        problemTitle: "두 수의 곱 구하기",
        language: "Swift",
        code: "a".repeat(256 * 1024 + 1),
        pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });

    expect(response).toMatchObject({ ok: true });
    expect(orchestrator.handleAcceptedDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        codingPlatform: "programmers",
        code: expect.any(String)
      }),
      {
        tabId: 1
      }
    );
  });
});

interface ChromeRuntimeMock {
  listener: MessageListener;
}

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

function installChromeRuntimeMock(): ChromeRuntimeMock {
  let listener: MessageListener | null = null;
  const chromeMock = {
    runtime: {
      id: "test",
      onMessage: {
        addListener: vi.fn((callback: MessageListener) => {
          listener = callback;
        })
      },
      sendMessage: vi.fn(),
      openOptionsPage: vi.fn(),
      lastError: undefined
    },
    tabs: {
      sendMessage: vi.fn(),
      create: vi.fn()
    },
    storage: {
      session: createMemoryStorageArea()
    }
  };

  vi.stubGlobal("chrome", chromeMock);

  return {
    get listener() {
      if (listener === null) {
        throw new Error("Runtime listener was not registered.");
      }

      return listener;
    }
  };
}

function makeOrchestrator(): SyncOrchestrator {
  const duplicateOutcome = {
    kind: "duplicate_in_flight" as const,
    syncDeduplicationKey: {
      codingPlatform: "leetcode" as const,
      acceptedSourceId: "123456789",
      titleSlug: "two-sum",
      language: "swift" as const
    }
  };

  return {
    handleAcceptedDetected: vi.fn(async () => duplicateOutcome),
    handleRetry: vi.fn(async () => duplicateOutcome)
  };
}

function makeAuthManager(): GitHubAuthManager {
  return {
    start: vi.fn(),
    readPending: vi.fn(),
    poll: vi.fn(),
    disconnect: vi.fn(async () => undefined),
    getAccessToken: vi.fn()
  } as unknown as GitHubAuthManager;
}

function makeRetryBundle(id: string): RetryBundle {
  return {
    id,
    codingPlatform: "leetcode",
    syncDeduplicationKey: {
      codingPlatform: "leetcode",
      acceptedSourceId: "123456789",
      titleSlug: "two-sum",
      language: "swift"
    },
    syncRepository: {
      owner: "octo",
      name: "algorithms",
      fullName: "octo/algorithms",
      defaultBranch: "main",
      private: true,
      htmlUrl: "https://github.com/octo/algorithms"
    },
    syncBranch: {
      name: "main",
      sha: "branch-sha",
      protected: false
    },
    problem: {
      problemId: "1",
      frontendId: "1",
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/"
    },
    submission: {
      acceptedSourceId: "123456789",
      titleSlug: "two-sum",
      language: "Swift",
      code: "class Solution {}",
      acceptedAt: "2099-01-01T00:00:00.000Z"
    },
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    solutionReadmePath: "leetcode/README.md",
    solutionCatalogPath: "leetcode/.leetcode-sync/index.json",
    commitMessage: "solve: leetcode 0001 two sum in swift",
    attempts: 0,
    createdAt: "2099-01-01T00:00:00.000Z",
    expiresAt: "2099-01-08T00:00:00.000Z",
    lastError: null
  };
}

function makeSyncHistoryEntry(overrides: Partial<SyncHistoryEntry> = {}): SyncHistoryEntry {
  return {
    id: "record-1",
    codingPlatform: "leetcode",
    status: "failed",
    titleSlug: "two-sum",
    problemTitle: "Two Sum",
    problemFrontendId: "1",
    language: "Swift",
    supportedLanguage: "swift",
    syncDeduplicationKey: {
      codingPlatform: "leetcode",
      acceptedSourceId: "123456789",
      titleSlug: "two-sum",
      language: "swift"
    },
    syncRepository: {
      owner: "octo",
      name: "algorithms",
      fullName: "octo/algorithms",
      defaultBranch: "main",
      private: true,
      htmlUrl: "https://github.com/octo/algorithms"
    },
    syncBranchName: "main",
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    commitSha: null,
    commitUrl: null,
    fileUrl: null,
    error: null,
    retryBundleId: "retry-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

async function dispatchMessage(
  listener: MessageListener,
  message: unknown,
  sender: chrome.runtime.MessageSender = defaultSenderForMessage(message)
): Promise<unknown> {
  return new Promise((resolve) => {
    listener(message, sender, resolve);
  });
}

function defaultSenderForMessage(message: unknown): chrome.runtime.MessageSender {
  if (isMessageWithType(message, "content:accepted_detected")) {
    const pageUrl =
      typeof message.payload === "object" &&
      message.payload !== null &&
      "pageUrl" in message.payload &&
      typeof message.payload.pageUrl === "string"
        ? message.payload.pageUrl
        : "https://leetcode.com/problems/two-sum/";

    return contentSender(pageUrl);
  }

  if (
    isMessageWithType(message, "content:toast_action") ||
    isMessageWithType(message, "ui:locale:read")
  ) {
    return contentSender("https://leetcode.com/problems/two-sum/");
  }

  if (
    isMessageWithType(message, "sync:retry") ||
    isMessageWithType(message, "sync-history:read") ||
    isMessageWithType(message, "history:read") ||
    isMessageWithType(message, "retry-bundles:read") ||
    isMessageWithType(message, "retry-payloads:read")
  ) {
    return extensionSender("popup");
  }

  return extensionSender("options");
}

function isMessageWithType(
  message: unknown,
  type: string
): message is { type: string; payload?: Record<string, unknown> } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === type
  );
}

function contentSender(url: string): chrome.runtime.MessageSender {
  return {
    id: "test",
    url,
    tab: {
      id: 1,
      url
    } as chrome.tabs.Tab
  };
}

function extensionSender(
  surface: "options" | "popup"
): chrome.runtime.MessageSender {
  const url = `chrome-extension://test/${surface}/index.html`;

  return {
    id: "test",
    url,
    ...(surface === "options"
      ? {
          tab: {
            id: 2,
            url
          } as chrome.tabs.Tab
        }
      : {})
  };
}

function createMemoryStorageArea(seed: Record<string, unknown> = {}): StorageAreaAdapter {
  let data = cloneRecord(seed);

  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys === null || keys === undefined) {
        return cloneRecord(data);
      }

      if (typeof keys === "string") {
        return { [keys]: cloneValue(data[keys]) };
      }

      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, cloneValue(data[key])]));
      }

      return {
        ...cloneRecord(keys),
        ...Object.fromEntries(
          Object.keys(keys)
            .filter((key) => key in data)
            .map((key) => [key, cloneValue(data[key])])
        )
      };
    },
    async set(items: Record<string, unknown>) {
      data = {
        ...data,
        ...cloneRecord(items)
      };
    },
    async remove(keys: string | string[]) {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];

      for (const key of keysToRemove) {
        delete data[key];
      }
    }
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
