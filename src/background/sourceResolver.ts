/**
 * Coding Platform별 Accepted source 확정.
 *
 * `CLAUDE.md`의 Project Map과 `docs/ARCHITECTURE.md`가 background의 책임으로 이미
 * "source resolver"를 부르고 있었는데 그 파일이 없었다. 역할은 `sync.ts` 안에
 * 흩어져 있었고, 그래서 orchestration이 사이트별 문구와 식별자 규칙을 알고 있었다.
 * ADR 0024는 사이트별 parsing을 adapter에 두라고 정한다.
 *
 * 여기서 만드는 `acceptedSourceId`는 Sync Deduplication Key의 구성요소다. 형식을
 * 바꾸면 기존 사용자의 중복 방지가 깨져 이미 동기화한 풀이가 다시 commit된다.
 * 형식 변경은 그 자체로 마이그레이션이다.
 */

import {
  sanitizeProgrammersFilename
} from "../shared/paths";
import {
  mapProgrammersLanguage,
  mapSweaLanguage
} from "../shared/language";
import type {
  AcceptedSubmission,
  LeetCodeLanguage,
  ProblemMetadata,
  SyncDeduplicationKey
} from "../shared/types";
import type {
  AcceptedDetectedPayload
} from "../shared/messages";

import type { NormalizedError, NormalizedErrorCode } from "../shared/errors";

import { normalizeError } from "../shared/errorNormalize";

export type ResolvedSource =
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

export function explicitError(code: NormalizedErrorCode, message: string): NormalizedError {
  return normalizeError({
    code,
    message
  });
}

export function resolveProgrammersSource(
  payload: Extract<AcceptedDetectedPayload, { codingPlatform: "programmers" }>
): ResolvedSource {
  const lessonId = payload.lessonId.trim();
  const title = payload.problemTitle.trim();
  const language = payload.language.trim();
  const code = payload.code;
  const titleSlug =
    lessonId.length > 0 && title.length > 0
      ? buildFilenameTitleSlug(lessonId, title)
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
        "Programmers accepted source is missing lesson id, title, language, or code."
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

export function resolveSweaSource(
  payload: Extract<AcceptedDetectedPayload, { codingPlatform: "swea" }>
): ResolvedSource {
  const contestProbId = payload.contestProbId.trim();
  const title = payload.problemTitle.trim();
  const language = payload.language.trim();
  const code = payload.code;
  // 파일명에는 사람이 읽는 문제 번호를 쓰고, 식별은 contestProbId로 한다.
  // 번호를 읽지 못하면 식별자로 되돌아간다.
  const frontendId =
    payload.problemNumber.trim().length > 0
      ? payload.problemNumber.trim()
      : contestProbId;
  const titleSlug =
    frontendId.length > 0 && title.length > 0
      ? buildFilenameTitleSlug(frontendId, title)
      : getInitialTitleSlug(payload);

  if (
    contestProbId.length === 0 ||
    title.length === 0 ||
    language.length === 0 ||
    code.trim().length === 0
  ) {
    return {
      kind: "extract_failed",
      titleSlug,
      problemTitle: title.length > 0 ? title : null,
      problemFrontendId: frontendId.length > 0 ? frontendId : null,
      language,
      error: explicitError(
        "swea_extract_failed",
        "SWEA accepted source is missing contest problem id, title, language, or code."
      )
    };
  }

  const supportedLanguage = mapSweaLanguage(language);
  const codeHash = buildShortCodeHash(code);
  const acceptedSourceId =
    supportedLanguage === null
      ? `swea:${contestProbId}:unsupported:${codeHash}`
      : `swea:${contestProbId}:${supportedLanguage}:${codeHash}`;
  const problem: ProblemMetadata = {
    problemId: contestProbId,
    frontendId,
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
      codingPlatform: "swea",
      acceptedSourceId,
      titleSlug,
      language: supportedLanguage
    }
  };
}

export function buildProgrammersAcceptedSourceId(
  lessonId: string,
  language: SyncDeduplicationKey["language"],
  codeHash: string
): string {
  return `programmers:${lessonId}:${language}:${codeHash}`;
}

export function buildFilenameTitleSlug(problemNumber: string, title: string): string {
  return `${sanitizeProgrammersFilename(problemNumber)}_${sanitizeProgrammersFilename(title)}`;
}

export function buildShortCodeHash(code: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function getInitialTitleSlug(payload: AcceptedDetectedPayload): string {
  if (payload.codingPlatform === "leetcode") {
    return payload.titleSlug;
  }

  const problemNumber =
    payload.codingPlatform === "programmers"
      ? payload.lessonId.trim()
      : payload.problemNumber.trim() || payload.contestProbId.trim();
  const title = payload.problemTitle.trim();

  if (problemNumber.length > 0 && title.length > 0) {
    return buildFilenameTitleSlug(problemNumber, title);
  }

  if (problemNumber.length > 0) {
    return sanitizeProgrammersFilename(problemNumber);
  }

  return payload.codingPlatform;
}

export function getInitialProblemTitle(payload: AcceptedDetectedPayload): string | null {
  if (payload.codingPlatform === "leetcode") {
    return null;
  }

  const title = payload.problemTitle.trim();

  return title.length > 0 ? title : null;
}

export function getInitialLanguage(payload: AcceptedDetectedPayload): string {
  return payload.codingPlatform === "leetcode" ? "" : payload.language;
}
