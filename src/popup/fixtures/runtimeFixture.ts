import {
  DEFAULT_UI_LANGUAGE,
  RETRY_BUNDLES_READ_TYPE,
  STORAGE_SCHEMA_VERSION,
  SYNC_HISTORY_READ_TYPE,
  SYNC_HISTORY_UPDATED_TYPE,
  t,
  type NormalizedError,
  type PublicSettingsState,
  type RetryBundleSummary,
  type RuntimeMessage,
  type SyncHistoryEntry,
  type SyncRepository
} from "../../shared";
import { buildHistoryDisplayModel, getSetupStatusView } from "../index";

type RuntimeSuccessResponse<T> = {
  ok: true;
  data: T;
};

type RuntimeFailureResponse = {
  ok: false;
  error: NormalizedError;
};

type RuntimeResponse<T> = RuntimeSuccessResponse<T> | RuntimeFailureResponse;
type HistoryItem = ReturnType<typeof buildHistoryDisplayModel>["items"][number];

export interface PopupRuntimeFixture {
  settings: PublicSettingsState;
  syncHistoryEntries: SyncHistoryEntry[];
  retryBundles: RetryBundleSummary[];
  sentMessages: RuntimeMessage[];
  optionPageOpenCount: number;
  install: () => void;
  uninstall: () => void;
  emitSyncHistoryUpdated: (entries: SyncHistoryEntry[]) => void;
}

interface ChromeRuntimeMock {
  lastError?: { message: string };
  openOptionsPage: () => Promise<void>;
  sendMessage: (
    message: RuntimeMessage,
    callback: (response: RuntimeResponse<unknown>) => void
  ) => void;
  onMessage: {
    addListener: (listener: (message: RuntimeMessage) => void) => void;
    removeListener: (listener: (message: RuntimeMessage) => void) => void;
  };
}

export function createPopupRuntimeFixture(): PopupRuntimeFixture {
  let settings = makePopupFixtureSettings();
  let syncHistoryEntries = makePopupFixtureHistoryEntries();
  let retryBundles = makePopupFixtureRetryBundles();
  let optionPageOpenCount = 0;
  const sentMessages: RuntimeMessage[] = [];
  const listeners = new Set<(message: RuntimeMessage) => void>();
  const previousChrome = globalThis.chrome;

  const runtime: ChromeRuntimeMock = {
    openOptionsPage: async () => {
      optionPageOpenCount += 1;
    },
    sendMessage: (message, callback) => {
      sentMessages.push(message);

      if (message.type === "settings:read") {
        callback(ok(settings));
        return;
      }

      if (message.type === SYNC_HISTORY_READ_TYPE) {
        callback(ok(syncHistoryEntries.slice(0, message.payload.limit)));
        return;
      }

      if (message.type === RETRY_BUNDLES_READ_TYPE) {
        callback(ok(retryBundles));
        return;
      }

      if (message.type === "settings:write") {
        settings = {
          ...settings,
          ...message.payload.update,
          updatedAt: "2026-06-08T04:30:00.000Z"
        };
        callback(ok(settings));
        return;
      }

      if (message.type === "sync:retry") {
        retryBundles = retryBundles.filter(
          (bundle) => bundle.id !== message.payload.retryBundleId
        );
        callback(ok(null));
        return;
      }

      callback(
        fail({
          code: "extension_state_unavailable",
          userMessage: "Fixture runtime does not handle this message.",
          debugMessage: message.type,
          retryable: false
        })
      );
    },
    onMessage: {
      addListener: (listener) => {
        listeners.add(listener);
      },
      removeListener: (listener) => {
        listeners.delete(listener);
      }
    }
  };

  return {
    get settings() {
      return settings;
    },
    get syncHistoryEntries() {
      return syncHistoryEntries;
    },
    get retryBundles() {
      return retryBundles;
    },
    sentMessages,
    get optionPageOpenCount() {
      return optionPageOpenCount;
    },
    install: () => {
      globalThis.chrome = {
        runtime
      } as typeof chrome;
    },
    uninstall: () => {
      globalThis.chrome = previousChrome;
    },
    emitSyncHistoryUpdated: (entries) => {
      syncHistoryEntries = entries;
      const message: RuntimeMessage = {
        type: SYNC_HISTORY_UPDATED_TYPE,
        payload: {
          syncHistory: {
            version: STORAGE_SCHEMA_VERSION,
            entries
          }
        }
      };

      for (const listener of listeners) {
        listener(message);
      }
    }
  };
}

export function makePopupEmptyHistoryFixture(): {
  settings: PublicSettingsState;
  syncHistoryEntries: SyncHistoryEntry[];
  retryBundles: RetryBundleSummary[];
} {
  return {
    settings: makePopupFixtureSettings(),
    syncHistoryEntries: [],
    retryBundles: []
  };
}

