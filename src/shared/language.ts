import type { LeetCodeLanguage, SubmissionIdentity, SupportedLanguage } from "./types";
import { isSupportedLanguage } from "./types";

export interface BuildSubmissionIdentityInput {
  submissionId: string;
  titleSlug: string;
  language: LeetCodeLanguage | SupportedLanguage | string;
}

export class UnsupportedLeetCodeLanguageError extends Error {
  readonly code = "unsupported_language";

  constructor(rawLanguage: string) {
    super(`Unsupported LeetCode language: ${rawLanguage}`);
    this.name = "UnsupportedLeetCodeLanguageError";
  }
}

export function mapLeetCodeLanguage(raw: string): SupportedLanguage | null {
  const normalized = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized === "swift") {
    return "swift";
  }

  if (normalized === "python3") {
    return "python3";
  }

  return null;
}

export function buildSubmissionIdentity(
  input: BuildSubmissionIdentityInput
): SubmissionIdentity {
  const language = isSupportedLanguage(input.language)
    ? input.language
    : mapLeetCodeLanguage(input.language);

  if (language === null) {
    throw new UnsupportedLeetCodeLanguageError(input.language);
  }

  return {
    submissionId: input.submissionId,
    titleSlug: input.titleSlug,
    language
  };
}
