import { describe, expect, it } from "vitest";

import {
  SYNC_DEDUPLICATION_KEY_LOCK_TTL_MS,
  RETRY_BUNDLE_LIMIT,
  RETRY_BUNDLE_TTL_MS,
  SYNC_HISTORY_LIMIT,
  createExtensionStorage,
  type StorageAreaAdapter
} from "./storage";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  type SyncDeduplicationKeyLocksState
} from "../shared/storageSchema";
import type {
  ProblemMetadata,
  RetryBundle,
  SyncBranch,
  SyncDeduplicationKey,
  SyncHistoryEntry,
  SyncRepository
} from "../shared/types";

describe("background extension storage", () => {
  it("reads and writes settings while preserving the storage version", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    const initial = await storage.getSettings();
    expect(initial.version).toBe(STORAGE_SCHEMA_VERSION);
    expect(initial.autoSyncEnabled).toBe(false);

    const saved = await storage.saveSettings(
      {
        githubPat: "placeholder-value",
        autoSyncEnabled: true
      },
      "2026-01-01T00:00:00.000Z"
    );

    expect(saved.version).toBe(STORAGE_SCHEMA_VERSION);
    expect(saved.autoSyncEnabled).toBe(true);
    expect(saved.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("checks duplicate processed Sync Deduplication Keys without adding duplicate entries", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());
    const syncDeduplicationKey = makeSyncDeduplicationKey("source-1");

    expect(await storage.hasProcessedSyncDeduplicationKey(syncDeduplicationKey)).toBe(false);

    await storage.markSyncDeduplicationKeyProcessed(
      syncDeduplicationKey,
      {
        commitSha: "commit-sha-1",
        solutionPath: "leetcode/swift/0001_two_sum.swift"
      },
      "2026-01-01T00:00:00.000Z"
    );
    await storage.markSyncDeduplicationKeyProcessed(
      syncDeduplicationKey,
      {
        commitSha: "commit-sha-1",
        solutionPath: "leetcode/swift/0001_two_sum.swift"
      },
      "2026-01-01T00:00:01.000Z"
    );

    expect(await storage.hasProcessedSyncDeduplicationKey(syncDeduplicationKey)).toBe(true);
    expect(await storage.listProcessedSyncDeduplicationKeys()).toHaveLength(1);
  });

  it("migrates legacy processed identities before duplicate checks", async () => {
    const area = createMemoryStorageArea({
      [LEGACY_STORAGE_KEYS.processedSubmissions]: {
        version: 1,
        entries: [
          {
            identity: {
              submissionId: "submission-1",
              titleSlug: "two-sum",
              language: "swift"
            },
            processedAt: "2026-01-01T00:00:00.000Z",
            commitSha: "commit-sha-1",
            solutionPath: "leetcode/swift/0001_two_sum.swift"
          }
        ]
      }
    });
    const storage = createExtensionStorage(area);

    expect(await storage.hasProcessedSyncDeduplicationKey(makeSyncDeduplicationKey("submission-1"))).toBe(true);
    await expect(storage.listProcessedSyncDeduplicationKeys()).resolves.toEqual([
      {
        syncDeduplicationKey: makeSyncDeduplicationKey("submission-1"),
        processedAt: "2026-01-01T00:00:00.000Z",
        commitSha: "commit-sha-1",
        solutionPath: "leetcode/swift/0001_two_sum.swift"
      }
    ]);
  });

  it("keeps only the latest 20 sync history entries", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    for (let index = 0; index < SYNC_HISTORY_LIMIT + 5; index += 1) {
      await storage.appendSyncHistoryEntry(makeSyncRecord(index));
    }

    const history = await storage.listSyncHistoryEntries();

    expect(history).toHaveLength(SYNC_HISTORY_LIMIT);
    expect(history[0]?.id).toBe("record-24");
    expect(history.at(-1)?.id).toBe("record-5");
  });

  it("keeps only the latest 20 retry bundles", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    for (let index = 0; index < RETRY_BUNDLE_LIMIT + 5; index += 1) {
      const createdAt = addMs("2026-01-01T00:00:00.000Z", index * 1000);
      await storage.saveRetryBundle(makeRetryBundle(`retry-${index}`, createdAt));
    }

    const bundles = await storage.listRetryBundles();

    expect(bundles).toHaveLength(RETRY_BUNDLE_LIMIT);
    expect(bundles[0]?.id).toBe("retry-24");
    expect(bundles.at(-1)?.id).toBe("retry-5");
  });

  it("prunes retry bundles after the 7 day TTL", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    await storage.saveRetryBundle(
      makeRetryBundle("expired", "2026-01-01T00:00:00.000Z")
    );
    await storage.saveRetryBundle(
      makeRetryBundle("active", "2026-01-07T00:00:00.000Z")
    );

    const pruned = await storage.pruneRetryBundles("2026-01-09T00:00:00.000Z");

    expect(pruned.bundles.map((bundle) => bundle.id)).toEqual(["active"]);
  });

  it("caps retry bundle expiry to 7 days from creation", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    await storage.saveRetryBundle({
      ...makeRetryBundle("long-expiry", "2026-01-01T00:00:00.000Z"),
      expiresAt: "2026-02-01T00:00:00.000Z"
    });

    const bundle = await storage.getRetryBundle("long-expiry");

    expect(bundle?.expiresAt).toBe(
      addMs("2026-01-01T00:00:00.000Z", RETRY_BUNDLE_TTL_MS)
    );
  });

  it("acquires and releases Sync Deduplication Key locks", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());
    const syncDeduplicationKey = makeSyncDeduplicationKey("source-1");

    await expect(
      storage.acquireSyncDeduplicationKeyLock(syncDeduplicationKey, "2026-01-01T00:00:00.000Z")
    ).resolves.toBe(true);
    await expect(
      storage.acquireSyncDeduplicationKeyLock(syncDeduplicationKey, "2026-01-01T00:00:01.000Z")
    ).resolves.toBe(false);

    const released = await storage.releaseSyncDeduplicationKeyLock(syncDeduplicationKey);

    expect(released.locks).toHaveLength(0);
    await expect(
      storage.acquireSyncDeduplicationKeyLock(syncDeduplicationKey, "2026-01-01T00:00:02.000Z")
    ).resolves.toBe(true);
  });

  it("cleans up stale Sync Deduplication Key locks before acquiring a new lock", async () => {
    const area = createMemoryStorageArea();
    const storage = createExtensionStorage(area);
    const syncDeduplicationKey = makeSyncDeduplicationKey("source-1");
    const lockedAt = "2026-01-01T00:00:00.000Z";

    await storage.acquireSyncDeduplicationKeyLock(syncDeduplicationKey, lockedAt);

    await expect(
      storage.acquireSyncDeduplicationKeyLock(
        syncDeduplicationKey,
        addMs(lockedAt, SYNC_DEDUPLICATION_KEY_LOCK_TTL_MS + 1)
      )
    ).resolves.toBe(true);

    const state = area.dump()[STORAGE_KEYS.syncDeduplicationKeyLocks] as SyncDeduplicationKeyLocksState;
    expect(state.locks).toHaveLength(1);
    expect(state.locks[0]?.lockedAt).toBe(addMs(lockedAt, SYNC_DEDUPLICATION_KEY_LOCK_TTL_MS + 1));
  });
});

