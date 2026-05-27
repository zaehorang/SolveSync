import type { ProblemMetadata, SupportedLanguage } from "./types";

const LANGUAGE_PATH_CONFIG = {
  swift: {
    directory: "leetcode/swift",
    extension: "swift"
  },
  python3: {
    directory: "leetcode/python",
    extension: "py"
  }
} as const satisfies Record<SupportedLanguage, { directory: string; extension: string }>;

export function buildSolutionPath(
  problem: Pick<ProblemMetadata, "frontendId" | "problemId" | "titleSlug" | "title">,
  language: SupportedLanguage
): string {
  const config = LANGUAGE_PATH_CONFIG[language];
  const number = formatProblemNumber(problem.frontendId || problem.problemId);
  const slug = slugToSnakeCase(problem.titleSlug || problem.title);

  return `${config.directory}/${number}_${slug}.${config.extension}`;
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
