/** LeetCode Coding Platform Adapter.
 *
 * 전이 판정은 mutation 기반 무상태다. 이번 mutation이 만들어낸 Accepted만
 * 신호로 보고 화면에 이미 있는 Accepted는 보지 않는다.
 *
 * 세 플랫폼 중 유일하게 결과 text 선별 단계가 하나 더 있다. 문제 page에
 * `Acceptance Rate` 같은 일반 copy가 널려 있어 단어 일치만으로는 결과와
 * 구분되지 않는다.
 *
 * code는 DOM에서 읽지 않는다. background가 GraphQL로 조회하므로 payload에
 * route와 시각만 담는다.
 */
import type { AcceptedDetectedMessage } from "../../shared";
import {
  MAX_RESULT_TEXT_LENGTH,
  mutationListMatchesText,
  normalizeCandidateText,
  type TextCandidate
} from "../mutationText";
import type {
  AcceptedSignal,
  DetectContext,
  ObserveTarget,
  PlatformAdapter,
  PlatformObservationDocument,
  PlatformPageDocument,
  PlatformObservation,
  ResolvedRoute
} from "./types";

const EXACT_ACCEPTED_PATTERN = /^accepted$/i;
const ACCEPTED_RESULT_PATTERN =
  /\baccepted\b\s+\d+\s*\/\s*\d+\s+testcases?\s+passed\b/i;
const NON_ACCEPTED_RESULT_PATTERN =
  /\b(wrong answer|runtime error|compile error|time limit exceeded|memory limit exceeded|pending|judging|not accepted)\b/i;
const GENERIC_ACCEPTED_PAGE_TEXT_PATTERN =
  /\b(accepted submissions|accepted solutions|acceptance rate)\b/i;

const HOSTNAME = "leetcode.com";

export function extractTitleSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([^/?#]+)/);
  const slug = match?.[1]?.trim();

  return slug === undefined || slug.length === 0 ? null : decodeURIComponent(slug);
}

/** 결과 text 후보인가. 일반 page copy와 non-Accepted 결과를 먼저 걸러낸다. */
function isResultTextCandidate(text: string): boolean {
  return (
    text.length > 0 &&
    text.length <= MAX_RESULT_TEXT_LENGTH &&
    !NON_ACCEPTED_RESULT_PATTERN.test(text) &&
    !GENERIC_ACCEPTED_PAGE_TEXT_PATTERN.test(text)
  );
}

export function isAcceptedResultText(text: string): boolean {
  const normalized = normalizeCandidateText(text);

  if (!isResultTextCandidate(normalized)) {
    return false;
  }

  return (
    ACCEPTED_RESULT_PATTERN.test(normalized) || EXACT_ACCEPTED_PATTERN.test(normalized)
  );
}

/** 정확 일치 `Accepted`는 허용된 후보에서만 받는다. 짧은 단어라 page 어디에나
 * 나타날 수 있어 무조건 받으면 오탐이 된다. */
export function isLeetCodeAcceptedCandidate(candidate: TextCandidate): boolean {
  if (!isResultTextCandidate(candidate.text)) {
    return false;
  }

  if (ACCEPTED_RESULT_PATTERN.test(candidate.text)) {
    return true;
  }

  return (
    candidate.allowExactAcceptedFallback && EXACT_ACCEPTED_PATTERN.test(candidate.text)
  );
}

function createSignal(titleSlug: string, context: DetectContext): AcceptedSignal {
  const pageUrl = context.pageUrl;
  const detectedAt = context.now();

  return {
    detectedAt,
    toMessage(): AcceptedDetectedMessage {
      return {
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "leetcode",
          titleSlug,
          pageUrl,
          detectedAt
        }
      };
    }
  };
}

function createObservation(
  doc: PlatformObservationDocument,
  titleSlug: string
): PlatformObservation {
  const root = doc.body ?? doc.documentElement;
  const targets: readonly ObserveTarget[] = [
    {
      node: root,
      init: {
        childList: true,
        characterData: true,
        characterDataOldValue: true,
        subtree: true
      }
    }
  ];

  return {
    targets: () => targets,
    detect(records, context) {
      return mutationListMatchesText(records, isLeetCodeAcceptedCandidate)
        ? createSignal(titleSlug, context)
        : null;
    }
  };
}

export function createLeetCodeAdapter(): PlatformAdapter {
  return {
    platform: "leetcode",
    resolveRoute(url: URL, _doc: PlatformPageDocument): ResolvedRoute | null {
      if (url.hostname !== HOSTNAME) {
        return null;
      }

      const titleSlug = extractTitleSlugFromPathname(url.pathname);

      if (titleSlug === null) {
        return null;
      }

      return {
        platform: "leetcode",
        key: `leetcode:${titleSlug}`,
        observe: (doc) => createObservation(doc, titleSlug)
      };
    }
  };
}
