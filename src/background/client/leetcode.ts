import { normalizeLeetCodeError } from "../../shared/errorNormalize";
import type { NormalizedError, NormalizedErrorCode } from "../../shared/errors";
import { mapLeetCodeLanguage } from "../../shared/language";
import type {
  AcceptedSubmission,
  IsoDateString,
  LeetCodeDifficulty,
  LeetCodeLanguage,
  ProblemMetadata,
  SyncDeduplicationKey,
  SupportedLanguage
} from "../../shared/types";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";
const LEETCODE_PROBLEM_URL = "https://leetcode.com/problems";
const ACCEPTED_STATUS_CODE = 10;
const SUBMISSION_LIST_LIMIT = 20;

const PROBLEM_METADATA_QUERY = `
query psLpSyncQuestionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    titleSlug
    difficulty
  }
}
`;

const LATEST_ACCEPTED_SUBMISSION_QUERY = `
query psLpSyncAcceptedSubmissions(
  $titleSlug: String!
  $limit: Int!
  $offset: Int!
  $status: Int!
) {
  questionSubmissionList(
    questionSlug: $titleSlug
    limit: $limit
    offset: $offset
    status: $status
  ) {
    submissions {
      id
      titleSlug
      statusDisplay
      lang
      langName
      timestamp
      isPending
    }
  }
}
`;

const SUBMISSION_DETAILS_QUERY = `
query psLpSyncSubmissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    code
    timestamp
    statusDisplay
    lang {
      name
      verboseName
    }
    question {
      titleSlug
    }
  }
}
`;

export type LeetCodeFetch = typeof fetch;

export interface LeetCodeClientOptions {
  fetchImpl?: LeetCodeFetch;
  graphqlUrl?: string;
}

export type LatestAcceptedSubmissionResult =
  | SyncableAcceptedSubmissionResult
  | UnsupportedAcceptedSubmissionResult;

export interface SyncableAcceptedSubmissionResult {
  submission: AcceptedSubmission;
  submittedAt: IsoDateString;
  supportedLanguage: SupportedLanguage;
  syncable: true;
  syncDeduplicationKey: SyncDeduplicationKey;
}

export interface UnsupportedAcceptedSubmissionResult {
  submission: AcceptedSubmission;
  submittedAt: IsoDateString;
  supportedLanguage: null;
  syncable: false;
  syncDeduplicationKey: null;
}

interface LeetCodeClientContext {
  fetchImpl: LeetCodeFetch;
  graphqlUrl: string;
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: GraphQLErrorResponse[];
}

interface GraphQLErrorResponse {
  message?: string;
}

interface ProblemMetadataGraphQLData {
  question?: unknown;
}

interface SubmissionListGraphQLData {
  questionSubmissionList?: unknown;
  submissionList?: unknown;
}

interface SubmissionDetailsGraphQLData {
  submissionDetails?: unknown;
}

interface ParsedSubmissionListItem {
  submissionId: string;
  titleSlug: string;
  language: LeetCodeLanguage;
  timestamp: unknown;
}

interface ParsedSubmissionDetails {
  titleSlug: string | null;
  language: LeetCodeLanguage | null;
  code: string;
  timestamp: unknown;
}

export class LeetCodeHttpError extends Error {
  readonly status: number;
  readonly code?: NormalizedErrorCode;

  constructor(status: number, message: string, code?: NormalizedErrorCode) {
    super(message);
    this.name = "LeetCodeHttpError";
    this.status = status;
    this.code = code;
  }
}

export class LeetCodeClient {
  private readonly context: LeetCodeClientContext;

  constructor(options: LeetCodeClientOptions = {}) {
    this.context = {
      fetchImpl: options.fetchImpl ?? defaultFetch,
      graphqlUrl: options.graphqlUrl ?? LEETCODE_GRAPHQL_URL
    };
  }

  async fetchProblemMetadata(titleSlug: string): Promise<ProblemMetadata> {
    return this.withNormalizedErrors(async () => {
      const data = await this.graphql<ProblemMetadataGraphQLData>(
        PROBLEM_METADATA_QUERY,
        { titleSlug }
      );

      return parseProblemMetadata(data, titleSlug);
    });
  }

