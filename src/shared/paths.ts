import { getLanguagePathPolicy } from "./platformPolicy";
import type { Platform, ProblemMetadata, SupportedLanguage } from "./types";
import { isSupportedLanguage } from "./types";

export function buildSolutionPath(
  problem: Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">,
  language: SupportedLanguage
): string;
export function buildSolutionPath(
  platform: Platform,
  problem: Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">,
  language: SupportedLanguage
): string;
export function buildSolutionPath(
  platformOrProblem:
    | Platform
    | Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">,
  problemOrLanguage:
    | Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">
    | SupportedLanguage,
  maybeLanguage?: SupportedLanguage
): string {
  const platform = typeof platformOrProblem === "string" ? platformOrProblem : "leetcode";
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

  const config = getLanguagePathPolicy(platform, language);
  const number = formatPlatformProblemNumber(
    platform,
    problem.frontendId || problem.problemId
  );
  const slug = formatPlatformTitleSlug(platform, problem);

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

export function formatPlatformProblemNumber(platform: Platform, raw: string): string {
  return platform === "leetcode" ? formatProblemNumber(raw) : sanitizeProgrammersFilename(raw);
}

export function formatPlatformTitleSlug(
  platform: Platform,
  problem: Pick<ProblemMetadata, "titleSlug" | "title">
): string {
  if (platform === "leetcode") {
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
