import {
  createEmptySolutionCatalog,
  mergeSolutionCatalogEntry,
  parseSolutionCatalogJson
} from "../shared/solutionCatalog";
import { mergeReadmeManagedBlock, renderManagedReadmeTable } from "../shared/readme";
import { buildGitTreeFiles, type GitTreeFile } from "../shared/githubTree";
import { buildSolutionPath, sanitizeProgrammersFilename } from "../shared/paths";
import { getPlatformPolicy } from "../shared/platformPolicy";
import { mapProgrammersLanguage } from "../shared/language";
import { normalizeError, normalizeLeetCodeError } from "../shared/errorNormalize";
import type { NormalizedError, NormalizedErrorCode } from "../shared/errors";
import type {
  AcceptedSubmission,
  SyncBranch,
  IsoDateString,
  LeetCodeLanguage,
  ProblemMetadata,
  SyncRepository,
  RetryBundle,
  SyncDeduplicationKey,
  SyncHistoryEntry,
  SyncStatus
} from "../shared/types";
import type { SyncHistoryState } from "../shared/storageSchema";
import type {
  AcceptedDetectedPayload,
  BackgroundToContentPopupMessage
} from "../shared/messages";
import { SYNC_HISTORY_UPDATED_TYPE } from "../shared/messages";
import {
  RETRY_BUNDLE_TTL_MS,
  type ExtensionStorage
} from "./storage";
import {
  buildGitHubCommitMessage,
  type CommitConflictRetryContext,
  type CommitGitDataInput,
  type CommitGitDataResult,
  type ReadTextFileInput
} from "./client/github";
import type { LatestAcceptedSubmissionResult } from "./client/leetcode";

export type SyncBroadcast = (
  message: BackgroundToContentPopupMessage,
  target?: SyncBroadcastTarget
) => Promise<void> | void;

export interface SyncBroadcastTarget {
  tabId?: number;
}

export interface SyncLeetCodeClient {
  fetchProblemMetadata(titleSlug: string): Promise<ProblemMetadata>;
  fetchLatestAcceptedSubmission(
    titleSlug: string
  ): Promise<LatestAcceptedSubmissionResult>;
}

export interface SyncGitHubClient {
  commitFiles(input: CommitGitDataInput): Promise<CommitGitDataResult>;
  readTextFile?(input: ReadTextFileInput): Promise<string | null>;
}

export type GitHubClientFactory = (pat: string) => SyncGitHubClient;

export type SyncClock = () => IsoDateString;
export type SyncIdFactory = (prefix: "record" | "retry") => string;

export interface SyncOrchestratorOptions {
  storage: ExtensionStorage;
  leetcode: SyncLeetCodeClient;
  githubClientFactory: GitHubClientFactory;
  broadcast?: SyncBroadcast;
  now?: SyncClock;
  createId?: SyncIdFactory;
}

export type AcceptedSyncOutcome =
  | {
      kind: "recorded";
      syncHistoryEntry: SyncHistoryEntry;
      syncHistory: SyncHistoryState;
    }
  | { kind: "duplicate_processed"; syncDeduplicationKey: SyncDeduplicationKey }
  | { kind: "duplicate_in_flight"; syncDeduplicationKey: SyncDeduplicationKey };

export type RetrySyncOutcome =
  | {
      kind: "recorded";
      syncHistoryEntry: SyncHistoryEntry;
      syncHistory: SyncHistoryState;
    }
  | {
      kind: "missing_retry_bundle";
      syncHistoryEntry: SyncHistoryEntry;
      syncHistory: SyncHistoryState;
    }
  | { kind: "duplicate_processed"; syncDeduplicationKey: SyncDeduplicationKey }
  | { kind: "duplicate_in_flight"; syncDeduplicationKey: SyncDeduplicationKey };

export interface SyncOrchestrator {
  handleAcceptedDetected(
    payload: AcceptedDetectedPayload,
    target?: SyncBroadcastTarget
  ): Promise<AcceptedSyncOutcome>;
  handleRetry(
    retryBundleId: string,
    target?: SyncBroadcastTarget
  ): Promise<RetrySyncOutcome>;
}

