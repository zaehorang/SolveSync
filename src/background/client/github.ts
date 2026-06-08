import { normalizeError } from "../../shared/errorNormalize";
import type { NormalizedError, NormalizedErrorCode } from "../../shared/errors";
import type { GitTreeFile } from "../../shared/githubTree";
import { getPlatformPolicy } from "../../shared/platformPolicy";
import { formatPlatformProblemNumber } from "../../shared/paths";
import type {
  SyncBranch,
  CodingPlatform,
  SyncRepository,
  SupportedLanguage
} from "../../shared/types";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_REPOSITORY_URL = "https://github.com";
const PAGE_SIZE = 100;

export type GitHubFetch = typeof fetch;

export interface GitHubClientOptions {
  pat: string;
  fetchImpl?: GitHubFetch;
  apiBaseUrl?: string;
}

export interface GitHubRepositoryInput {
  owner: string;
  name: string;
}

export interface ListRepositoriesInput {
  affiliation?: string;
}

export interface ListBranchesInput extends GitHubRepositoryInput {}

export interface CreateBranchInput extends GitHubRepositoryInput {
  branchName: string;
}

export interface TestConnectionInput extends GitHubRepositoryInput {
  branchName: string;
}

export interface ReadTextFileInput extends GitHubRepositoryInput {
  repository?: SyncRepository;
  branchName: string;
  path: string;
}

export interface TestConnectionResult {
  repository: SyncRepository;
  branch: SyncBranch;
  baseCommitSha: string;
  baseTreeSha: string;
}

export interface CommitGitDataInput extends GitHubRepositoryInput {
  repository?: SyncRepository;
  branchName: string;
  files: GitTreeFile[];
  message: string;
  onConflict?: (
    context: CommitConflictRetryContext
  ) => Promise<CommitGitDataPayload> | CommitGitDataPayload;
}

export interface CommitGitDataPayload {
  files: GitTreeFile[];
  message: string;
}

export interface CommitConflictRetryContext {
  repository: SyncRepository;
  branch: SyncBranch;
  baseCommitSha: string;
  baseTreeSha: string;
  files: GitTreeFile[];
  readTextFile(path: string): Promise<string | null>;
}

export interface CommitGitDataResult {
  repository: SyncRepository;
  branch: SyncBranch;
  baseCommitSha: string;
  baseTreeSha: string;
  commitSha: string;
  commitUrl: string;
  fileUrls: Record<string, string>;
}

export interface BuildGitHubCommitMessageInput {
  codingPlatform?: CodingPlatform;
  frontendId: string;
  title: string;
  language: SupportedLanguage;
  solutionRevisionNumber: number;
}

interface GitHubAuthContext {
  pat: string;
  fetchImpl: GitHubFetch;
  apiBaseUrl: string;
}

interface GitHubRepoResponse {
  owner: {
    login: string;
  };
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

interface GitHubBranchResponse {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

interface GitHubRefResponse {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

interface GitHubCommitResponse {
  sha: string;
  html_url?: string;
  tree: {
    sha: string;
  };
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeEntryResponse[];
  truncated?: boolean;
}

interface GitHubTreeEntryResponse {
  path?: string;
  type?: string;
  sha?: string;
}

interface GitHubBlobResponse {
  sha: string;
  content: string;
  encoding: string;
}

interface GitHubCreateBlobResponse {
  sha: string;
}

interface GitHubCreateTreeResponse {
  sha: string;
}

interface BranchBaseContext {
  repository: SyncRepository;
  branch: SyncBranch;
  baseCommitSha: string;
  baseTreeSha: string;
  tree: GitHubTreeResponse;
}

interface BlobTreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string;
}

export class GitHubHttpError extends Error {
  readonly status: number;
  readonly code?: NormalizedErrorCode;

  constructor(status: number, message: string, code?: NormalizedErrorCode) {
    super(message);
    this.name = "GitHubHttpError";
    this.status = status;
    this.code = code;
  }
}

export class GitHubClient {
  private readonly auth: GitHubAuthContext;

  constructor(options: GitHubClientOptions) {
    this.auth = {
      pat: options.pat,
      fetchImpl: options.fetchImpl ?? defaultFetch,
      apiBaseUrl: options.apiBaseUrl ?? GITHUB_API_BASE_URL
    };
  }

