import {
  createEmptyIndex,
  mergeIndexEntry,
  parseIndexJson
} from "../shared/indexFile";
import { mergeReadmeManagedBlock, renderManagedReadmeTable } from "../shared/readme";
import { buildGitTreeFiles, type GitTreeFile } from "../shared/githubTree";
import { buildSolutionPath, sanitizeProgrammersFilename } from "../shared/paths";
import { getPlatformPolicy } from "../shared/platformPolicy";
import { mapProgrammersLanguage } from "../shared/language";
import { normalizeError, normalizeLeetCodeError } from "../shared/errorNormalize";
import type { NormalizedError, NormalizedErrorCode } from "../shared/errors";
import type {
  AcceptedSubmission,
  BranchRef,
  IsoDateString,
  LeetCodeLanguage,
  ProblemMetadata,
  RepositoryRef,
  RetryPayload,
  SubmissionIdentity,
  SyncRecord,
  SyncStatus
} from "../shared/types";
import type { SyncHistoryState } from "../shared/storageSchema";
import type {
  AcceptedDetectedPayload,
  BackgroundToContentPopupMessage
} from "../shared/messages";
import {
  RETRY_PAYLOAD_TTL_MS,
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
  | { kind: "recorded"; record: SyncRecord; history: SyncHistoryState }
  | { kind: "duplicate_processed"; identity: SubmissionIdentity }
  | { kind: "duplicate_in_flight"; identity: SubmissionIdentity };

export type RetrySyncOutcome =
  | { kind: "recorded"; record: SyncRecord; history: SyncHistoryState }
  | { kind: "missing_retry_payload"; record: SyncRecord; history: SyncHistoryState }
  | { kind: "duplicate_processed"; identity: SubmissionIdentity }
  | { kind: "duplicate_in_flight"; identity: SubmissionIdentity };

export interface SyncOrchestrator {
  handleAcceptedDetected(
    payload: AcceptedDetectedPayload,
    target?: SyncBroadcastTarget
  ): Promise<AcceptedSyncOutcome>;
  handleRetry(
    retryPayloadId: string,
    target?: SyncBroadcastTarget
  ): Promise<RetrySyncOutcome>;
}

interface PreparedCommit {
  identity: SubmissionIdentity;
  problem: ProblemMetadata;
  submission: AcceptedSubmission;
  repository: RepositoryRef;
  branch: BranchRef;
  solutionPath: string;
  readmePath: string;
  indexPath: string;
  commitMessage: string;
}

interface CommitFilesBuildInput {
  problem: ProblemMetadata;
  submission: AcceptedSubmission;
  identity: SubmissionIdentity;
  solutionPath: string;
  readmePath: string;
  indexPath: string;
  existingIndexText: string | null;
  existingReadmeText: string | null;
  syncedAt: IsoDateString;
}

type ResolvedSource =
  | {
      kind: "syncable";
      problem: ProblemMetadata;
      submission: AcceptedSubmission;
      identity: SubmissionIdentity;
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
  platform?: SubmissionIdentity["platform"];
  titleSlug: string;
  problemTitle?: string | null;
  problemFrontendId?: string | null;
  language?: string;
  supportedLanguage?: SubmissionIdentity["language"] | null;
  identity?: SubmissionIdentity | null;
  repository?: RepositoryRef | null;
  branchName?: string | null;
  solutionPath?: string | null;
  commitSha?: string | null;
  commitUrl?: string | null;
  fileUrl?: string | null;
  error?: NormalizedError | null;
  retryPayloadId?: string | null;
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
    await options.storage.pruneRetryPayloads(initialTimestamp);
    await options.storage.pruneInFlightLocks(initialTimestamp);

    if (!hasRequiredSetup(settings)) {
      const record = makeRecord({
        status: "setup_required",
        platform: payload.platform,
        titleSlug: initialTitleSlug,
        problemTitle: getInitialProblemTitle(payload),
        language: getInitialLanguage(payload),
        error: explicitError("setup_required", "GitHub connection required."),
        timestamp: initialTimestamp
      });

      return recordAndBroadcast(record, target);
    }

    if (!settings.autoSyncEnabled) {
      const record = makeRecord({
        status: "auto_sync_disabled",
        platform: payload.platform,
        titleSlug: initialTitleSlug,
        problemTitle: getInitialProblemTitle(payload),
        language: getInitialLanguage(payload),
        repository: settings.selectedRepository,
        branchName: settings.selectedBranch.name,
        error: explicitError("auto_sync_disabled", "Auto Sync is off."),
        timestamp: initialTimestamp
      });

      return recordAndBroadcast(record, target);
    }

    let source: ResolvedSource;

    try {
      source = await resolveAcceptedSource(payload);
    } catch (error) {
      const normalized =
        payload.platform === "leetcode" ? normalizeLeetCodeError(error) : normalizeError(error);
      const record = makeRecord({
        status: "failed",
        platform: payload.platform,
        titleSlug: initialTitleSlug,
        problemTitle: getInitialProblemTitle(payload),
        language: getInitialLanguage(payload),
        repository: settings.selectedRepository,
        branchName: settings.selectedBranch.name,
        error: normalized,
        timestamp: now()
      });

      return recordAndBroadcast(record, target);
    }

    if (source.kind === "extract_failed") {
      const record = makeRecord({
        status: "failed",
        platform: payload.platform,
        titleSlug: source.titleSlug,
        problemTitle: source.problemTitle,
        problemFrontendId: source.problemFrontendId,
        language: source.language,
        repository: settings.selectedRepository,
        branchName: settings.selectedBranch.name,
        error: source.error,
        timestamp: now()
      });

      return recordAndBroadcast(record, target);
    }

    if (source.kind === "unsupported_language") {
      const record = makeRecord({
        status: "unsupported_language",
        platform: payload.platform,
        titleSlug: source.problem.titleSlug,
        problemTitle: source.problem.title,
        problemFrontendId: source.problem.frontendId,
        language: source.submission.language,
        repository: settings.selectedRepository,
        branchName: settings.selectedBranch.name,
        error: explicitError(
          "unsupported_language",
          `Unsupported ${payload.platform} language: ${source.submission.language}`
        ),
        timestamp: now()
      });

      return recordAndBroadcast(record, target);
    }

    const prepared = prepareCommit(
      source.problem,
      source.submission,
      source.identity,
      settings.selectedRepository,
      settings.selectedBranch
    );

    if (await options.storage.isProcessed(prepared.identity)) {
      return {
        kind: "duplicate_processed",
        identity: prepared.identity
      };
    }

    const locked = await options.storage.acquireInFlightLock(
      prepared.identity,
      now()
    );

    if (!locked) {
      return {
        kind: "duplicate_in_flight",
        identity: prepared.identity
      };
    }

    try {
      if (await options.storage.isProcessed(prepared.identity)) {
        return {
          kind: "duplicate_processed",
          identity: prepared.identity
        };
      }

      await broadcastStatus(
        makeRecord({
          status: "syncing",
          platform: prepared.identity.platform,
          titleSlug: prepared.problem.titleSlug,
          problemTitle: prepared.problem.title,
          problemFrontendId: prepared.problem.frontendId,
          language: prepared.submission.language,
          supportedLanguage: prepared.identity.language,
          identity: prepared.identity,
          repository: prepared.repository,
          branchName: prepared.branch.name,
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
        const record = makeRecord({
          status: "failed",
          platform: prepared.identity.platform,
          titleSlug: prepared.problem.titleSlug,
          problemTitle: prepared.problem.title,
          problemFrontendId: prepared.problem.frontendId,
          language: prepared.submission.language,
          supportedLanguage: prepared.identity.language,
          identity: prepared.identity,
          repository: prepared.repository,
          branchName: prepared.branch.name,
          solutionPath: prepared.solutionPath,
          error: normalized,
          timestamp: now()
        });

        return recordAndBroadcast(record, target);
      }

      const result = await commitPreparedFiles(github, prepared, files, now());
      const syncedAt = now();
      await options.storage.markProcessed(
        prepared.identity,
        {
          commitSha: result.commitSha,
          solutionPath: prepared.solutionPath
        },
        syncedAt
      );

      const record = makeRecord({
        status: "synced",
        platform: prepared.identity.platform,
        titleSlug: prepared.problem.titleSlug,
        problemTitle: prepared.problem.title,
        problemFrontendId: prepared.problem.frontendId,
        language: prepared.submission.language,
        supportedLanguage: prepared.identity.language,
        identity: prepared.identity,
        repository: result.repository,
        branchName: result.branch.name,
        solutionPath: prepared.solutionPath,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        fileUrl: result.fileUrls[prepared.solutionPath] ?? null,
        timestamp: syncedAt
      });

      return recordAndBroadcast(record, target);
    } catch (error) {
      const normalized = normalizeError(error);
      const retryPayload = makeRetryPayload(prepared, normalized, now());
      await options.storage.saveRetryPayload(retryPayload, retryPayload.createdAt);

      const record = makeRecord({
        status: "failed",
        platform: prepared.identity.platform,
        titleSlug: prepared.problem.titleSlug,
        problemTitle: prepared.problem.title,
        problemFrontendId: prepared.problem.frontendId,
        language: prepared.submission.language,
        supportedLanguage: prepared.identity.language,
        identity: prepared.identity,
        repository: prepared.repository,
        branchName: prepared.branch.name,
        solutionPath: prepared.solutionPath,
        error: normalized,
        retryPayloadId: retryPayload.id,
        timestamp: retryPayload.createdAt
      });

      return recordAndBroadcast(record, target);
    } finally {
      await options.storage.releaseInFlightLock(prepared.identity);
    }
  }

  async function resolveAcceptedSource(
    payload: AcceptedDetectedPayload
  ): Promise<ResolvedSource> {
    if (payload.platform === "leetcode") {
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
      identity: accepted.identity
    };
  }

  async function handleRetry(
    retryPayloadId: string,
    target?: SyncBroadcastTarget
  ): Promise<RetrySyncOutcome> {
    const timestamp = now();
    await options.storage.pruneRetryPayloads(timestamp);
    await options.storage.pruneInFlightLocks(timestamp);

    const payload = await options.storage.getRetryPayload(retryPayloadId);

    if (payload === null) {
      const record = makeRecord({
        status: "failed",
        titleSlug: "",
        error: explicitError("github_commit_failed", "Retry payload is missing or expired."),
        timestamp
      });
      const history = await appendAndBroadcast(record, target);

      return {
        kind: "missing_retry_payload",
        record,
        history
      };
    }

    if (await options.storage.isProcessed(payload.identity)) {
      await options.storage.removeRetryPayload(payload.id);

      return {
        kind: "duplicate_processed",
        identity: payload.identity
      };
    }

    const locked = await options.storage.acquireInFlightLock(payload.identity, now());

    if (!locked) {
      return {
        kind: "duplicate_in_flight",
        identity: payload.identity
      };
    }

    try {
      const settings = await options.storage.getSettings();

      if (settings.githubPat === null || settings.githubPat.trim().length === 0) {
        throw explicitError("github_auth_failed", "GitHub PAT is required.");
      }

      await broadcastStatus(
        makeRecord({
          status: "retrying",
          platform: payload.platform,
          titleSlug: payload.problem.titleSlug,
          problemTitle: payload.problem.title,
          problemFrontendId: payload.problem.frontendId,
          language: payload.submission.language,
          supportedLanguage: payload.identity.language,
          identity: payload.identity,
          repository: payload.repository,
          branchName: payload.branch.name,
          solutionPath: payload.solutionPath,
          retryPayloadId: payload.id,
          timestamp: now()
        }),
        null,
        target
      );

      const github = options.githubClientFactory(settings.githubPat);
      const result = await commitPrepared(github, payloadToPrepared(payload), now());
      const syncedAt = now();

      await options.storage.markProcessed(
        payload.identity,
        {
          commitSha: result.commitSha,
          solutionPath: payload.solutionPath
        },
        syncedAt
      );
      await options.storage.removeRetryPayload(payload.id);

      const record = makeRecord({
        status: "synced",
        platform: payload.platform,
        titleSlug: payload.problem.titleSlug,
        problemTitle: payload.problem.title,
        problemFrontendId: payload.problem.frontendId,
        language: payload.submission.language,
        supportedLanguage: payload.identity.language,
        identity: payload.identity,
        repository: result.repository,
        branchName: result.branch.name,
        solutionPath: payload.solutionPath,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        fileUrl: result.fileUrls[payload.solutionPath] ?? null,
        timestamp: syncedAt
      });

      return recordAndBroadcast(record, target);
    } catch (error) {
      const normalized = normalizeError(error);
      const failedPayload: RetryPayload = {
        ...payload,
        attempts: payload.attempts + 1,
        lastError: normalized
      };
      await options.storage.saveRetryPayload(failedPayload, now());

      const record = makeRecord({
        status: "failed",
        platform: payload.platform,
        titleSlug: payload.problem.titleSlug,
        problemTitle: payload.problem.title,
        problemFrontendId: payload.problem.frontendId,
        language: payload.submission.language,
        supportedLanguage: payload.identity.language,
        identity: payload.identity,
        repository: payload.repository,
        branchName: payload.branch.name,
        solutionPath: payload.solutionPath,
        error: normalized,
        retryPayloadId: payload.id,
        timestamp: now()
      });

      return recordAndBroadcast(record, target);
    } finally {
      await options.storage.releaseInFlightLock(payload.identity);
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
      owner: prepared.repository.owner,
      name: prepared.repository.name,
      repository: prepared.repository,
      branchName: prepared.branch.name,
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
    const [existingIndexText, existingReadmeText] = await Promise.all([
      readRepositoryTextFile(github, prepared, prepared.indexPath),
      readRepositoryTextFile(github, prepared, prepared.readmePath)
    ]);

    return buildCommitFiles({
      problem: prepared.problem,
      submission: prepared.submission,
      identity: prepared.identity,
      solutionPath: prepared.solutionPath,
      readmePath: prepared.readmePath,
      indexPath: prepared.indexPath,
      existingIndexText,
      existingReadmeText,
      syncedAt
    });
  }

  async function buildCommitFilesFromConflict(
    context: CommitConflictRetryContext,
    prepared: PreparedCommit,
    syncedAt: IsoDateString
  ): Promise<GitTreeFile[]> {
    const [existingIndexText, existingReadmeText] = await Promise.all([
      context.readTextFile(prepared.indexPath),
      context.readTextFile(prepared.readmePath)
    ]);

    return buildCommitFiles({
      problem: prepared.problem,
      submission: prepared.submission,
      identity: prepared.identity,
      solutionPath: prepared.solutionPath,
      readmePath: prepared.readmePath,
      indexPath: prepared.indexPath,
      existingIndexText,
      existingReadmeText,
      syncedAt
    });
  }

  async function recordAndBroadcast(
    record: SyncRecord,
    target?: SyncBroadcastTarget
  ): Promise<AcceptedSyncOutcome & RetrySyncOutcome> {
    const history = await appendAndBroadcast(record, target);

    return {
      kind: "recorded",
      record,
      history
    };
  }

  async function appendAndBroadcast(
    record: SyncRecord,
    target?: SyncBroadcastTarget
  ): Promise<SyncHistoryState> {
    const history = await options.storage.appendHistory(record);
    await broadcastStatus(record, record.error, target);
    await broadcast(
      {
        type: "history:updated",
        payload: {
          history
        }
      },
      target
    );

    return history;
  }

  async function broadcastStatus(
    record: SyncRecord,
    error: NormalizedError | null,
    target?: SyncBroadcastTarget
  ): Promise<void> {
    await broadcast(
      {
        type: "sync:status",
        payload: {
          status: record.status,
          record,
          error
        }
      },
      target
    );
  }

  function makeRecord(input: RecordInput): SyncRecord {
    const timestamp = input.timestamp ?? now();

    return {
      id: createId("record"),
      platform: input.platform ?? "leetcode",
      status: input.status,
      titleSlug: input.titleSlug,
      problemTitle: input.problemTitle ?? null,
      problemFrontendId: input.problemFrontendId ?? null,
      language: input.language ?? "",
      supportedLanguage: input.supportedLanguage ?? null,
      identity: input.identity ?? null,
      repository: input.repository ?? null,
      branchName: input.branchName ?? null,
      solutionPath: input.solutionPath ?? null,
      commitSha: input.commitSha ?? null,
      commitUrl: input.commitUrl ?? null,
      fileUrl: input.fileUrl ?? null,
      error: input.error ?? null,
      retryPayloadId: input.retryPayloadId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function makeRetryPayload(
    prepared: PreparedCommit,
    error: NormalizedError,
    createdAt: IsoDateString
  ): RetryPayload {
    return {
      id: createId("retry"),
      platform: prepared.identity.platform,
      identity: prepared.identity,
      repository: prepared.repository,
      branch: prepared.branch,
      problem: prepared.problem,
      submission: prepared.submission,
      solutionPath: prepared.solutionPath,
      readmePath: prepared.readmePath,
      indexPath: prepared.indexPath,
      commitMessage: prepared.commitMessage,
      attempts: 0,
      createdAt,
      expiresAt: addMs(createdAt, RETRY_PAYLOAD_TTL_MS),
      lastError: error
    };
  }

  return {
    handleAcceptedDetected,
    handleRetry
  };
}

function resolveProgrammersSource(
  payload: Extract<AcceptedDetectedPayload, { platform: "programmers" }>
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
  const submissionId =
    supportedLanguage === null
      ? `programmers:${lessonId}:unsupported:${codeHash}`
      : buildProgrammersSubmissionId(lessonId, supportedLanguage, codeHash);
  const problem: ProblemMetadata = {
    problemId: lessonId,
    frontendId: lessonId,
    title,
    titleSlug,
    difficulty: "-",
    url: payload.pageUrl
  };
  const submission: AcceptedSubmission = {
    submissionId,
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
    identity: {
      platform: "programmers",
      submissionId,
      titleSlug,
      language: supportedLanguage
    }
  };
}

function buildProgrammersSubmissionId(
  lessonId: string,
  language: SubmissionIdentity["language"],
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
  if (payload.platform === "leetcode") {
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
  if (payload.platform === "programmers") {
    const title = payload.problemTitle.trim();

    return title.length > 0 ? title : null;
  }

  return null;
}

function getInitialLanguage(payload: AcceptedDetectedPayload): string {
  return payload.platform === "programmers" ? payload.language : "";
}

function hasRequiredSetup(settings: {
  githubPat: string | null;
  selectedRepository: RepositoryRef | null;
  selectedBranch: BranchRef | null;
}): settings is {
  githubPat: string;
  selectedRepository: RepositoryRef;
  selectedBranch: BranchRef;
} {
  return (
    settings.githubPat !== null &&
    settings.githubPat.trim().length > 0 &&
    settings.selectedRepository !== null &&
    settings.selectedBranch !== null
  );
}

function prepareCommit(
  problem: ProblemMetadata,
  submission: AcceptedSubmission,
  identity: SubmissionIdentity,
  repository: RepositoryRef,
  branch: BranchRef
): PreparedCommit {
  const solutionPath = buildSolutionPath(identity.platform, problem, identity.language);
  const policy = getPlatformPolicy(identity.platform);

  return {
    identity,
    problem,
    submission,
    repository,
    branch,
    solutionPath,
    readmePath: policy.readmePath,
    indexPath: policy.indexPath,
    commitMessage: buildGitHubCommitMessage({
      platform: identity.platform,
      frontendId: problem.frontendId,
      title: problem.title,
      language: identity.language
    })
  };
}

function payloadToPrepared(payload: RetryPayload): PreparedCommit {
  return {
    identity: payload.identity,
    problem: payload.problem,
    submission: payload.submission,
    repository: payload.repository,
    branch: payload.branch,
    solutionPath: payload.solutionPath,
    readmePath: payload.readmePath,
    indexPath: payload.indexPath,
    commitMessage: payload.commitMessage
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
    owner: prepared.repository.owner,
    name: prepared.repository.name,
    repository: prepared.repository,
    branchName: prepared.branch.name,
    path
  });
}

function buildCommitFiles(input: CommitFilesBuildInput): GitTreeFile[] {
  const baseIndex =
    input.existingIndexText === null || input.existingIndexText.trim().length === 0
      ? createEmptyIndex()
      : parseIndexJson(input.existingIndexText);
  const nextIndex = mergeIndexEntry(
    baseIndex,
    {
      ...input.problem,
      submissionId: input.identity.submissionId,
      language: input.identity.language
    },
    input.solutionPath,
    input.syncedAt,
    toLocalDateString(input.submission.acceptedAt)
  );
  const readmeTable = renderManagedReadmeTable(nextIndex, input.identity.platform);
  const readmeContent = mergeReadmeManagedBlock(
    input.existingReadmeText,
    readmeTable,
    input.identity.platform
  );

  return buildGitTreeFiles({
    solutionPath: input.solutionPath,
    solutionContent: input.submission.code,
    readmePath: input.readmePath,
    readmeContent,
    indexPath: input.indexPath,
    index: nextIndex
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
