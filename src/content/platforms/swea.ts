/** SWEA Coding Platform Adapter.
 *
 * 전이 판정은 LeetCode와 같은 mutation 기반 무상태다. 실패 layer의 text는
 * `오답`이라는 title로 시작한다(2026-08-18/08-25 실측). Accepted layer에는 그
 * title이 없어 접두사가 겹치지 않으므로 접두사 일치로 충분하다.
 *
 * route identity가 URL이 아니라 DOM에서 온다 (ADR 0036). 모든 문제가 같은
 * URL을 쓰기 때문이다.
 *
 * 세 플랫폼 중 유일하게 code가 비동기로 온다. isolated world에서는 editor
 * state를 읽을 수 없어 MAIN world bridge를 거친다 (ADR 0035).
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
  PlatformObservation,
  PlatformObservationDocument,
  PlatformPageDocument,
  ResolvedRoute
} from "./types";

const HOSTNAME = "swexpertacademy.com";
const ACCEPTED_TEXT_PREFIX = "축하합니다. Pass입니다.";

export const SWEA_SOLVING_PATHNAME = "/main/solvingProblem/solvingProblem.do";

export interface SweaAdapterOptions {
  /** MAIN world bridge에서 editor code를 읽어온다. 주입되지 않았거나 응답이
   * 없으면 empty code가 되어 background가 실패로 기록한다. */
  requestEditorCode?(): Promise<string | null>;
}

/** fresh Accepted 시점에 동기로 읽는 값들. code만 비동기로 뒤따른다. */
interface SweaSnapshot {
  contestProbId: string;
  problemNumber: string;
  problemTitle: string;
  rawLanguage: string;
  pageUrl: string;
  detectedAt: string;
}

export function isSweaSolvingPathname(pathname: string): boolean {
  return pathname === SWEA_SOLVING_PATHNAME;
}

export function isSweaAcceptedResultText(text: string): boolean {
  const normalized = normalizeCandidateText(text);

  return (
    normalized.length > 0 &&
    normalized.length <= MAX_RESULT_TEXT_LENGTH &&
    normalized.startsWith(ACCEPTED_TEXT_PREFIX)
  );
}

export function isSweaAcceptedCandidate(candidate: TextCandidate): boolean {
  return isSweaAcceptedResultText(candidate.text);
}

/** `h3.problem_title`은 `{문제 번호}. {제목}` 형식이다.
 *
 * 번호는 파일명에, 제목은 Solution Catalog에 쓴다. 형식이 어긋나면 번호 없이
 * 전체를 제목으로 둔다. 이 경우 background가 contestProbId를 번호 자리에 쓴다.
 */
export function extractSweaProblemTitle(documentRef: PlatformPageDocument): {
  problemNumber: string;
  problemTitle: string;
} {
  const raw = normalizeCandidateText(
    documentRef.querySelector<HTMLElement>("h3.problem_title")?.textContent ?? ""
  );
  const match = raw.match(/^(\d+)\s*\.\s*(.+)$/);

  if (match === null) {
    return { problemNumber: "", problemTitle: raw };
  }

  return {
    problemNumber: match[1] ?? "",
    problemTitle: normalizeCandidateText(match[2] ?? "")
  };
}

/** SWEA 언어는 option value code(`P`/`J`/`Y`)를 우선 사용한다.
 *
 * option text에는 `gcc-10.5`, `PyPy 7.3.9` 같은 compiler version이 박혀 있어
 * SWEA가 runtime을 올리면 매핑이 깨진다. text로 되돌아갈 때는 괄호 부분을
 * 떼어낸다. */
export function extractSweaRawLanguage(documentRef: PlatformPageDocument): string {
  const select = documentRef.querySelector<HTMLSelectElement>("select#sel_lang");

  if (select === null) {
    return "";
  }

  const value = normalizeCandidateText(select.value ?? "");

  if (value.length > 0) {
    return value;
  }

  const optionText = select.selectedOptions?.[0]?.textContent ?? "";

  return normalizeCandidateText(optionText.replace(/\([^)]*\)/g, ""));
}

function readContestProbId(documentRef: PlatformPageDocument): string {
  return normalizeCandidateText(
    documentRef.querySelector<HTMLInputElement>("input#contestProbId")?.value ?? ""
  );
}

function createSignal(
  snapshot: SweaSnapshot,
  requestEditorCode: SweaAdapterOptions["requestEditorCode"]
): AcceptedSignal {
  return {
    detectedAt: snapshot.detectedAt,
    toMessage(): Promise<AcceptedDetectedMessage> {
      // bridge 실패는 전부 empty code로 수렴해야 한다. reject를 흘리면 event가
      // 조용히 사라져 사용자가 실패를 보지 못한다.
      const codePromise = (
        requestEditorCode?.() ?? Promise.resolve(null)
      ).catch(() => null);

      return codePromise.then((code) => ({
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "swea",
          contestProbId: snapshot.contestProbId,
          problemNumber: snapshot.problemNumber,
          problemTitle: snapshot.problemTitle,
          language: snapshot.rawLanguage,
          code: code ?? "",
          pageUrl: snapshot.pageUrl,
          detectedAt: snapshot.detectedAt
        }
      }));
    }
  };
}

function createObservation(
  doc: PlatformObservationDocument,
  contestProbId: string,
  options: SweaAdapterOptions
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
    detect(records, context: DetectContext) {
      if (!mutationListMatchesText(records, isSweaAcceptedCandidate)) {
        return null;
      }

      // metadata는 지금 읽는다. 나중 callback에서 DOM을 다시 읽지 않는다
      // (ADR 0034). code 요청은 억제 창을 통과한 뒤 toMessage에서 나간다.
      const problem = extractSweaProblemTitle(doc);

      return createSignal(
        {
          contestProbId,
          problemNumber: problem.problemNumber,
          problemTitle: problem.problemTitle,
          rawLanguage: extractSweaRawLanguage(doc),
          pageUrl: context.pageUrl,
          detectedAt: context.now()
        },
        options.requestEditorCode
      );
    }
  };
}

export function createSweaAdapter(options: SweaAdapterOptions = {}): PlatformAdapter {
  return {
    platform: "swea",
    resolveRoute(url: URL, doc: PlatformPageDocument): ResolvedRoute | null {
      if (url.hostname !== HOSTNAME || !isSweaSolvingPathname(url.pathname)) {
        return null;
      }

      // `#contestProbId`를 읽지 못하면 어떤 문제인지 알 수 없으므로 지원하지
      // 않는 route로 둔다.
      const contestProbId = readContestProbId(doc);

      if (contestProbId.length === 0) {
        return null;
      }

      return {
        platform: "swea",
        key: `swea:${contestProbId}`,
        observe: (observationDoc) =>
          createObservation(observationDoc, contestProbId, options)
      };
    }
  };
}