  async listRepositories(input: ListRepositoriesInput = {}): Promise<SyncRepository[]> {
    return this.withNormalizedErrors(async () => {
      const affiliation = input.affiliation ?? "owner";
      const repositories = await this.listPages<GitHubRepoResponse>(
        (page) =>
          `/user/repos?affiliation=${encodeURIComponent(
            affiliation
          )}&sort=full_name&direction=asc&per_page=${PAGE_SIZE}&page=${page}`
      );

      return repositories.map(toSyncRepository);
    });
  }

  async listBranches(input: ListBranchesInput): Promise<SyncBranch[]> {
    return this.withNormalizedErrors(async () => {
      const branches = await this.listPages<GitHubBranchResponse>(
        (page) =>
          `/repos/${encodePathPart(input.owner)}/${encodePathPart(
            input.name
          )}/branches?per_page=${PAGE_SIZE}&page=${page}`
      );

      return branches.map(toSyncBranch);
    });
  }

  async getRepositoryDefaultBranch(
    input: GitHubRepositoryInput
  ): Promise<{ repository: SyncRepository; branch: SyncBranch }> {
    return this.withNormalizedErrors(async () => this.getDefaultBranchHead(input));
  }

  async createBranch(input: CreateBranchInput): Promise<SyncBranch> {
    return this.withNormalizedErrors(
      async () => this.createBranchInternal(input),
      normalizeBranchCreateError
    );
  }

  async testConnection(input: TestConnectionInput): Promise<TestConnectionResult> {
    return this.withNormalizedErrors(async () => {
      const repository = await this.getRepository(input);
      const base = await this.readBranchBaseContext(repository, input.branchName);

      return {
        repository,
        branch: base.branch,
        baseCommitSha: base.baseCommitSha,
        baseTreeSha: base.baseTreeSha
      };
    });
  }

  async readTextFile(input: ReadTextFileInput): Promise<string | null> {
    return this.withNormalizedErrors(async () => {
      const repository = input.repository ?? (await this.getRepository(input));
      const base = await this.readBranchBaseContext(repository, input.branchName);

      return this.readTextFileFromTree(repository, base.tree, input.path);
    });
  }

  async commitFiles(input: CommitGitDataInput): Promise<CommitGitDataResult> {
    return this.withNormalizedErrors(async () => {
      const repository = input.repository ?? repositoryFromInput(input);
      const firstBase = await this.readBranchBaseContext(repository, input.branchName);
      const firstPayload = toCommitGitDataPayload(input);

      try {
        return await this.commitFilesOnBase(repository, input, firstBase, firstPayload);
      } catch (error) {
        if (!isRefUpdateConflict(error) || input.onConflict === undefined) {
          throw error;
        }
      }

      const latestBase = await this.readBranchBaseContext(repository, input.branchName);
      const nextPayload = await input.onConflict({
        repository,
        branch: latestBase.branch,
        baseCommitSha: latestBase.baseCommitSha,
        baseTreeSha: latestBase.baseTreeSha,
        files: input.files,
        readTextFile: async (path: string) =>
          this.readTextFileFromTree(repository, latestBase.tree, path)
      });

      return this.commitFilesOnBase(repository, input, latestBase, nextPayload);
    });
  }

  private async createBranchInternal(input: CreateBranchInput): Promise<SyncBranch> {
    const { branchName } = input;
    const { branch: defaultBranch } = await this.getDefaultBranchHead(input);

    try {
      const response = await this.request<GitHubRefResponse>(
        `/repos/${encodePathPart(input.owner)}/${encodePathPart(input.name)}/git/refs`,
        {
          method: "POST",
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: defaultBranch.sha
          })
        }
      );

      return toRefBranch(response, branchName);
    } catch (error) {
      if (!isHttpStatus(error, 422)) {
        throw error;
      }

      try {
        return await this.getBranchRef(input, branchName, "github_branch_create_failed");
      } catch {
        throw error;
      }
    }
  }

  private async getDefaultBranchHead(
    input: GitHubRepositoryInput
  ): Promise<{ repository: SyncRepository; branch: SyncBranch }> {
    const repository = await this.getRepository(input);

    if (repository.defaultBranch.trim().length === 0) {
      throw explicitNormalizedError(
        "github_default_branch_unavailable",
        "Repository default branch is empty."
      );
    }

    const branch = await this.getBranchRef(
      input,
      repository.defaultBranch,
      "github_default_branch_unavailable"
    );

    return {
      repository,
      branch
    };
  }