  async fetchLatestAcceptedSubmission(
    titleSlug: string
  ): Promise<LatestAcceptedSubmissionResult> {
    return this.withNormalizedErrors(async () => {
      const listData = await this.graphql<SubmissionListGraphQLData>(
        LATEST_ACCEPTED_SUBMISSION_QUERY,
        {
          titleSlug,
          limit: SUBMISSION_LIST_LIMIT,
          offset: 0,
          status: ACCEPTED_STATUS_CODE
        }
      );
      const latest = parseLatestAcceptedListItem(listData, titleSlug);
      const detailData = await this.graphql<SubmissionDetailsGraphQLData>(
        SUBMISSION_DETAILS_QUERY,
        { submissionId: toGraphQLSubmissionId(latest.submissionId) }
      );
      const details = parseSubmissionDetails(detailData);
      const language = details.language ?? latest.language;
      const submittedAt = toIsoDateString(details.timestamp ?? latest.timestamp);
      const submissionTitleSlug = details.titleSlug ?? latest.titleSlug;
      const submission: AcceptedSubmission = {
        acceptedSourceId: latest.submissionId,
        titleSlug: submissionTitleSlug,
        language,
        code: details.code,
        acceptedAt: submittedAt
      };
      const supportedLanguage = mapLeetCodeLanguage(language);

      if (supportedLanguage === null) {
        return {
          submission,
          submittedAt,
          supportedLanguage,
          syncable: false,
          syncDeduplicationKey: null
        };
      }

      return {
        submission,
        submittedAt,
        supportedLanguage,
        syncable: true,
        syncDeduplicationKey: {
          codingPlatform: "leetcode",
          acceptedSourceId: submission.acceptedSourceId,
          titleSlug: submission.titleSlug,
          language: supportedLanguage
        }
      };
    });
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    let response: Response;

    try {
      response = await this.context.fetchImpl(this.context.graphqlUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          variables
        })
      });
    } catch (error) {
      throw normalizeLeetCodeError(error);
    }

    const text = await response.text();

    if (!response.ok) {
      throw new LeetCodeHttpError(
        response.status,
        parseErrorMessage(text) ?? response.statusText,
        inferLeetCodeResponseErrorCode(response)
      );
    }

    const parsed = parseJson(text);

    if (!isRecord(parsed)) {
      throw explicitNormalizedError(
        "leetcode_fetch_failed",
        "LeetCode GraphQL response is not an object."
      );
    }

    const graphQLResponse = parsed as GraphQLResponse<T>;
    if (Array.isArray(graphQLResponse.errors) && graphQLResponse.errors.length > 0) {
      const message = graphQLResponse.errors
        .map((error) => error.message)
        .filter((message): message is string => typeof message === "string")
        .join("; ");

      throw explicitNormalizedError(
        isAuthLikeMessage(message) ? "leetcode_auth_required" : "leetcode_fetch_failed",
        message.length > 0 ? message : "LeetCode GraphQL returned errors."
      );
    }

    if (graphQLResponse.data === undefined || graphQLResponse.data === null) {
      throw explicitNormalizedError(
        "leetcode_fetch_failed",
        "LeetCode GraphQL response is missing data."
      );
    }

    return graphQLResponse.data;
  }

  private async withNormalizedErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw normalizeLeetCodeError(error);
    }
  }
}

const defaultFetch: LeetCodeFetch = (input, init) => globalThis.fetch(input, init);

export function createLeetCodeClient(
  options: LeetCodeClientOptions = {}
): LeetCodeClient {
  return new LeetCodeClient(options);
}

export async function fetchProblemMetadata(
  titleSlug: string,
  options: LeetCodeClientOptions = {}
): Promise<ProblemMetadata> {
  return createLeetCodeClient(options).fetchProblemMetadata(titleSlug);
}

export async function fetchLatestAcceptedSubmission(
  titleSlug: string,
  options: LeetCodeClientOptions = {}
): Promise<LatestAcceptedSubmissionResult> {
  return createLeetCodeClient(options).fetchLatestAcceptedSubmission(titleSlug);
}

function parseProblemMetadata(
  data: ProblemMetadataGraphQLData,
  requestedTitleSlug: string
): ProblemMetadata {
  const question = data.question;

  if (!isRecord(question)) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      `LeetCode problem metadata is missing for ${requestedTitleSlug}.`
    );
  }

  const titleSlug = readRequiredString(question, "titleSlug");

  return {
    problemId: readRequiredString(question, "questionId"),
    frontendId: readRequiredString(question, "questionFrontendId"),
    title: readRequiredString(question, "title"),
    titleSlug,
    difficulty: readRequiredString(question, "difficulty") as LeetCodeDifficulty,
    url: buildProblemUrl(titleSlug)
  };
}

