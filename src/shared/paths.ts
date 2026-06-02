import { getLanguagePathPolicy } from "./platformPolicy";
import type { CodingPlatform, ProblemMetadata, SupportedLanguage } from "./types";
import { isSupportedLanguage } from "./types";

export function buildSolutionPath(
  problem: Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">,
  language: SupportedLanguage
): string;
export function buildSolutionPath(
  codingPlatform: CodingPlatform,
  problem: Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">,
  language: SupportedLanguage
): string;
export function buildSolutionPath(
  platformOrProblem:
    | CodingPlatform
    | Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">,
  problemOrLanguage:
    | Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">
    | SupportedLanguage,
  maybeLanguage?: SupportedLanguage
): string {
  const codingPlatform =
    typeof platformOrProblem === "string" ? platformOrProblem : "leetcode";
  const problem =
    typeof platformOrProblem === "string" ? problemOrLanguage : platformOrProblem;
  const language =
    typeof platformOrProblem === "string" ? maybeLanguage : problemOrLanguage;

  if (
    typeof problem === "string" ||
    language === undefined ||
    !isSupportedLanguage(language)
  ) {
    throw new Error("Invalid solution path input.");
  }

  const config = getLanguagePathPolicy(codingPlatform, language);
  const number = formatPlatformProblemNumber(
    codingPlatform,
    problem.frontendId || problem.problemId
  );
  const slug = formatPlatformTitleSlug(codingPlatform, problem);

  return `${config.folder}/${number}_${slug}.${config.extension}`;
}

export function formatProblemNumber(raw: string): string {
  const trimmed = raw.trim();

  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(4, "0");
  }

  return slugToSnakeCase(trimmed);
}

export function slugToSnakeCase(raw: string): string {
  const sanitized = raw
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return sanitized.length > 0 ? sanitized : "solution";
}

export function formatPlatformProblemNumber(
  codingPlatform: CodingPlatform,
  raw: string
): string {
  return codingPlatform === "leetcode"
    ? formatProblemNumber(raw)
    : sanitizeProgrammersFilename(raw);
}

export function formatPlatformTitleSlug(
  codingPlatform: CodingPlatform,
  problem: Pick<ProblemMetadata, "titleSlug" | "title">
): string {
  if (codingPlatform === "leetcode") {
    return slugToSnakeCase(problem.titleSlug || problem.title);
  }

  return sanitizeProgrammersFilename(problem.title || problem.titleSlug);
}

export function sanitizeProgrammersFilename(raw: string): string {
  const sanitized = raw
    .normalize("NFC")
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return sanitized.length > 0 ? sanitized : "solution";
}