interface MemoryStorageArea extends StorageAreaAdapter {
  dump(): Record<string, unknown>;
}

function createMemoryStorageArea(seed: Record<string, unknown> = {}): MemoryStorageArea {
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
    },
    dump() {
      return cloneRecord(data);
    }
  };
}

const repository: SyncRepository = {
  owner: "octo",
  name: "algorithms",
  fullName: "octo/algorithms",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/octo/algorithms"
};

const branch: SyncBranch = {
  name: "main",
  sha: "base-sha",
  protected: false
};

const problem: ProblemMetadata = {
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum",
  difficulty: "Easy",
  url: "https://leetcode.com/problems/two-sum/"
};

function makeSyncDeduplicationKey(acceptedSourceId: string): SyncDeduplicationKey {
  return {
    codingPlatform: "leetcode",
    acceptedSourceId,
    titleSlug: "two-sum",
    language: "swift"
  };
}

function makeSyncRecord(index: number): SyncHistoryEntry {
  const createdAt = addMs("2026-01-01T00:00:00.000Z", index * 1000);

  return {
    id: `record-${index}`,
    codingPlatform: "leetcode",
    status: "synced",
    titleSlug: "two-sum",
    problemTitle: "Two Sum",
    problemFrontendId: "1",
    language: "Swift",
    supportedLanguage: "swift",
    syncDeduplicationKey: makeSyncDeduplicationKey(`source-${index}`),
    repository,
    branchName: "main",
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    commitSha: `commit-sha-${index}`,
    commitUrl: `https://github.com/octo/algorithms/commit/commit-sha-${index}`,
    fileUrl: "https://github.com/octo/algorithms/blob/main/leetcode/swift/0001_two_sum.swift",
    error: null,
    retryPayloadId: null,
    createdAt,
    updatedAt: createdAt
  };
}

function makeRetryBundle(id: string, createdAt: string): RetryBundle {
  return {
    id,
    codingPlatform: "leetcode",
    syncDeduplicationKey: makeSyncDeduplicationKey(id),
    repository,
    branch,
    problem,
    submission: {
      acceptedSourceId: id,
      titleSlug: "two-sum",
      language: "Swift",
      code: "class Solution {}",
      acceptedAt: createdAt
    },
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    solutionReadmePath: "leetcode/README.md",
    solutionCatalogPath: "leetcode/.leetcode-sync/index.json",
    commitMessage: "solve: leetcode 0001 two sum in swift",
    attempts: 0,
    createdAt,
    expiresAt: addMs(createdAt, RETRY_BUNDLE_TTL_MS),
    lastError: null
  };
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return cloneValue(value) as Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