interface PreparedCommit {
  syncDeduplicationKey: SyncDeduplicationKey;
  problem: ProblemMetadata;
  submission: AcceptedSubmission;
  syncRepository: SyncRepository;
  syncBranch: SyncBranch;
  solutionPath: string;
  solutionReadmePath: string;
  solutionCatalogPath: string;
  commitMessage: string;
}

interface CommitFilesBuildInput {
  problem: ProblemMetadata;
  submission: AcceptedSubmission;
  syncDeduplicationKey: SyncDeduplicationKey;
  solutionPath: string;
  solutionReadmePath: string;
  solutionCatalogPath: string;
  existingSolutionCatalogText: string | null;
  existingReadmeText: string | null;
  syncedAt: IsoDateString;
}

type ResolvedSource =
  | {
      kind: "syncable";
      problem: ProblemMetadata;
      submission: AcceptedSubmission;
      syncDeduplicationKey: SyncDeduplicationKey;
    }
  | {
      kind: "unsupported_language";
      problem: ProblemMetadata;
      submission: AcceptedSubmission;
    }
  | {
      kind: "extract_failed";
      titleSlug: string;
      problemTitle: string | null;
      problemFrontendId: string | null;
      language: string;
      error: NormalizedError;
    };

interface RecordInput {
  status: SyncStatus;
  codingPlatform?: SyncDeduplicationKey["codingPlatform"];
  titleSlug: string;
  problemTitle?: string | null;
  problemFrontendId?: string | null;
  language?: string;
  supportedLanguage?: SyncDeduplicationKey["language"] | null;
  syncDeduplicationKey?: SyncDeduplicationKey | null;
  syncRepository?: SyncRepository | null;
  syncBranchName?: string | null;
  solutionPath?: string | null;
  commitSha?: string | null;
  commitUrl?: string | null;
  fileUrl?: string | null;
  error?: NormalizedError | null;
  retryBundleId?: string | null;
  timestamp?: IsoDateString;
}

