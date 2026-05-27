import { describe, expect, it } from "vitest";

import {
  IN_FLIGHT_LOCK_TTL_MS,
  RETRY_PAYLOAD_LIMIT,
  RETRY_PAYLOAD_TTL_MS,
  SYNC_HISTORY_LIMIT,
  createExtensionStorage,
  type StorageAreaAdapter
} from "./storage";
import {
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  type InFlightSyncsState
} from "../shared/storageSchema";
import type {
  BranchRef,
  ProblemMetadata,
  RepositoryRef,
  RetryPayload,
  SubmissionIdentity,
  SyncRecord
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

  it("checks duplicate processed identities without adding duplicate entries", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());
    const identity = makeIdentity("submission-1");

    expect(await storage.isProcessed(identity)).toBe(false);

    await storage.markProcessed(
      identity,
      {
        commitSha: "commit-sha-1",
        solutionPath: "leetcode/swift/0001_two_sum.swift"
      },
      "2026-01-01T00:00:00.000Z"
    );
    await storage.markProcessed(
      identity,
      {
        commitSha: "commit-sha-1",
        solutionPath: "leetcode/swift/0001_two_sum.swift"
      },
      "2026-01-01T00:00:01.000Z"
    );

    expect(await storage.isProcessed(identity)).toBe(true);
    expect(await storage.listProcessedSubmissions()).toHaveLength(1);
  });

  it("keeps only the latest 20 sync history records", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    for (let index = 0; index < SYNC_HISTORY_LIMIT + 5; index += 1) {
      await storage.appendHistory(makeSyncRecord(index));
    }

    const history = await storage.listHistory();

    expect(history).toHaveLength(SYNC_HISTORY_LIMIT);
    expect(history[0]?.id).toBe("record-24");
    expect(history.at(-1)?.id).toBe("record-5");
  });

  it("keeps only the latest 20 retry payloads", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    for (let index = 0; index < RETRY_PAYLOAD_LIMIT + 5; index += 1) {
      const createdAt = addMs("2026-01-01T00:00:00.000Z", index * 1000);
      await storage.saveRetryPayload(makeRetryPayload(`retry-${index}`, createdAt));
    }

    const payloads = await storage.listRetryPayloads();

    expect(payloads).toHaveLength(RETRY_PAYLOAD_LIMIT);
    expect(payloads[0]?.id).toBe("retry-24");
    expect(payloads.at(-1)?.id).toBe("retry-5");
  });

  it("prunes retry payloads after the 7 day TTL", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    await storage.saveRetryPayload(
      makeRetryPayload("expired", "2026-01-01T00:00:00.000Z")
    );
    await storage.saveRetryPayload(
      makeRetryPayload("active", "2026-01-07T00:00:00.000Z")
    );

    const pruned = await storage.pruneRetryPayloads("2026-01-09T00:00:00.000Z");

    expect(pruned.payloads.map((payload) => payload.id)).toEqual(["active"]);
  });

  it("caps retry payload expiry to 7 days from creation", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());

    await storage.saveRetryPayload({
      ...makeRetryPayload("long-expiry", "2026-01-01T00:00:00.000Z"),
      expiresAt: "2026-02-01T00:00:00.000Z"
    });

    const payload = await storage.getRetryPayload("long-expiry");

    expect(payload?.expiresAt).toBe(
      addMs("2026-01-01T00:00:00.000Z", RETRY_PAYLOAD_TTL_MS)
    );
  });

  it("acquires and releases in-flight locks", async () => {
    const storage = createExtensionStorage(createMemoryStorageArea());
    const identity = makeIdentity("submission-1");

    await expect(
      storage.acquireInFlightLock(identity, "2026-01-01T00:00:00.000Z")
    ).resolves.toBe(true);
    await expect(
      storage.acquireInFlightLock(identity, "2026-01-01T00:00:01.000Z")
    ).resolves.toBe(false);

    const released = await storage.releaseInFlightLock(identity);

    expect(released.locks).toHaveLength(0);
    await expect(
      storage.acquireInFlightLock(identity, "2026-01-01T00:00:02.000Z")
    ).resolves.toBe(true);
  });

  it("cleans up stale in-flight locks before acquiring a new lock", async () => {
    const area = createMemoryStorageArea();
    const storage = createExtensionStorage(area);
    const identity = makeIdentity("submission-1");
    const lockedAt = "2026-01-01T00:00:00.000Z";

    await storage.acquireInFlightLock(identity, lockedAt);

    await expect(
      storage.acquireInFlightLock(
        identity,
        addMs(lockedAt, IN_FLIGHT_LOCK_TTL_MS + 1)
      )
    ).resolves.toBe(true);

    const state = area.dump()[STORAGE_KEYS.inFlightSyncs] as InFlightSyncsState;
    expect(state.locks).toHaveLength(1);
    expect(state.locks[0]?.lockedAt).toBe(addMs(lockedAt, IN_FLIGHT_LOCK_TTL_MS + 1));
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

const repository: RepositoryRef = {
  owner: "octo",
  name: "algorithms",
  fullName: "octo/algorithms",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/octo/algorithms"
};

const branch: BranchRef = {
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

function makeIdentity(submissionId: string): SubmissionIdentity {
  return {
    submissionId,
    titleSlug: "two-sum",
    language: "swift"
  };
}

function makeSyncRecord(index: number): SyncRecord {
  const createdAt = addMs("2026-01-01T00:00:00.000Z", index * 1000);

  return {
    id: `record-${index}`,
    status: "synced",
    titleSlug: "two-sum",
    problemTitle: "Two Sum",
    problemFrontendId: "1",
    language: "Swift",
    supportedLanguage: "swift",
    identity: makeIdentity(`submission-${index}`),
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

function makeRetryPayload(id: string, createdAt: string): RetryPayload {
  return {
    id,
    identity: makeIdentity(id),
    repository,
    branch,
    problem,
    submission: {
      submissionId: id,
      titleSlug: "two-sum",
      language: "Swift",
      code: "class Solution {}",
      acceptedAt: createdAt
    },
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    readmePath: "leetcode/README.md",
    indexPath: "leetcode/.leetcode-sync/index.json",
    commitMessage: "solve: leetcode 0001 two sum in swift",
    attempts: 0,
    createdAt,
    expiresAt: addMs(createdAt, RETRY_PAYLOAD_TTL_MS),
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