function parseLatestAcceptedListItem(
  data: SubmissionListGraphQLData,
  requestedTitleSlug: string
): ParsedSubmissionListItem {
  const listContainer = data.questionSubmissionList ?? data.submissionList;

  if (!isRecord(listContainer) || !Array.isArray(listContainer.submissions)) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      "LeetCode accepted submission list is malformed."
    );
  }

  for (const item of listContainer.submissions) {
    if (!isRecord(item) || item.isPending === true) {
      continue;
    }

    if (
      typeof item.statusDisplay === "string" &&
      item.statusDisplay.trim().toLowerCase() !== "accepted"
    ) {
      continue;
    }

    const submissionId = readRequiredString(item, "id");
    const language = readLanguage(item);

    return {
      submissionId,
      titleSlug:
        typeof item.titleSlug === "string" && item.titleSlug.trim().length > 0
          ? item.titleSlug
          : requestedTitleSlug,
      language,
      timestamp: item.timestamp
    };
  }

  throw explicitNormalizedError(
    "leetcode_fetch_failed",
    `No latest accepted submission found for ${requestedTitleSlug}.`
  );
}

function parseSubmissionDetails(
  data: SubmissionDetailsGraphQLData
): ParsedSubmissionDetails {
  const details = data.submissionDetails;

  if (!isRecord(details)) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      "LeetCode submission details are missing."
    );
  }

  const code = readRequiredString(details, "code");
  if (code.trim().length === 0) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      "LeetCode accepted submission code is missing."
    );
  }

  const question = details.question;
  const titleSlug =
    isRecord(question) && typeof question.titleSlug === "string"
      ? question.titleSlug
      : null;

  return {
    titleSlug,
    language: readOptionalLanguage(details),
    code,
    timestamp: details.timestamp
  };
}

function readLanguage(record: Record<string, unknown>): LeetCodeLanguage {
  const language = readOptionalLanguage(record);

  if (language === null) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      "LeetCode submission language is missing."
    );
  }

  return language;
}

function readOptionalLanguage(record: Record<string, unknown>): LeetCodeLanguage | null {
  const candidates: unknown[] = [];
  const lang = record.lang;

  if (isRecord(lang)) {
    candidates.push(lang.verboseName, lang.name);
  } else {
    candidates.push(lang);
  }

  candidates.push(record.langName, record.language);

  const language = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  );

  return language === undefined ? null : (language as LeetCodeLanguage);
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      `LeetCode response is missing ${key}.`
    );
  }

  return value;
}

function toGraphQLSubmissionId(value: string): number {
  const submissionId = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(submissionId) || submissionId <= 0) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      `LeetCode submission id is malformed: ${value}`
    );
  }

  return submissionId;
}

function toIsoDateString(value: unknown): IsoDateString {
  let date: Date;

  if (typeof value === "number") {
    date = new Date(toTimestampMs(value));
  } else if (typeof value === "string" && value.trim().length > 0) {
    const numericValue = Number(value);
    date = Number.isFinite(numericValue)
      ? new Date(toTimestampMs(numericValue))
      : new Date(value);
  } else {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      "LeetCode submission timestamp is missing."
    );
  }

  if (Number.isNaN(date.getTime())) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      "LeetCode submission timestamp is malformed."
    );
  }

  return date.toISOString();
}

function toTimestampMs(value: number): number {
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw explicitNormalizedError(
      "leetcode_fetch_failed",
      error instanceof Error ? error.message : "LeetCode response JSON is malformed."
    );
  }
}

function parseErrorMessage(text: string): string | null {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (isRecord(parsed)) {
      if (typeof parsed.message === "string") {
        return parsed.message;
      }

      if (Array.isArray(parsed.errors)) {
        const message = parsed.errors
          .map((error) =>
            isRecord(error) && typeof error.message === "string"
              ? error.message
              : null
          )
          .filter((message): message is string => message !== null)
          .join("; ");

        return message.length > 0 ? message : null;
      }
    }
  } catch {
    return text;
  }

  return text;
}

function inferLeetCodeResponseErrorCode(
  response: Response
): NormalizedErrorCode | undefined {
  if (response.status === 401 || response.status === 403) {
    return "leetcode_auth_required";
  }

  return undefined;
}

function explicitNormalizedError(
  code: NormalizedErrorCode,
  message: string
): NormalizedError {
  return normalizeLeetCodeError({
    code,
    message
  });
}

function isAuthLikeMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("login") ||
    normalized.includes("auth") ||
    normalized.includes("csrf")
  );
}

function buildProblemUrl(titleSlug: string): string {
  return `${LEETCODE_PROBLEM_URL}/${encodeURIComponent(titleSlug)}/`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
