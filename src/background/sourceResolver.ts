/**
 * Coding Platform별 Accepted source 확정.
 *
 * `CLAUDE.md`의 Project Map과 `docs/ARCHITECTURE.md`가 background의 책임으로 이미
 * "source resolver"를 부르고 있었는데 그 파일이 없었다. 역할은 `sync.ts` 안에
 * 흩어져 있었고, 그래서 orchestration이 사이트별 문구와 식별자 규칙을 알고 있었다.
 * ADR 0024는 사이트별 parsing을 adapter에 두라고 정한다.
 *
 * 여기서 만드는 `acceptedSourceId`는 Sync Deduplication Key의 구성요소이고, 이 key는
 * code가 아니라 **Accepted 이벤트 하나**를 식별한다([ADR 0041](../../docs/adr/0041-sync-deduplication-key-identifies-accepted-event.md)).
 * 공식 ID가 없는 플랫폼은 감지 시각으로 이벤트를 구분한다. 형식을 바꾸면 기존
 * 사용자의 중복 방지 상태가 통째로 무효가 되므로 형식 변경은 그 자체로 마이그레이션이다.
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
  const acceptedEventStamp = buildAcceptedEventStamp(payload.detectedAt);
  const acceptedSourceId = `programmers:${lessonId}:${
    supportedLanguage ?? "unsupported"
  }:${acceptedEventStamp}`;
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
  const acceptedEventStamp = buildAcceptedEventStamp(payload.detectedAt);
  const acceptedSourceId = `swea:${contestProbId}:${
    supportedLanguage ?? "unsupported"
  }:${acceptedEventStamp}`;
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

/**
 * `detectedAt`을 `acceptedSourceId`에 넣을 값으로 바꾼다.
 *
 * 두 성질이 필요하다. Accepted 이벤트마다 달라야 하고(그래야 같은 code를 다시
 * 제출해도 commit이 생긴다), 같은 payload를 다시 해석하면 같은 값이 나와야 한다.
 * epoch millisecond가 둘 다 만족한다. `detectedAt`은 adapter가 fresh transition을
 * 확정한 시점에 한 번 캡처한 값이라 이후 바뀌지 않는다([ADR 0034](../../docs/adr/0034-fresh-accepted-transition-and-immutable-event.md)).
 *
 * 파싱되지 않는 값이 오면 원문에서 구분자만 지워 그대로 쓴다. 형식이 덜 고르지만
 * 두 성질은 유지된다.
 */
export function buildAcceptedEventStamp(detectedAt: string): string {
  const timestamp = Date.parse(detectedAt);

  return Number.isNaN(timestamp)
    ? detectedAt.trim().replace(/[^0-9a-zA-Z]/g, "")
    : String(timestamp);
}

export function buildFilenameTitleSlug(problemNumber: string, title: string): string {
  return `${sanitizeProgrammersFilename(problemNumber)}_${sanitizeProgrammersFilename(title)}`;
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
