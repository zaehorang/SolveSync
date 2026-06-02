import type {
  CodingPlatform,
  LeetCodeLanguage,
  SyncDeduplicationKey,
  SupportedLanguage
} from "./types";
import { isSupportedLanguage } from "./types";

export interface BuildSyncDeduplicationKeyInput {
  codingPlatform?: CodingPlatform;
  acceptedSourceId: string;
  titleSlug: string;
  language: LeetCodeLanguage | SupportedLanguage | string;
}

export class UnsupportedLanguageError extends Error {
  readonly code = "unsupported_language";

  constructor(rawLanguage: string) {
    super(`Unsupported language: ${rawLanguage}`);
    this.name = "UnsupportedLanguageError";
  }
}

export class UnsupportedLeetCodeLanguageError extends Error {
  readonly code = "unsupported_language";

  constructor(rawLanguage: string) {
    super(`Unsupported LeetCode language: ${rawLanguage}`);
    this.name = "UnsupportedLeetCodeLanguageError";
  }
}

export function mapLeetCodeLanguage(raw: string): SupportedLanguage | null {
  return mapSupportedLanguage(raw);
}

export function mapProgrammersLanguage(raw: string): SupportedLanguage | null {
  return mapSupportedLanguage(raw);
}

export function mapSupportedLanguage(raw: string): SupportedLanguage | null {
  const normalized = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized === "swift") {
    return "swift";
  }

  if (normalized === "python3") {
    return "python3";
  }

  return null;
}

export function buildSyncDeduplicationKey(
  input: BuildSyncDeduplicationKeyInput
): SyncDeduplicationKey {
  const language = isSupportedLanguage(input.language)
    ? input.language
    : mapSupportedLanguage(input.language);

  if (language === null) {
    throw new UnsupportedLeetCodeLanguageError(input.language);
  }

  return {
    codingPlatform: input.codingPlatform ?? "leetcode",
    acceptedSourceId: input.acceptedSourceId,
    titleSlug: input.titleSlug,
    language
  };
}
