import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS_STATE,
  EMPTY_PROCESSED_SYNC_DEDUPLICATION_KEYS_STATE,
  EMPTY_RETRY_BUNDLES_STATE,
  EMPTY_SYNC_DEDUPLICATION_KEY_LOCKS_STATE,
  EMPTY_SYNC_HISTORY_STATE,
  STORAGE_SCHEMA_VERSION,
  isSettingsState,
  isVersionedStorageState,
  parseProcessedSyncDeduplicationKeysState,
  parseRetryBundlesState,
  parseSettingsState,
  parseSyncDeduplicationKeyLocksState,
  parseSyncHistoryState,
  toPublicSettingsState
} from "./storageSchema";

const legacyStorageVersions = [1, 2, 3] as const;

describe("storage schema contracts", () => {
  it("keeps every top-level storage state versioned", () => {
    const states = [
      DEFAULT_SETTINGS_STATE,
      EMPTY_PROCESSED_SYNC_DEDUPLICATION_KEYS_STATE,
      EMPTY_SYNC_HISTORY_STATE,
      EMPTY_RETRY_BUNDLES_STATE,
      EMPTY_SYNC_DEDUPLICATION_KEY_LOCKS_STATE
    ];

    expect(states.every((state) => state.version === STORAGE_SCHEMA_VERSION)).toBe(true);
    expect(states.every(isVersionedStorageState)).toBe(true);
  });

  it("keeps the stored PAT out of public settings", () => {
    const publicSettings = toPublicSettingsState({
      ...DEFAULT_SETTINGS_STATE,
      githubPat: "redacted-local-value"
    });

    expect(publicSettings.hasGithubPat).toBe(true);
    expect(publicSettings.uiLanguage).toBe("system");
    expect("githubPat" in publicSettings).toBe(false);
  });

  it("guards the settings state shape", () => {
    expect(isSettingsState(DEFAULT_SETTINGS_STATE)).toBe(true);
    expect(isSettingsState({ ...DEFAULT_SETTINGS_STATE, version: 999 })).toBe(false);
  });

  it("migrates v1-v3 settings to Sync Repository and Sync Branch fields", () => {
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
    const baseSettings = {
      githubPat: null,
      selectedRepository: repository,
      selectedBranch: branch,
      autoSyncEnabled: true,
      connectionStatus: {
        code: "not_tested",
        checkedAt: null,
        error: null
      },
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    for (const version of legacyStorageVersions) {
      expect(
        parseSettingsState({
          version,
          ...baseSettings
        })
      ).toMatchObject({
        version: STORAGE_SCHEMA_VERSION,
        syncRepository: repository,
        syncBranch: branch,
        autoSyncEnabled: true,
        uiLanguage: "system"
      });
    }
  });

  it("normalizes invalid UI language preferences without discarding settings", () => {
    const parsed = parseSettingsState({
      ...DEFAULT_SETTINGS_STATE,
      uiLanguage: "fr"
    });

    expect(parsed).toMatchObject({
      version: STORAGE_SCHEMA_VERSION,
      uiLanguage: "system"
    });
  });

  it("migrates v1-v3 processed entries to Sync Deduplication Keys", () => {
    for (const version of legacyStorageVersions) {
      const migrated = parseProcessedSyncDeduplicationKeysState({
        version,
        entries: [
          {
            identity: {
              submissionId: "123",
              titleSlug: "two-sum",
              language: "swift"
            },
            processedAt: "2026-01-01T00:00:00.000Z",
            commitSha: "commit-sha",
            solutionPath: "leetcode/swift/0001_two_sum.swift"
          }
        ]
      });

      expect(migrated).toEqual({
        version: STORAGE_SCHEMA_VERSION,
        entries: [
          {
            syncDeduplicationKey: {
              codingPlatform: "leetcode",
              acceptedSourceId: "123",
              titleSlug: "two-sum",
              language: "swift"
            },
            processedAt: "2026-01-01T00:00:00.000Z",
            commitSha: "commit-sha",
            solutionPath: "leetcode/swift/0001_two_sum.swift"
          }
        ]
      });
    }
  });

  it("migrates v1-v3 history records to Sync History entries", () => {
    for (const version of legacyStorageVersions) {
      const migrated = parseSyncHistoryState({
        version,
        records: [
          {
            id: "record-1",
            status: "synced",
            titleSlug: "two-sum",
            problemTitle: "Two Sum",
            problemFrontendId: "1",
            language: "Swift",
            supportedLanguage: "swift",
            identity: {
              submissionId: "123",
              titleSlug: "two-sum",
              language: "swift"
            },
            repository: null,
            branchName: null,
            solutionPath: "leetcode/swift/0001_two_sum.swift",
            commitSha: "commit-sha",
            commitUrl: null,
            fileUrl: null,
            error: null,
            retryPayloadId: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ]
      });

      expect(migrated?.entries[0]).toMatchObject({
        codingPlatform: "leetcode",
        syncDeduplicationKey: {
          codingPlatform: "leetcode",
          acceptedSourceId: "123"
        }
      });
    }
  });

  it("migrates v1-v3 Retry Bundle inputs and lock entries to v4 fields", () => {
    const legacyIdentity = {
      submissionId: "123",
      titleSlug: "two-sum",
      language: "swift"
    };
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
    const problem = {
      problemId: "1",
      frontendId: "1",
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/"
    };
    const submission = {
      submissionId: "123",
      titleSlug: "two-sum",
      language: "Swift",
      code: "class Solution {}",
      acceptedAt: "2026-01-01T00:00:00.000Z"
    };

    for (const version of legacyStorageVersions) {
      expect(
        parseRetryBundlesState({
          version,
          payloads: [
            {
              id: "retry-1",
              identity: legacyIdentity,
              repository,
              branch,
              problem,
              submission,
              solutionPath: "leetcode/swift/0001_two_sum.swift",
              readmePath: "leetcode/README.md",
              indexPath: "leetcode/.leetcode-sync/index.json",
              commitMessage: "solve: leetcode 0001 two sum in swift",
              attempts: 0,
              createdAt: "2026-01-01T00:00:00.000Z",
              expiresAt: "2026-01-08T00:00:00.000Z",
              lastError: null
            }
          ]
        })?.bundles[0]
      ).toMatchObject({
        codingPlatform: "leetcode",
        syncDeduplicationKey: {
          codingPlatform: "leetcode",
          acceptedSourceId: "123"
        },
        submission: {
          acceptedSourceId: "123"
        },
        solutionReadmePath: "leetcode/README.md",
        solutionCatalogPath: "leetcode/.leetcode-sync/index.json"
      });

      expect(
        parseSyncDeduplicationKeyLocksState({
          version,
          locks: [
            {
              identity: legacyIdentity,
              lockedAt: "2026-01-01T00:00:00.000Z",
              expiresAt: "2026-01-01T00:10:00.000Z"
            }
          ]
        })?.locks[0]?.syncDeduplicationKey
      ).toEqual({
        codingPlatform: "leetcode",
        acceptedSourceId: "123",
        titleSlug: "two-sum",
        language: "swift"
      });
    }
  });
});