  private async getRepository(input: GitHubRepositoryInput): Promise<SyncRepository> {
    try {
      const response = await this.request<GitHubRepoResponse>(
        `/repos/${encodePathPart(input.owner)}/${encodePathPart(input.name)}`
      );

      return toSyncRepository(response);
    } catch (error) {
      if (isHttpStatus(error, 404)) {
        throw explicitNormalizedError(
          "github_repo_not_found",
          `Repository not found: ${input.owner}/${input.name}`
        );
      }

      throw error;
    }
  }

  private async getBranchRef(
    repository: GitHubRepositoryInput,
    branchName: string,
    missingCode: NormalizedErrorCode = "github_branch_not_found"
  ): Promise<SyncBranch> {
    try {
      const response = await this.request<GitHubRefResponse>(
        `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
          repository.name
        )}/git/ref/heads/${encodeGitRef(branchName)}`
      );

      return toRefBranch(response, branchName);
    } catch (error) {
      if (isHttpStatus(error, 404)) {
        throw explicitNormalizedError(missingCode, `Branch not found: ${branchName}`);
      }

      throw error;
    }
  }

  private async getCommit(
    repository: GitHubRepositoryInput,
    commitSha: string
  ): Promise<GitHubCommitResponse> {
    return this.request<GitHubCommitResponse>(
      `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
        repository.name
      )}/git/commits/${encodePathPart(commitSha)}`
    );
  }

  private async getTree(
    repository: GitHubRepositoryInput,
    treeSha: string
  ): Promise<GitHubTreeResponse> {
    return this.request<GitHubTreeResponse>(
      `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
        repository.name
      )}/git/trees/${encodePathPart(treeSha)}?recursive=1`
    );
  }

  private async getBlob(
    repository: GitHubRepositoryInput,
    blobSha: string
  ): Promise<GitHubBlobResponse> {
    return this.request<GitHubBlobResponse>(
      `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
        repository.name
      )}/git/blobs/${encodePathPart(blobSha)}`
    );
  }

  private async readBranchBaseContext(
    repository: SyncRepository,
    branchName: string
  ): Promise<BranchBaseContext> {
    const branch = await this.getBranchRef(repository, branchName);
    const commit = await this.getCommit(repository, branch.sha);
    const tree = await this.getTree(repository, commit.tree.sha);

    return {
      repository,
      branch,
      baseCommitSha: commit.sha,
      baseTreeSha: commit.tree.sha,
      tree
    };
  }

  private async commitFilesOnBase(
    repository: SyncRepository,
    input: Pick<CommitGitDataInput, "branchName">,
    base: BranchBaseContext,
    payload: CommitGitDataPayload
  ): Promise<CommitGitDataResult> {
    const treeEntries: BlobTreeEntry[] = [];

    for (const file of payload.files) {
      const blob = await this.createBlob(repository, file.content);
      treeEntries.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha
      });
    }

    const tree = await this.createTree(repository, base.baseTreeSha, treeEntries);
    const commit = await this.createCommit(
      repository,
      payload.message,
      tree.sha,
      base.baseCommitSha
    );

    await this.updateBranchRef(repository, input.branchName, commit.sha);

    return {
      repository,
      branch: {
        name: input.branchName,
        sha: commit.sha,
        protected: base.branch.protected
      },
      baseCommitSha: base.baseCommitSha,
      baseTreeSha: base.baseTreeSha,
      commitSha: commit.sha,
      commitUrl: commit.html_url ?? buildCommitUrl(repository, commit.sha),
      fileUrls: Object.fromEntries(
        payload.files.map((file) => [
          file.path,
          buildFileUrl(repository, input.branchName, file.path)
        ])
      )
    };
  }

  private async createBlob(
    repository: GitHubRepositoryInput,
    content: string
  ): Promise<GitHubCreateBlobResponse> {
    return this.request<GitHubCreateBlobResponse>(
      `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
        repository.name
      )}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({
          content,
          encoding: "utf-8"
        })
      }
    );
  }

  private async createTree(
    repository: GitHubRepositoryInput,
    baseTreeSha: string,
    tree: BlobTreeEntry[]
  ): Promise<GitHubCreateTreeResponse> {
    return this.request<GitHubCreateTreeResponse>(
      `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
        repository.name
      )}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree
        })
      }
    );
  }

  private async createCommit(
    repository: GitHubRepositoryInput,
    message: string,
    treeSha: string,
    parentSha: string
  ): Promise<GitHubCommitResponse> {
    return this.request<GitHubCommitResponse>(
      `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
        repository.name
      )}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message,
          tree: treeSha,
          parents: [parentSha]
        })
      }
    );
  }

  private async updateBranchRef(
    repository: GitHubRepositoryInput,
    branchName: string,
    commitSha: string
  ): Promise<GitHubRefResponse> {
    return this.request<GitHubRefResponse>(
      `/repos/${encodePathPart(repository.owner)}/${encodePathPart(
        repository.name
      )}/git/refs/heads/${encodeGitRef(branchName)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          sha: commitSha,
          force: false
        })
      }
    );
  }

  private async readTextFileFromTree(
    repository: GitHubRepositoryInput,
    tree: GitHubTreeResponse,
    path: string
  ): Promise<string | null> {
    const entry = tree.tree.find(
      (item) => item.path === path && item.type === "blob" && typeof item.sha === "string"
    );

    if (entry?.sha === undefined) {
      return null;
    }

    const blob = await this.getBlob(repository, entry.sha);

    if (blob.encoding === "base64") {
      return decodeBase64(blob.content);
    }

    if (blob.encoding === "utf-8" || blob.encoding === "utf8") {
      return blob.content;
    }

    return null;
  }

  private async listPages<T>(pathForPage: (page: number) => string): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const response = await this.rawRequest<T[]>(pathForPage(page));
      results.push(...response.data);
      hasNext = hasNextPage(response.response);
      page += 1;
    }

    return results;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.rawRequest<T>(path, init);
    return response.data;
  }

  private async rawRequest<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<{ data: T; response: Response }> {
    return githubRequest<T>(this.auth, path, init);
  }

  private async withNormalizedErrors<T>(
    operation: () => Promise<T>,
    mapper: (error: unknown) => NormalizedError = normalizeError
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw mapper(error);
    }
  }
}