export function createSyncOrchestrator(
  options: SyncOrchestratorOptions
): SyncOrchestrator {
  const broadcast = options.broadcast ?? noopBroadcast;
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? defaultCreateId;

  async function handleAcceptedDetected(
    payload: AcceptedDetectedPayload,
    target?: SyncBroadcastTarget
  ): Promise<AcceptedSyncOutcome> {
    const settings = await options.storage.getSettings();
    const initialTimestamp = now();
    const initialTitleSlug = getInitialTitleSlug(payload);
    await options.storage.pruneRetryBundles(initialTimestamp);
    await options.storage.pruneSyncDeduplicationKeyLocks(initialTimestamp);

    if (!hasRequiredSetup(settings)) {
      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "setup_required",
        codingPlatform: payload.codingPlatform,
        titleSlug: initialTitleSlug,
        problemTitle: getInitialProblemTitle(payload),
        language: getInitialLanguage(payload),
        error: explicitError("setup_required", "GitHub connection required."),
        timestamp: initialTimestamp
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    }

    if (!settings.autoSyncEnabled) {
      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "auto_sync_disabled",
        codingPlatform: payload.codingPlatform,
        titleSlug: initialTitleSlug,
        problemTitle: getInitialProblemTitle(payload),
        language: getInitialLanguage(payload),
        syncRepository: settings.syncRepository,
        syncBranchName: settings.syncBranch.name,
        error: explicitError("auto_sync_disabled", "Auto Sync is off."),
        timestamp: initialTimestamp
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    }

    let source: ResolvedSource;

    try {
      source = await resolveAcceptedSource(payload);
    } catch (error) {
      const normalized =
        payload.codingPlatform === "leetcode"
          ? normalizeLeetCodeError(error)
          : normalizeError(error);
      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "failed",
        codingPlatform: payload.codingPlatform,
        titleSlug: initialTitleSlug,
        problemTitle: getInitialProblemTitle(payload),
        language: getInitialLanguage(payload),
        syncRepository: settings.syncRepository,
        syncBranchName: settings.syncBranch.name,
        error: normalized,
        timestamp: now()
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    }

    if (source.kind === "extract_failed") {
      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "failed",
        codingPlatform: payload.codingPlatform,
        titleSlug: source.titleSlug,
        problemTitle: source.problemTitle,
        problemFrontendId: source.problemFrontendId,
        language: source.language,
        syncRepository: settings.syncRepository,
        syncBranchName: settings.syncBranch.name,
        error: source.error,
        timestamp: now()
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    }

    if (source.kind === "unsupported_language") {
      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "unsupported_language",
        codingPlatform: payload.codingPlatform,
        titleSlug: source.problem.titleSlug,
        problemTitle: source.problem.title,
        problemFrontendId: source.problem.frontendId,
        language: source.submission.language,
        syncRepository: settings.syncRepository,
        syncBranchName: settings.syncBranch.name,
        error: explicitError(
          "unsupported_language",
          `Unsupported ${payload.codingPlatform} language: ${source.submission.language}`
        ),
        timestamp: now()
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    }

    const prepared = prepareCommit(
      source.problem,
      source.submission,
      source.syncDeduplicationKey,
      settings.syncRepository,
      settings.syncBranch
    );

    if (await options.storage.hasProcessedSyncDeduplicationKey(prepared.syncDeduplicationKey)) {
      return {
        kind: "duplicate_processed",
        syncDeduplicationKey: prepared.syncDeduplicationKey
      };
    }

    const locked = await options.storage.acquireSyncDeduplicationKeyLock(
      prepared.syncDeduplicationKey,
      now()
    );

    if (!locked) {
      return {
        kind: "duplicate_in_flight",
        syncDeduplicationKey: prepared.syncDeduplicationKey
      };
    }

    try {
      if (await options.storage.hasProcessedSyncDeduplicationKey(prepared.syncDeduplicationKey)) {
        return {
          kind: "duplicate_processed",
          syncDeduplicationKey: prepared.syncDeduplicationKey
        };
      }

      await broadcastStatus(
        makeSyncHistoryEntry({
          status: "syncing",
          codingPlatform: prepared.syncDeduplicationKey.codingPlatform,
          titleSlug: prepared.problem.titleSlug,
          problemTitle: prepared.problem.title,
          problemFrontendId: prepared.problem.frontendId,
          language: prepared.submission.language,
          supportedLanguage: prepared.syncDeduplicationKey.language,
          syncDeduplicationKey: prepared.syncDeduplicationKey,
          syncRepository: prepared.syncRepository,
          syncBranchName: prepared.syncBranch.name,
          solutionPath: prepared.solutionPath,
          timestamp: now()
        }),
        null,
        target
      );

      const github = options.githubClientFactory(settings.githubPat);
      let files: GitTreeFile[];

      try {
        files = await buildCommitFilesFromRepository(github, prepared, now());
      } catch (error) {
        const normalized = normalizeError(error);
        const syncHistoryEntry = makeSyncHistoryEntry({
          status: "failed",
          codingPlatform: prepared.syncDeduplicationKey.codingPlatform,
          titleSlug: prepared.problem.titleSlug,
          problemTitle: prepared.problem.title,
          problemFrontendId: prepared.problem.frontendId,
          language: prepared.submission.language,
          supportedLanguage: prepared.syncDeduplicationKey.language,
          syncDeduplicationKey: prepared.syncDeduplicationKey,
          syncRepository: prepared.syncRepository,
          syncBranchName: prepared.syncBranch.name,
          solutionPath: prepared.solutionPath,
          error: normalized,
          timestamp: now()
        });

        return recordAndBroadcast(syncHistoryEntry, target);
      }

      const result = await commitPreparedFiles(github, prepared, files, now());
      const syncedAt = now();
      await options.storage.markSyncDeduplicationKeyProcessed(
        prepared.syncDeduplicationKey,
        {
          commitSha: result.commitSha,
          solutionPath: prepared.solutionPath
        },
        syncedAt
      );

      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "synced",
        codingPlatform: prepared.syncDeduplicationKey.codingPlatform,
        titleSlug: prepared.problem.titleSlug,
        problemTitle: prepared.problem.title,
        problemFrontendId: prepared.problem.frontendId,
        language: prepared.submission.language,
        supportedLanguage: prepared.syncDeduplicationKey.language,
        syncDeduplicationKey: prepared.syncDeduplicationKey,
        syncRepository: result.repository,
        syncBranchName: result.branch.name,
        solutionPath: prepared.solutionPath,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        fileUrl: result.fileUrls[prepared.solutionPath] ?? null,
        timestamp: syncedAt
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    } catch (error) {
      const normalized = normalizeError(error);
      const retryBundle = makeRetryBundle(prepared, normalized, now());
      await options.storage.saveRetryBundle(retryBundle, retryBundle.createdAt);

      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "failed",
        codingPlatform: prepared.syncDeduplicationKey.codingPlatform,
        titleSlug: prepared.problem.titleSlug,
        problemTitle: prepared.problem.title,
        problemFrontendId: prepared.problem.frontendId,
        language: prepared.submission.language,
        supportedLanguage: prepared.syncDeduplicationKey.language,
        syncDeduplicationKey: prepared.syncDeduplicationKey,
        syncRepository: prepared.syncRepository,
        syncBranchName: prepared.syncBranch.name,
        solutionPath: prepared.solutionPath,
        error: normalized,
        retryBundleId: retryBundle.id,
        timestamp: retryBundle.createdAt
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    } finally {
      await options.storage.releaseSyncDeduplicationKeyLock(prepared.syncDeduplicationKey);
    }
  }

  async function resolveAcceptedSource(
    payload: AcceptedDetectedPayload
  ): Promise<ResolvedSource> {
    if (payload.codingPlatform === "leetcode") {
      return resolveLeetCodeSource(payload.titleSlug);
    }

    return resolveProgrammersSource(payload);
  }

  async function resolveLeetCodeSource(titleSlug: string): Promise<ResolvedSource> {
    const [problem, accepted] = await Promise.all([
      options.leetcode.fetchProblemMetadata(titleSlug),
      options.leetcode.fetchLatestAcceptedSubmission(titleSlug)
    ]);

    if (!accepted.syncable) {
      return {
        kind: "unsupported_language",
        problem,
        submission: accepted.submission
      };
    }

    return {
      kind: "syncable",
      problem,
      submission: accepted.submission,
      syncDeduplicationKey: accepted.syncDeduplicationKey
    };
  }

  async function handleRetry(
    retryBundleId: string,
    target?: SyncBroadcastTarget
  ): Promise<RetrySyncOutcome> {
    const timestamp = now();
    await options.storage.pruneRetryBundles(timestamp);
    await options.storage.pruneSyncDeduplicationKeyLocks(timestamp);

    const retryBundle = await options.storage.getRetryBundle(retryBundleId);

    if (retryBundle === null) {
      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "failed",
        titleSlug: "",
        error: explicitError("github_commit_failed", "Retry Bundle is missing or expired."),
        timestamp
      });
      const syncHistory = await appendAndBroadcast(syncHistoryEntry, target);

      return {
        kind: "missing_retry_bundle",
        syncHistoryEntry,
        syncHistory
      };
    }

    if (
      await options.storage.hasProcessedSyncDeduplicationKey(
        retryBundle.syncDeduplicationKey
      )
    ) {
      await options.storage.removeRetryBundle(retryBundle.id);

      return {
        kind: "duplicate_processed",
        syncDeduplicationKey: retryBundle.syncDeduplicationKey
      };
    }

    const locked = await options.storage.acquireSyncDeduplicationKeyLock(
      retryBundle.syncDeduplicationKey,
      now()
    );

    if (!locked) {
      return {
        kind: "duplicate_in_flight",
        syncDeduplicationKey: retryBundle.syncDeduplicationKey
      };
    }

    try {
      const settings = await options.storage.getSettings();

      if (settings.githubPat === null || settings.githubPat.trim().length === 0) {
        throw explicitError("github_auth_failed", "GitHub PAT is required.");
      }

      await broadcastStatus(
        makeSyncHistoryEntry({
          status: "retrying",
          codingPlatform: retryBundle.codingPlatform,
          titleSlug: retryBundle.problem.titleSlug,
          problemTitle: retryBundle.problem.title,
          problemFrontendId: retryBundle.problem.frontendId,
          language: retryBundle.submission.language,
          supportedLanguage: retryBundle.syncDeduplicationKey.language,
          syncDeduplicationKey: retryBundle.syncDeduplicationKey,
          syncRepository: retryBundle.syncRepository,
          syncBranchName: retryBundle.syncBranch.name,
          solutionPath: retryBundle.solutionPath,
          retryBundleId: retryBundle.id,
          timestamp: now()
        }),
        null,
        target
      );

      const github = options.githubClientFactory(settings.githubPat);
      const result = await commitPrepared(
        github,
        retryBundleToPreparedCommit(retryBundle),
        now()
      );
      const syncedAt = now();

      await options.storage.markSyncDeduplicationKeyProcessed(
        retryBundle.syncDeduplicationKey,
        {
          commitSha: result.commitSha,
          solutionPath: retryBundle.solutionPath
        },
        syncedAt
      );
      await options.storage.removeRetryBundle(retryBundle.id);

      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "synced",
        codingPlatform: retryBundle.codingPlatform,
        titleSlug: retryBundle.problem.titleSlug,
        problemTitle: retryBundle.problem.title,
        problemFrontendId: retryBundle.problem.frontendId,
        language: retryBundle.submission.language,
        supportedLanguage: retryBundle.syncDeduplicationKey.language,
        syncDeduplicationKey: retryBundle.syncDeduplicationKey,
        syncRepository: result.repository,
        syncBranchName: result.branch.name,
        solutionPath: retryBundle.solutionPath,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        fileUrl: result.fileUrls[retryBundle.solutionPath] ?? null,
        timestamp: syncedAt
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    } catch (error) {
      const normalized = normalizeError(error);
      const failedRetryBundle: RetryBundle = {
        ...retryBundle,
        attempts: retryBundle.attempts + 1,
        lastError: normalized
      };
      await options.storage.saveRetryBundle(failedRetryBundle, now());

      const syncHistoryEntry = makeSyncHistoryEntry({
        status: "failed",
        codingPlatform: retryBundle.codingPlatform,
        titleSlug: retryBundle.problem.titleSlug,
        problemTitle: retryBundle.problem.title,
        problemFrontendId: retryBundle.problem.frontendId,
        language: retryBundle.submission.language,
        supportedLanguage: retryBundle.syncDeduplicationKey.language,
        syncDeduplicationKey: retryBundle.syncDeduplicationKey,
        syncRepository: retryBundle.syncRepository,
        syncBranchName: retryBundle.syncBranch.name,
        solutionPath: retryBundle.solutionPath,
        error: normalized,
        retryBundleId: retryBundle.id,
        timestamp: now()
      });

      return recordAndBroadcast(syncHistoryEntry, target);
    } finally {
      await options.storage.releaseSyncDeduplicationKeyLock(
        retryBundle.syncDeduplicationKey
      );
    }
  }

  async function commitPrepared(
    github: SyncGitHubClient,
    prepared: PreparedCommit,
    syncedAt: IsoDateString
  ): Promise<CommitGitDataResult> {
    const files = await buildCommitFilesFromRepository(github, prepared, syncedAt);

    return commitPreparedFiles(github, prepared, files, syncedAt);
  }

  async function commitPreparedFiles(
    github: SyncGitHubClient,
    prepared: PreparedCommit,
    files: GitTreeFile[],
    syncedAt: IsoDateString
  ): Promise<CommitGitDataResult> {
    return github.commitFiles({
      owner: prepared.syncRepository.owner,
      name: prepared.syncRepository.name,
      repository: prepared.syncRepository,
      branchName: prepared.syncBranch.name,
      files,
      message: prepared.commitMessage,
      onConflict: async (context) =>
        buildCommitFilesFromConflict(context, prepared, syncedAt)
    });
  }

  async function buildCommitFilesFromRepository(
    github: SyncGitHubClient,
    prepared: PreparedCommit,
    syncedAt: IsoDateString
  ): Promise<GitTreeFile[]> {
    const [existingSolutionCatalogText, existingReadmeText] = await Promise.all([
      readRepositoryTextFile(github, prepared, prepared.solutionCatalogPath),
      readRepositoryTextFile(github, prepared, prepared.solutionReadmePath)
    ]);

    return buildCommitFiles({
      problem: prepared.problem,
      submission: prepared.submission,
      syncDeduplicationKey: prepared.syncDeduplicationKey,
      solutionPath: prepared.solutionPath,
      solutionReadmePath: prepared.solutionReadmePath,
      solutionCatalogPath: prepared.solutionCatalogPath,
      existingSolutionCatalogText,
      existingReadmeText,
      syncedAt
    });
  }

  async function buildCommitFilesFromConflict(
    context: CommitConflictRetryContext,
    prepared: PreparedCommit,
    syncedAt: IsoDateString
  ): Promise<GitTreeFile[]> {
    const [existingSolutionCatalogText, existingReadmeText] = await Promise.all([
      context.readTextFile(prepared.solutionCatalogPath),
      context.readTextFile(prepared.solutionReadmePath)
    ]);

    return buildCommitFiles({
      problem: prepared.problem,
      submission: prepared.submission,
      syncDeduplicationKey: prepared.syncDeduplicationKey,
      solutionPath: prepared.solutionPath,
      solutionReadmePath: prepared.solutionReadmePath,
      solutionCatalogPath: prepared.solutionCatalogPath,
      existingSolutionCatalogText,
      existingReadmeText,
      syncedAt
    });
  }

  async function recordAndBroadcast(
    syncHistoryEntry: SyncHistoryEntry,
    target?: SyncBroadcastTarget
  ): Promise<AcceptedSyncOutcome & RetrySyncOutcome> {
    const syncHistory = await appendAndBroadcast(syncHistoryEntry, target);

    return {
      kind: "recorded",
      syncHistoryEntry,
      syncHistory
    };
  }

  async function appendAndBroadcast(
    syncHistoryEntry: SyncHistoryEntry,
    target?: SyncBroadcastTarget
  ): Promise<SyncHistoryState> {
    const syncHistory = await options.storage.appendSyncHistoryEntry(syncHistoryEntry);
    await broadcastStatus(syncHistoryEntry, syncHistoryEntry.error, target);
    await broadcast(
      {
        type: SYNC_HISTORY_UPDATED_TYPE,
        payload: {
          syncHistory
        }
      },
      target
    );

    return syncHistory;
  }

  async function broadcastStatus(
    syncHistoryEntry: SyncHistoryEntry,
    error: NormalizedError | null,
    target?: SyncBroadcastTarget
  ): Promise<void> {
    await broadcast(
      {
        type: "sync:status",
        payload: {
          status: syncHistoryEntry.status,
          syncHistoryEntry,
          error
        }
      },
      target
    );
  }

  function makeSyncHistoryEntry(input: RecordInput): SyncHistoryEntry {
    const timestamp = input.timestamp ?? now();

    return {
      id: createId("record"),
      codingPlatform: input.codingPlatform ?? "leetcode",
      status: input.status,
      titleSlug: input.titleSlug,
      problemTitle: input.problemTitle ?? null,
      problemFrontendId: input.problemFrontendId ?? null,
      language: input.language ?? "",
      supportedLanguage: input.supportedLanguage ?? null,
      syncDeduplicationKey: input.syncDeduplicationKey ?? null,
      syncRepository: input.syncRepository ?? null,
      syncBranchName: input.syncBranchName ?? null,
      solutionPath: input.solutionPath ?? null,
      commitSha: input.commitSha ?? null,
      commitUrl: input.commitUrl ?? null,
      fileUrl: input.fileUrl ?? null,
      error: input.error ?? null,
      retryBundleId: input.retryBundleId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function makeRetryBundle(
    prepared: PreparedCommit,
    error: NormalizedError,
    createdAt: IsoDateString
  ): RetryBundle {
    return {
      id: createId("retry"),
      codingPlatform: prepared.syncDeduplicationKey.codingPlatform,
      syncDeduplicationKey: prepared.syncDeduplicationKey,
      syncRepository: prepared.syncRepository,
      syncBranch: prepared.syncBranch,
      problem: prepared.problem,
      submission: prepared.submission,
      solutionPath: prepared.solutionPath,
      solutionReadmePath: prepared.solutionReadmePath,
      solutionCatalogPath: prepared.solutionCatalogPath,
      commitMessage: prepared.commitMessage,
      attempts: 0,
      createdAt,
      expiresAt: addMs(createdAt, RETRY_BUNDLE_TTL_MS),
      lastError: error
    };
  }

  return {
    handleAcceptedDetected,
    handleRetry
  };
}

function resolveProgrammersSource(
  payload: Extract<AcceptedDetectedPayload, { codingPlatform: "programmers" }>
): ResolvedSource {
  const lessonId = payload.lessonId.trim();
  const title = payload.problemTitle.trim();
  const language = payload.language.trim();
  const code = payload.code;
  const titleSlug =
    lessonId.length > 0 && title.length > 0
      ? buildProgrammersTitleSlug(lessonId, title)
      : getInitialTitleSlug(payload);

  if (
    lessonId.length === 0 ||
    title.length === 0 ||
    language.length === 0 ||
    code.trim().length === 0
  ) {
    return {
      kind: "extract_failed",
      titleSlug,
      problemTitle: title.length > 0 ? title : null,
      problemFrontendId: lessonId.length > 0 ? lessonId : null,
      language,
      error: explicitError(
        "programmers_extract_failed",
        "Programmers snapshot is missing lesson id, title, language, or code."
      )
    };
  }

  const supportedLanguage = mapProgrammersLanguage(language);
  const codeHash = buildShortCodeHash(code);
  const acceptedSourceId =
    supportedLanguage === null
      ? `programmers:${lessonId}:unsupported:${codeHash}`
      : buildProgrammersAcceptedSourceId(lessonId, supportedLanguage, codeHash);
  const problem: ProblemMetadata = {
    problemId: lessonId,
    frontendId: lessonId,
    title,
    titleSlug,
    difficulty: "-",
    url: payload.pageUrl
  };
  const submission: AcceptedSubmission = {
    acceptedSourceId,
    titleSlug,
    language: language as LeetCodeLanguage,
    code,
    acceptedAt: payload.detectedAt
  };

  if (supportedLanguage === null) {
    return {
      kind: "unsupported_language",
      problem,
      submission
    };
  }

  return {
    kind: "syncable",
    problem,
    submission,
    syncDeduplicationKey: {
      codingPlatform: "programmers",
      acceptedSourceId,
      titleSlug,
      language: supportedLanguage
    }
  };
}

function buildProgrammersAcceptedSourceId(
  lessonId: string,
  language: SyncDeduplicationKey["language"],
  codeHash: string
): string {
  return `programmers:${lessonId}:${language}:${codeHash}`;
}

function buildProgrammersTitleSlug(lessonId: string, title: string): string {
  return `${sanitizeProgrammersFilename(lessonId)}_${sanitizeProgrammersFilename(title)}`;
}

function buildShortCodeHash(code: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

function getInitialTitleSlug(payload: AcceptedDetectedPayload): string {
  if (payload.codingPlatform === "leetcode") {
    return payload.titleSlug;
  }

  const lessonId = payload.lessonId.trim();
  const title = payload.problemTitle.trim();

  if (lessonId.length > 0 && title.length > 0) {
    return buildProgrammersTitleSlug(lessonId, title);
  }

  if (lessonId.length > 0) {
    return sanitizeProgrammersFilename(lessonId);
  }

  return "programmers";
}

function getInitialProblemTitle(payload: AcceptedDetectedPayload): string | null {
  if (payload.codingPlatform === "programmers") {
    const title = payload.problemTitle.trim();

    return title.length > 0 ? title : null;
  }

  return null;
}

function getInitialLanguage(payload: AcceptedDetectedPayload): string {
  return payload.codingPlatform === "programmers" ? payload.language : "";
}

function hasRequiredSetup(settings: {
  githubPat: string | null;
  syncRepository: SyncRepository | null;
  syncBranch: SyncBranch | null;
}): settings is {
  githubPat: string;
  syncRepository: SyncRepository;
  syncBranch: SyncBranch;
} {
  return (
    settings.githubPat !== null &&
    settings.githubPat.trim().length > 0 &&
    settings.syncRepository !== null &&
    settings.syncBranch !== null
  );
}

function prepareCommit(
  problem: ProblemMetadata,
  submission: AcceptedSubmission,
  syncDeduplicationKey: SyncDeduplicationKey,
  syncRepository: SyncRepository,
  syncBranch: SyncBranch
): PreparedCommit {
  const solutionPath = buildSolutionPath(syncDeduplicationKey.codingPlatform, problem, syncDeduplicationKey.language);
  const policy = getPlatformPolicy(syncDeduplicationKey.codingPlatform);

  return {
    syncDeduplicationKey,
    problem,
    submission,
    syncRepository,
    syncBranch,
    solutionPath,
    solutionReadmePath: policy.solutionReadmePath,
    solutionCatalogPath: policy.solutionCatalogPath,
    commitMessage: buildGitHubCommitMessage({
      codingPlatform: syncDeduplicationKey.codingPlatform,
      frontendId: problem.frontendId,
      title: problem.title,
      language: syncDeduplicationKey.language
    })
  };
}

function retryBundleToPreparedCommit(retryBundle: RetryBundle): PreparedCommit {
  return {
    syncDeduplicationKey: retryBundle.syncDeduplicationKey,
    problem: retryBundle.problem,
    submission: retryBundle.submission,
    syncRepository: retryBundle.syncRepository,
    syncBranch: retryBundle.syncBranch,
    solutionPath: retryBundle.solutionPath,
    solutionReadmePath: retryBundle.solutionReadmePath,
    solutionCatalogPath: retryBundle.solutionCatalogPath,
    commitMessage: retryBundle.commitMessage
  };
}

async function readRepositoryTextFile(
  github: SyncGitHubClient,
  prepared: PreparedCommit,
  path: string
): Promise<string | null> {
  if (github.readTextFile === undefined) {
    return null;
  }

  return github.readTextFile({
    owner: prepared.syncRepository.owner,
    name: prepared.syncRepository.name,
    repository: prepared.syncRepository,
    branchName: prepared.syncBranch.name,
    path
  });
}

function buildCommitFiles(input: CommitFilesBuildInput): GitTreeFile[] {
  const baseSolutionCatalog =
    input.existingSolutionCatalogText === null ||
    input.existingSolutionCatalogText.trim().length === 0
      ? createEmptySolutionCatalog()
      : parseSolutionCatalogJson(input.existingSolutionCatalogText);
  const nextSolutionCatalog = mergeSolutionCatalogEntry(
    baseSolutionCatalog,
    {
      ...input.problem,
      acceptedSourceId: input.syncDeduplicationKey.acceptedSourceId,
      language: input.syncDeduplicationKey.language
    },
    input.solutionPath,
    input.syncedAt,
    toLocalDateString(input.submission.acceptedAt)
  );
  const readmeTable = renderManagedReadmeTable(
    nextSolutionCatalog,
    input.syncDeduplicationKey.codingPlatform
  );
  const readmeContent = mergeReadmeManagedBlock(
    input.existingReadmeText,
    readmeTable,
    input.syncDeduplicationKey.codingPlatform
  );

  return buildGitTreeFiles({
    solutionPath: input.solutionPath,
    solutionContent: input.submission.code,
    solutionReadmePath: input.solutionReadmePath,
    readmeContent,
    solutionCatalogPath: input.solutionCatalogPath,
    solutionCatalog: nextSolutionCatalog
  });
}

function explicitError(code: NormalizedErrorCode, message: string): NormalizedError {
  return normalizeError({
    code,
    message
  });
}

function addMs(value: IsoDateString, ms: number): IsoDateString {
  const timestamp = Date.parse(value);
  const base = Number.isFinite(timestamp) ? timestamp : Date.now();

  return new Date(base + ms).toISOString();
}

function toLocalDateString(value: IsoDateString): IsoDateString {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function defaultCreateId(prefix: "record" | "retry"): string {
  const random = Math.random().toString(36).slice(2, 10);

  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function noopBroadcast(): void {}
