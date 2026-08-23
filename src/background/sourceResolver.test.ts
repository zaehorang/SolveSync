/**
 * Accepted Source ID 값을 문자열 단위로 고정한다.
 *
 * 이 값은 Sync Deduplication Key의 구성요소다. 한 글자만 바뀌어도 기존 사용자의
 * 중복 방지가 깨져서 이미 동기화한 풀이가 다시 commit된다. 그래서 "동작이 같다"가
 * 아니라 "문자열이 같다"로 확인한다.
 */

import { describe, expect, it } from "vitest";

import { resolveProgrammersSource, resolveSweaSource } from "./sourceResolver";
import type {
  ProgrammersAcceptedDetectedPayload,
  SweaAcceptedDetectedPayload
} from "../shared";

const DETECTED_AT = "2026-08-23T00:00:00.000Z";
const CODE = "print(sum(map(int, input().split())))\n";

function programmersPayload(
  overrides: Partial<ProgrammersAcceptedDetectedPayload> = {}
): ProgrammersAcceptedDetectedPayload {
  return {
    codingPlatform: "programmers",
    courseId: "30",
    lessonId: "120804",
    problemTitle: "직사각형 별찍기",
    language: "python3",
    code: CODE,
    pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
    detectedAt: DETECTED_AT,
    ...overrides
  } as ProgrammersAcceptedDetectedPayload;
}

function sweaPayload(
  overrides: Partial<SweaAcceptedDetectedPayload> = {}
): SweaAcceptedDetectedPayload {
  return {
    codingPlatform: "swea",
    contestProbId: "AV134DPqAA8CFAYh",
    problemNumber: "1206",
    problemTitle: "[S/W 문제해결 기본] 1일차 - View",
    language: "Y",
    code: CODE,
    pageUrl: "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do",
    detectedAt: DETECTED_AT,
    ...overrides
  } as SweaAcceptedDetectedPayload;
}

/** commit 대상인 결과에서만 Accepted Source ID를 읽는다. */
function acceptedSourceIdOf(
  resolved: ReturnType<typeof resolveProgrammersSource | typeof resolveSweaSource>
): string {
  if (resolved.kind === "extract_failed") {
    throw new Error(`extract failed: ${resolved.error.code}`);
  }

  return resolved.submission.acceptedSourceId;
}

describe("Accepted Source ID는 문자열이 고정되어 있다", () => {
  it("Programmers는 lessonId, 지원 언어, code hash를 잇는다", () => {
    expect(acceptedSourceIdOf(resolveProgrammersSource(programmersPayload()))).toMatch(
      /^programmers:120804:python3:[0-9a-z]{7}$/
    );
  });

  it("Programmers 미지원 언어는 unsupported 자리를 쓴다", () => {
    expect(
      acceptedSourceIdOf(resolveProgrammersSource(programmersPayload({ language: "brainfuck" })))
    ).toMatch(/^programmers:120804:unsupported:[0-9a-z]{7}$/);
  });

  it("SWEA는 contestProbId, 지원 언어, code hash를 잇는다", () => {
    expect(acceptedSourceIdOf(resolveSweaSource(sweaPayload()))).toMatch(
      /^swea:AV134DPqAA8CFAYh:python3:[0-9a-z]{7}$/
    );
  });

  it("SWEA 미지원 언어는 unsupported 자리를 쓴다", () => {
    expect(acceptedSourceIdOf(resolveSweaSource(sweaPayload({ language: "Z" })))).toMatch(
      /^swea:AV134DPqAA8CFAYh:unsupported:[0-9a-z]{7}$/
    );
  });

  it("같은 code는 같은 값을, 다른 code는 다른 값을 만든다", () => {
    const first = acceptedSourceIdOf(resolveProgrammersSource(programmersPayload()));
    const again = acceptedSourceIdOf(resolveProgrammersSource(programmersPayload()));
    const changed = acceptedSourceIdOf(
      resolveProgrammersSource(programmersPayload({ code: `${CODE}# 한 줄 더\n` }))
    );

    expect(again).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("같은 문제와 언어라면 두 플랫폼의 값이 서로 섞이지 않는다", () => {
    const programmers = acceptedSourceIdOf(resolveProgrammersSource(programmersPayload()));
    const swea = acceptedSourceIdOf(resolveSweaSource(sweaPayload()));

    expect(programmers.startsWith("programmers:")).toBe(true);
    expect(swea.startsWith("swea:")).toBe(true);
  });

  it("필수 값이 없으면 commit 대상이 아니라 extract failure다", () => {
    const programmers = resolveProgrammersSource(programmersPayload({ code: "" }));
    const swea = resolveSweaSource(sweaPayload({ code: "" }));

    expect(programmers.kind).toBe("extract_failed");
    expect(swea.kind).toBe("extract_failed");
    if (programmers.kind === "extract_failed") {
      expect(programmers.error.code).toBe("programmers_extract_failed");
    }
    if (swea.kind === "extract_failed") {
      expect(swea.error.code).toBe("swea_extract_failed");
    }
  });
});