const defaultFetch: GitHubFetch = (input, init) => globalThis.fetch(input, init);

function toCommitGitDataPayload(input: Pick<CommitGitDataInput, "files" | "message">): CommitGitDataPayload {
  return {
    files: input.files,
    message: input.message
  };
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  return new GitHubClient(options);
}

export function buildGitHubCommitMessage(
  input: BuildGitHubCommitMessageInput
): string {
  if (!isPositiveInteger(input.solutionRevisionNumber)) {
    throw new Error("Solution Revision Number must be a positive integer.");
  }

  const codingPlatform = input.codingPlatform ?? "leetcode";
  const policy = getPlatformPolicy(codingPlatform);

  return `solve: ${policy.commitPlatformLabel} ${formatPlatformProblemNumber(
    codingPlatform,
    input.frontendId
  )} ${toCommitTitle(input.title, codingPlatform)} in ${input.language} #${
    input.solutionRevisionNumber
  }`;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

async function githubRequest<T>(
  auth: GitHubAuthContext,
  path: string,
  init: RequestInit = {}
): Promise<{ data: T; response: Response }> {
  if (auth.pat.trim().length === 0) {
    throw explicitNormalizedError("github_auth_failed", "GitHub PAT is required.");
  }

  let response: Response;

  try {
    response = await auth.fetchImpl(buildApiUrl(auth.apiBaseUrl, path), {
      ...init,
      headers: buildHeaders(auth.pat, init)
    });
  } catch (error) {
    throw normalizeError(error);
  }

  const text = await response.text();

  if (!response.ok) {
    const message = buildRequestErrorMessage(response, path, init.method, text);
    throw new GitHubHttpError(
      response.status,
      message,
      inferResponseErrorCode(response, message)
    );
  }

  if (response.status === 204 || text.trim().length === 0) {
    return {
      data: undefined as T,
      response
    };
  }

  return {
    data: JSON.parse(text) as T,
    response
  };
}

function buildHeaders(pat: string, init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${pat}`);
  headers.set("X-GitHub-Api-Version", GITHUB_API_VERSION);

  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function buildApiUrl(apiBaseUrl: string, path: string): string {
  return new URL(path, apiBaseUrl).toString();
}

function hasNextPage(response: Response): boolean {
  const link = response.headers.get("Link");

  if (link !== null) {
    return link.split(",").some((part) => /;\s*rel="next"\s*$/u.test(part.trim()));
  }

  return false;
}

function parseErrorMessage(text: string): string | null {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (isRecord(parsed) && typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    return text;
  }

  return text;
}

function buildRequestErrorMessage(
  response: Response,
  path: string,
  method: string | undefined,
  text: string
): string {
  const requestLabel = `${(method ?? "GET").toUpperCase()} ${path}`;
  const message = parseErrorMessage(text) ?? buildHttpFallbackMessage(response);

  return `${requestLabel}: ${message}`;
}

function buildHttpFallbackMessage(response: Response): string {
  const statusText = response.statusText.trim();

  return statusText.length > 0
    ? statusText
    : `GitHub request failed with status ${response.status}.`;
}

function inferResponseErrorCode(
  response: Response,
  message: string
): NormalizedErrorCode | undefined {
  const normalizedMessage = message.toLowerCase();

  if (
    response.status === 429 ||
    response.headers.get("X-RateLimit-Remaining") === "0" ||
    normalizedMessage.includes("rate limit")
  ) {
    return "github_rate_limited";
  }

  if (response.status === 403 && normalizedMessage.includes("protected")) {
    return "github_branch_protected";
  }

  if (response.status === 401 && normalizedMessage.includes("expired")) {
    return "github_token_expired";
  }

  return undefined;
}

function normalizeBranchCreateError(error: unknown): NormalizedError {
  const normalized = normalizeError(error);

  if (
    normalized.code === "github_auth_failed" ||
    normalized.code === "github_token_expired" ||
    normalized.code === "github_rate_limited" ||
    normalized.code === "github_repo_not_found" ||
    normalized.code === "github_default_branch_unavailable"
  ) {
    return normalized;
  }

  return normalizeError({
    code: "github_branch_create_failed",
    message: normalized.debugMessage ?? normalized.userMessage
  });
}

function explicitNormalizedError(
  code: NormalizedErrorCode,
  message: string
): NormalizedError {
  return normalizeError({
    code,
    message
  });
}

function isHttpStatus(error: unknown, status: number): boolean {
  return isRecord(error) && error.status === status;
}

function isRefUpdateConflict(error: unknown): boolean {
  return isHttpStatus(error, 409) || isHttpStatus(error, 422);
}

function toSyncRepository(response: GitHubRepoResponse): SyncRepository {
  return {
    owner: response.owner.login,
    name: response.name,
    fullName: response.full_name,
    defaultBranch: response.default_branch,
    private: response.private,
    htmlUrl: response.html_url
  };
}

function repositoryFromInput(input: GitHubRepositoryInput): SyncRepository {
  return {
    owner: input.owner,
    name: input.name,
    fullName: `${input.owner}/${input.name}`,
    defaultBranch: "",
    private: false,
    htmlUrl: `${GITHUB_REPOSITORY_URL}/${encodePathPart(input.owner)}/${encodePathPart(
      input.name
    )}`
  };
}

function toSyncBranch(response: GitHubBranchResponse): SyncBranch {
  return {
    name: response.name,
    sha: response.commit.sha,
    protected: response.protected
  };
}

function toRefBranch(response: GitHubRefResponse, branchName: string): SyncBranch {
  return {
    name: branchName,
    sha: response.object.sha,
    protected: false
  };
}

function buildCommitUrl(repository: SyncRepository, commitSha: string): string {
  return `${repository.htmlUrl}/commit/${encodePathPart(commitSha)}`;
}

function buildFileUrl(repository: SyncRepository, branchName: string, path: string): string {
  return `${repository.htmlUrl}/blob/${encodePath(branchName)}/${encodePath(path)}`;
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function encodeGitRef(branchName: string): string {
  return branchName.split("/").map(encodePathPart).join("/");
}

function encodePath(path: string): string {
  return path.split("/").map(encodePathPart).join("/");
}

function toCommitTitle(title: string, platform: CodingPlatform): string {
  const normalized =
    platform === "leetcode"
      ? title
          .trim()
          .toLowerCase()
          .replace(/['"]/gu, "")
          .replace(/[^a-z0-9]+/gu, " ")
          .replace(/\s+/gu, " ")
          .trim()
      : title.normalize("NFC").trim().replace(/['"]/gu, "").replace(/\s+/gu, " ");

  const trimmed = normalized.trim();

  return trimmed.length > 0 ? trimmed : "solution";
}

function decodeBase64(content: string): string {
  const binary = globalThis.atob(content.replace(/\s+/gu, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