export function renderPopupStaticQaFixture(
  settings: PublicSettingsState,
  syncHistoryEntries: SyncHistoryEntry[],
  retryBundles: RetryBundleSummary[]
): string {
  const locale = "en";
  const setup = getSetupStatusView(settings, locale);
  const historyModel = buildHistoryDisplayModel(
    syncHistoryEntries,
    retryBundles,
    Date.parse("2026-06-08T04:35:00.000Z"),
    locale
  );
  const history =
    historyModel.groups.length === 0
      ? `<p id="history-empty" class="empty-state">${escapeHtml(historyModel.emptyText)}</p>`
      : `<ul id="history-list" class="history-list">${historyModel.groups
          .map(
            (group) => `<li class="history-item history-problem-group ${group.tone}">
  <h3>${escapeHtml(group.title)}</h3>
  <p class="history-meta">${escapeHtml(group.meta)}</p>
  ${group.errorBatches.map((batch) => renderBatch(batch.summary)).join("")}
  <div class="history-entry-list">${group.entries.map(renderEntry).join("")}</div>
</li>`
          )
          .join("")}</ul>`;

  return `<main class="popup-shell" aria-labelledby="popup-title">
  <h1 id="popup-title">SolveSync</h1>
  <section id="setup-card" class="status-card ${setup.tone}">
    <h2 id="setup-title">${escapeHtml(setup.label)}</h2>
    <p id="setup-detail">${escapeHtml(setup.detail)}</p>
  </section>
  <section class="panel controls-panel">
    <strong id="connection-summary">${escapeHtml(t(locale, "status.connected"))}</strong>
    <strong id="repository-summary">${escapeHtml(settings.syncRepository?.fullName ?? t(locale, "popup.summary.notSelected"))}</strong>
    <strong id="branch-summary">${escapeHtml(settings.syncBranch?.name ?? t(locale, "popup.summary.notSelected"))}</strong>
  </section>
  <section class="panel history-panel">
    <h2>${escapeHtml(t(locale, "popup.section.history"))}</h2>
    <p id="history-count">${escapeHtml(
      t(locale, historyModel.entryCount === 1 ? "history.countOne" : "history.count", {
        count: historyModel.entryCount
      })
    )}</p>
    ${history}
  </section>
</main>`;
}

function renderBatch(summary: string): string {
  return `<div class="history-error-batch">
    <p class="history-error-batch-summary">${escapeHtml(summary)}</p>
    <button class="button primary compact history-retry-all-button" type="button">Retry all</button>
  </div>`;
}

function renderEntry(entry: HistoryItem): string {
  return `<div class="history-entry-row history-language-row ${entry.tone}">
      <span class="language-badge">${escapeHtml(entry.languageLabel)}</span>
      <span class="status-badge ${entry.tone}">${escapeHtml(entry.statusLabel)}</span>
      <p class="history-meta history-entry-footer">${escapeHtml(entry.entryMeta)}</p>
      ${entry.commitUrl === null ? "" : '<a class="history-link history-link-pill">Commit</a>'}
      ${entry.fileUrl === null ? "" : '<a class="history-link history-link-pill">File</a>'}
      ${
        entry.failure === null
          ? ""
          : `<p class="history-detail">${escapeHtml(entry.failure.summary)}</p>
      <button class="button secondary compact" type="button">Details</button>
      ${
        entry.canRetry && entry.retryBundleId !== null
          ? '<button class="button primary compact" type="button">Retry</button>'
          : ""
      }`
      }
    </div>`;
}

function makePopupFixtureSettings(): PublicSettingsState {
  return {
    version: STORAGE_SCHEMA_VERSION,
    hasGithubPat: true,
    syncRepository,
    syncBranch: {
      name: "release/chrome-web-store-prelaunch-popup-runtime-fixture-with-long-branch-name",
      sha: "branch-sha",
      protected: false
    },
    autoSyncEnabled: true,
    uiLanguage: DEFAULT_UI_LANGUAGE,
    connectionStatus: {
      code: "connected",
      checkedAt: "2026-06-08T04:00:00.000Z",
      error: null
    },
    updatedAt: "2026-06-08T04:00:00.000Z"
  };
}

function makePopupFixtureHistoryEntries(): SyncHistoryEntry[] {
  const swiftFailure = makeSyncHistoryEntry({
    id: "long-swift-failure",
    status: "failed",
    updatedAt: "2026-06-08T04:33:00.000Z",
    commitSha: null,
    commitUrl: null,
    fileUrl: null,
    retryBundleId: "retry-long-swift",
    error: makeError("github_commit_failed", "Could not commit the solution.")
  });
  const pythonFailure = makeSyncHistoryEntry({
    id: "long-python-failure",
    language: "Python3",
    supportedLanguage: "python3",
    syncDeduplicationKey: {
      codingPlatform: "leetcode",
      acceptedSourceId: "accepted-long-python",
      titleSlug: "minimum-cost-to-make-at-least-one-valid-path-in-a-grid-with-extra-long-title",
      language: "python3"
    },
    solutionPath:
      "leetcode/python/1368_minimum_cost_to_make_at_least_one_valid_path_in_a_grid_with_extra_long_title.py",
    status: "failed",
    updatedAt: "2026-06-08T04:32:00.000Z",
    commitSha: null,
    commitUrl: null,
    fileUrl: null,
    retryBundleId: "retry-long-python",
    error: makeError("github_commit_failed", "Could not commit the solution.")
  });
  const syncedProgrammers = makeProgrammersSyncHistoryEntry({
    id: "programmers-synced",
    updatedAt: "2026-06-08T04:20:00.000Z"
  });

  return [swiftFailure, pythonFailure, syncedProgrammers];
}

