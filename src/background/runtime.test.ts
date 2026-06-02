import { afterEach, describe, expect, it, vi } from "vitest";

import { createExtensionStorage, type StorageAreaAdapter } from "./storage";
import { registerBackgroundRuntime } from "./runtime";
import type { SyncOrchestrator } from "./sync";
import type { RetryBundle, SyncHistoryEntry } from "../shared/types";

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
        hasGithubPat: false
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
        tab: {
          id: 123
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
        tab: {
          id: 456
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
        tab: {
          id: 789
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
  sender: chrome.runtime.MessageSender = {}
): Promise<unknown> {
  return new Promise((resolve) => {
    listener(message, sender, resolve);
  });
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

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