function makePopupFixtureRetryBundles(): RetryBundleSummary[] {
  return [
    makeRetryBundleSummary("retry-long-swift", "swift"),
    makeRetryBundleSummary("retry-long-python", "python3")
  ];
}

function makeSyncHistoryEntry(
  overrides: Partial<SyncHistoryEntry> = {}
): SyncHistoryEntry {
  const timestamp = "2026-06-08T04:10:00.000Z";

  return {
    id: "entry-1",
    codingPlatform: "leetcode",
    status: "synced",
    titleSlug: "minimum-cost-to-make-at-least-one-valid-path-in-a-grid-with-extra-long-title",
    problemTitle:
      "Minimum Cost to Make at Least One Valid Path in a Grid With Extra Long Title",
    problemFrontendId: "1368",
    language: "Swift",
    supportedLanguage: "swift",
    syncDeduplicationKey: {
      codingPlatform: "leetcode",
      acceptedSourceId: "accepted-long-swift",
      titleSlug: "minimum-cost-to-make-at-least-one-valid-path-in-a-grid-with-extra-long-title",
      language: "swift"
    },
    syncRepository,
    syncBranchName:
      "release/chrome-web-store-prelaunch-popup-runtime-fixture-with-long-branch-name",
    solutionPath:
      "leetcode/swift/1368_minimum_cost_to_make_at_least_one_valid_path_in_a_grid_with_extra_long_title.swift",
    commitSha: "commit-sha",
    commitUrl: "https://github.com/solvesync-fixture/algorithm-sync-sandbox/commit/commit-sha",
    fileUrl:
      "https://github.com/solvesync-fixture/algorithm-sync-sandbox/blob/main/leetcode/swift/1368_minimum_cost_to_make_at_least_one_valid_path_in_a_grid_with_extra_long_title.swift",
    error: null,
    retryBundleId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function makeProgrammersSyncHistoryEntry(
  overrides: Partial<SyncHistoryEntry> = {}
): SyncHistoryEntry {
  return makeSyncHistoryEntry({
    codingPlatform: "programmers",
    titleSlug: "120804_두_수의_곱_구하기",
    problemTitle: "두 수의 곱 구하기",
    problemFrontendId: "120804",
    syncDeduplicationKey: {
      codingPlatform: "programmers",
      acceptedSourceId: "programmers:120804:swift:fixturehash",
      titleSlug: "120804_두_수의_곱_구하기",
      language: "swift"
    },
    solutionPath: "programmers/swift/120804_두_수의_곱_구하기.swift",
    commitUrl:
      "https://github.com/solvesync-fixture/algorithm-sync-sandbox/commit/programmers-sha",
    fileUrl:
      "https://github.com/solvesync-fixture/algorithm-sync-sandbox/blob/main/programmers/swift/120804_두_수의_곱_구하기.swift",
    ...overrides
  });
}

function makeRetryBundleSummary(
  id: string,
  language: "swift" | "python3"
): RetryBundleSummary {
  return {
    id,
    codingPlatform: "leetcode",
    syncDeduplicationKey: {
      codingPlatform: "leetcode",
      acceptedSourceId: `accepted-long-${language}`,
      titleSlug: "minimum-cost-to-make-at-least-one-valid-path-in-a-grid-with-extra-long-title",
      language
    },
    attempts: 1,
    expiresAt: "2026-06-15T04:00:00.000Z",
    lastError: makeError("github_commit_failed", "Could not commit the solution.")
  };
}

function makeError(
  code: NormalizedError["code"],
  userMessage: string
): NormalizedError {
  return {
    code,
    userMessage,
    debugMessage: "Fixture GitHub commit failure.",
    retryable: code === "github_commit_failed"
  };
}

function ok<T>(data: T): RuntimeSuccessResponse<T> {
  return {
    ok: true,
    data
  };
}

function fail(error: NormalizedError): RuntimeFailureResponse {
  return {
    ok: false,
    error
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const syncRepository: SyncRepository = {
  owner: "solvesync-fixture",
  name: "algorithm-sync-sandbox-with-a-very-long-repository-name-for-popup-qa",
  fullName:
    "solvesync-fixture/algorithm-sync-sandbox-with-a-very-long-repository-name-for-popup-qa",
  defaultBranch: "main",
  private: true,
  htmlUrl:
    "https://github.com/solvesync-fixture/algorithm-sync-sandbox-with-a-very-long-repository-name-for-popup-qa"
};
