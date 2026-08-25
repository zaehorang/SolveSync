/** 기준 문제 하나에 제출 결과를 캡처하는 공통 절차.
 *
 * `capture.spec.ts`(환경변수로 단발 캡처)와 SWEA 전용 로그인+연속 캡처 spec이
 * 이 절차를 공유한다. `armRecorder`는 호출자가 미리 부른다 — 같은 page에서
 * 여러 번 캡처할 때(SWEA) `runCapture`가 매번 다시 부르면 addInitScript가
 * 중복 등록된다.
 */
import type { Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CodingPlatform } from "../../src/shared";
import { BASE_PROBLEMS } from "./baseProblems";
import {
  DRIVERS,
  readDryRunSample,
  readSolution,
  type CaptureOutcome,
  type PlatformDriver
} from "./drivers";
import { findLeaks, redactRecording, registerSecrets } from "./redact";
import { resetRecording, waitForQuiet, type Recording } from "./recorder";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** 제출 후 결과 신호를 기다리는 상한. 시간 안에 신호를 못 찾으면 이 값에서
 * 멈춘다. Programmers·SWEA는 채점 완료 후 조용해지는 것으로 결과가 왔음을
 * 안다(침묵 기반). 넉넉히 둔다. */
const QUIET_TIMEOUT_MS: Record<CodingPlatform, number> = {
  // LeetCode는 판정 전이를 신호로 쓰므로 넉넉히 기다린다. 신호가 오면 즉시
  // 끝나고, 여기까지 오는 것은 판정을 못 봤다는 뜻이라 그때는 오래 기다린
  // 편이 낫다 — 짧게 끊으면 Judging 상태의 fixture가 남는다.
  leetcode: 90_000,
  programmers: 30_000,
  swea: 30_000
};

/** 판정이 recording에 이미 도착했는지 본다.
 *
 * LeetCode는 idle 상태에서도 <head> style 삽입 등 배경 잡음이 있어(실측 약
 * 30개/초) 침묵이 오지 않는다. 채점 완료 시점도 들쭉날쭉하다. 고정 시간
 * 대기 대신 판정이 실제로 뜬 뒤 짧게만 더 기다린다. */
type ResultSignal = (recording: Recording) => boolean;

/** LeetCode 판정은 **대기 text가 제자리에서 바뀌며** 온다.
 *
 * 실측(2026-08-25): `Pending...` → `Wrong Answer`가 `characterData` mutation
 * 하나로 왔다. node가 새로 추가되는 것이 아니다.
 *
 * 그래서 recording 전체를 한 문자열로 이어 붙여 단어를 찾으면 안 된다. 문제
 * page에는 `Accepted 23,208,748/40M` 같은 통계 copy가 있어 제출과 무관하게
 * `Accepted`가 이미 들어 있다. 실제로 그 방식으로 캡처했더니 판정이 오기 전에
 * 신호가 걸려 `Judging...` 상태에서 멈춘 fixture가 나왔다 — 통계 숫자를 판정으로
 * 착각한 것이다. 대기 상태에서 판정으로 넘어가는 **전이**를 본다. */
function verdictArrived(pattern: RegExp): ResultSignal {
  const waiting = /^(Pending|Judging)/;

  return (recording) =>
    recording.batches.some((batch) =>
      batch.mutations.some((mutation) => {
        if (
          mutation.type === "characterData" &&
          typeof mutation.oldValue === "string" &&
          waiting.test(mutation.oldValue.trim()) &&
          pattern.test((mutation.target.text ?? "").trim())
        ) {
          return true;
        }

        // 관찰된 경로는 characterData지만 node 추가로 오는 변형도 받아 둔다.
        // 짧은 판정 text만 인정해 본문 copy가 걸리지 않게 한다.
        return mutation.addedNodes.some((node) => {
          const text = (node.text ?? "").trim();

          return text.length > 0 && text.length <= 60 && pattern.test(text);
        });
      })
    );
}

const RESULT_SIGNAL: Partial<Record<CodingPlatform, Record<CaptureOutcome, ResultSignal>>> = {
  leetcode: {
    accepted: verdictArrived(/^Accepted\b/),
    rejected: verdictArrived(
      /^(Wrong Answer|Compile Error|Runtime Error|Time Limit Exceeded|Memory Limit Exceeded|Output Limit Exceeded)\b/
    )
  }
};

/** solution code 원문이 recording에 남았는지 본다.
 *
 * recorder가 editor 내부 mutation을 버리므로 정상적으로는 남을 수 없다.
 * 이건 그 필터가 샜을 때 조용히 통과하지 않게 하는 두 번째 문이다 — editor
 * DOM 구조가 바뀌어 selector가 빗나가면 필터는 아무 소리 없이 무력해지고,
 * 그때 남는 것이 하필 사용자 code다.
 *
 * 짧은 줄은 보지 않는다. `};`이나 `}` 같은 조각은 어느 page에나 있어 판정에
 * 쓸 수 없다. 그런 줄만으로 code를 복원할 수도 없다. */
function findCodeLeak(serialized: string, code: string): string | null {
  const distinctive = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && !line.startsWith("#") && !line.startsWith("//"));

  return distinctive.find((line) => serialized.includes(line)) ?? null;
}

/** 저장 직전에 한 번 더 본다. redaction이 새면 여기서 멈춘다.
 *
 * redaction 자체는 구조화된 상태(`redactRecording`)에서 이미 끝났다. 여기서는
 * 그 결과를 JSON으로 직렬화한 뒤 검사만 한다 — 직렬화된 텍스트에 `redactHtml`을
 * 다시 걸지 않는다. JSON의 escape된 따옴표를 raw HTML 정규식이 오해해 JSON
 * 자체를 깨뜨린 적이 있다(2026-08-24 실측). */
function sanitize<T>(value: T, code: string): T {
  const serialized = JSON.stringify(value);
  const leaks = findLeaks(serialized);

  if (leaks.length > 0) {
    throw new Error(
      `캡처에 남으면 안 되는 값이 있다 (${leaks.join(", ")}). 저장하지 않는다.`
    );
  }

  const codeLeak = findCodeLeak(serialized, code);

  if (codeLeak !== null) {
    throw new Error(
      `캡처에 solution code 원문이 남았다 (${JSON.stringify(codeLeak)}). ` +
        "recorder의 strip 대상이나 code redaction이 이 page 구조를 못 잡은 것이다. 저장하지 않는다."
    );
  }

  return value;
}

/** editor가 실제로 무엇을 들고 있는지 본다.
 *
 * Programmers의 `textarea#code`가 editor 변경 뒤에도 갱신되는지가 Phase 1의
 * 미해결 질문이다. 존재 확인만으로는 부족해서 값을 직접 잰다. code 원문은
 * 남기지 않고 길이와 줄 수만 남긴다. */
async function probeCodeSource(page: Page, expected: string) {
  return {
    expectedLines: expected.split("\n").length,
    expectedLength: expected.length,
    ...(await page.evaluate(() => {
      const textarea = document.querySelector("textarea#code");
      const value = textarea instanceof HTMLTextAreaElement ? textarea.value : null;
      const holder = document.querySelector(".CodeMirror") as
        | (Element & { CodeMirror?: { getValue(): string } })
        | null;

      // Monaco(LeetCode)는 DOM에 값을 두지 않는다. instance에서 직접 읽어야
      // editor가 무엇을 들고 있는지 알 수 있다. 이걸 읽지 않으면 LeetCode에서
      // 쓰기 검증이 통째로 비어 코드가 깨진 채 제출된다 — 실제로 컴파일되는
      // 풀이가 Compile Error로 돌아온 적이 있다(2026-08-25 실측).
      const monaco = (
        window as unknown as {
          monaco?: {
            editor: {
              getEditors(): {
                getModel(): { getValue(): string; getLanguageId(): string };
              }[];
            };
          };
        }
      ).monaco;
      const editors = monaco?.editor.getEditors() ?? [];
      // 어느 editor를 볼지는 `drivers.ts`의 `setMonacoValue`와 같은 규칙이어야
      // 한다. 다르면 쓴 곳과 읽는 곳이 어긋나 검증이 무의미해진다.
      const solution = editors.filter((e) => e.getModel().getLanguageId() !== "plaintext");
      const picked = (solution.length > 0 ? solution : editors)[0];
      const rendered = holder?.CodeMirror?.getValue() ?? picked?.getModel().getValue() ?? null;

      return {
        textareaPresent: textarea !== null,
        textareaLines: value === null ? null : value.split("\n").length,
        textareaLength: value?.length ?? null,
        editorCount: editors.length,
        editorLines: rendered === null ? null : rendered.split("\n").length,
        editorLength: rendered?.length ?? null
      };
    }))
  };
}

/** editor가 의도한 코드를 그대로 들고 있는지 확인한다. 아니면 제출하지 않는다.
 *
 * editor는 입력을 조용히 바꾼다. LeetCode Monaco는 auto-indent-on-newline이
 * 이미 들여쓴 줄마다 들여쓰기를 또 얹어 335자짜리를 841자로 불렸고, 그대로
 * 제출돼 컴파일이 깨졌다(2026-08-24 실측). 그때 이 확인이 있었으면 제출 전에
 * 멈췄을 것이다. `probeCodeSource`가 이미 값을 재고 있었지만 찍기만 했다. */
function assertEditorMatches(codeSource: Awaited<ReturnType<typeof probeCodeSource>>): void {
  const { expectedLength, expectedLines, editorLength, editorLines } = codeSource;

  if (editorLength === null) {
    // editor instance를 못 찾은 경우다. 확인할 것이 없으니 넘어간다.
    // Monaco도 CodeMirror도 없는 page라면 애초에 driver가 먼저 실패한다.
    return;
  }

  if (editorLength !== expectedLength || editorLines !== expectedLines) {
    throw new Error(
      `editor 내용이 넣으려던 코드와 다르다. ` +
        `기대 ${expectedLines}줄/${expectedLength}자, 실제 ${editorLines}줄/${editorLength}자. ` +
        `editor가 입력을 변형했을 수 있다. 제출하지 않는다.`
    );
  }
}

/** 채점 제출 전에 코드를 실행해 예제 입출력으로 판정한다.
 *
 * 제출은 비싸다 — SWEA는 제출 횟수에 상한이 있고, 로그인 세션도 실행마다
 * 다시 만들어야 한다. 그런데 SWEA 캡처는 입력 형식을 잘못 짚은 채 네 번
 * 제출해 네 번 다 Runtime Error를 받았다(2026-08-25). 결과를 보기 전에는
 * 무엇이 틀렸는지 알 방법이 없었기 때문이다. dry-run이 있으면 그 확인이
 * 제출 없이 끝난다.
 *
 * 정답 캡처는 예제와 일치해야 하고, 오답 캡처는 어긋나야 한다. 오답 코드가
 * 정답을 내면 오답 UI를 캡처할 수 없으니 그것도 실패로 본다. */
async function gateWithDryRun(
  page: Page,
  driver: PlatformDriver,
  platform: CodingPlatform,
  outcome: CaptureOutcome
): Promise<void> {
  if (driver.dryRun === undefined) {
    return;
  }

  const { input, expected: rawExpected } = await readDryRunSample(platform);
  const expected = normalizeOutput(rawExpected);
  const actual = normalizeOutput(await driver.dryRun(page, input));
  const matches = actual === expected;

  console.info(`[capture] dry-run 출력 ${matches ? "일치" : "불일치"}: ${JSON.stringify(actual)}`);

  if (outcome === "accepted") {
    if (!matches) {
      throw new Error(
        `dry-run이 예제와 다르다. 기대 ${JSON.stringify(expected)}, 실제 ${JSON.stringify(actual)}. 제출하지 않는다.`
      );
    }

    return;
  }

  if (matches) {
    throw new Error(
      "오답 캡처인데 dry-run이 정답을 냈다. 이대로 제출하면 오답 UI를 캡처할 수 없다."
    );
  }

  // 어긋나기만 해서는 부족하다. 코드가 실행 중에 죽어도 출력은 어긋난다.
  // 그건 오답이 아니라 Runtime Error고, 플랫폼은 오답 화면 대신 에러 화면을
  // 그린다 — 오답 UI 캡처가 목적인데 다른 것을 담게 된다. 답만 틀렸는지
  // 확인하려고 숫자를 지운 형태를 비교한다. 정상 출력이면 형태가 같고,
  // 에러 메시지가 나왔으면 형태부터 다르다.
  if (answerShape(actual) !== answerShape(expected)) {
    throw new Error(
      `오답 캡처인데 출력 형태가 예제와 다르다. 실제 ${JSON.stringify(actual)}. ` +
        "답만 틀린 것이 아니라 실행 자체가 실패했을 수 있다. 제출하지 않는다."
    );
  }
}

/** 실행 결과를 비교 가능한 형태로 맞춘다.
 *
 * page에서 읽어 온 출력에는 눈에 보이지 않는 문자가 섞인다. 화면에는 예제와
 * 똑같이 보이는데 문자열 비교는 실패했다(2026-08-25 실측) — HTML로 그려진
 * 출력이라 공백이 non-breaking space로 오고, 줄 끝에 여분의 공백도 붙는다.
 * 정답 판정은 값을 보자는 것이지 공백 표현을 보자는 것이 아니다. */
function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    // `\s`는 non-breaking space(U+00A0)까지 잡지만 zero-width는 빠져 있다.
    .map((line) => line.replace(/[\s\u200b\ufeff]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/** 숫자를 지운 출력 형태. 값이 아니라 모양만 비교할 때 쓴다. */
function answerShape(text: string): string {
  return normalizeOutput(text).replace(/-?\d+/g, "N");
}

/** 상태를 함께 남겨야 재생이 가능한 플랫폼이 있다.
 *
 * Programmers는 같은 modal node를 재사용해 `class` 하나만 바뀔 수 있고, 그
 * 경우 mutation record만으로는 무슨 일이 있었는지 알 수 없다. */
export const WATCH: Partial<Record<CodingPlatform, { selector: string; titleSelector: string }>> = {
  programmers: { selector: "#modal-dialog", titleSelector: ".modal-title" }
};

/** `armRecorder`를 이미 부른 page에 기준 문제를 풀고 제출해 fixture로 남긴다. */
export async function runCapture(
  page: Page,
  platform: CodingPlatform,
  outcome: CaptureOutcome
): Promise<void> {
  const problem = BASE_PROBLEMS[platform];
  const driver = DRIVERS[platform];
  const code = await readSolution(platform, outcome);

  await driver.open(page);
  console.info(`[capture] ${problem.label} — ${outcome}`);

  // 플랫폼은 제출 결과 panel에 **제출한 code를 그대로 다시 그린다**(LeetCode
  // 실측 2026-08-25). 그 panel은 판정 text가 오는 바로 그 node라 통째로 버릴
  // 수 없다. 그래서 우리가 넣은 code의 특징적인 줄을 redaction 대상으로
  // 등록해, UI 문구는 남기고 code만 지운다. 짧은 줄은 등록하지 않는다 —
  // `};` 같은 조각을 전역 치환하면 무관한 문구가 망가진다.
  registerSecrets(
    code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length >= 12),
    "solution-code"
  );

  await driver.writeSolution(page, code);
  const codeSource = await probeCodeSource(page, code);
  console.info(`[capture] code source: ${JSON.stringify(codeSource)}`);
  assertEditorMatches(codeSource);

  // 제출은 되돌릴 수 없고 SWEA는 횟수 상한까지 있다. 값싼 확인을 먼저 한다.
  await gateWithDryRun(page, driver, platform, outcome);

  // page 로딩과 코드 입력, dry-run이 만든 batch는 버린다. 제출부터 남긴다.
  await resetRecording(page);
  await driver.submit(page);
  console.info("[capture] 제출했다. 변화가 4초 이상 멎으면 저장한다.");

  // 침묵 기반 판정은 배경 잡음이 있는 page(LeetCode)에서는 성립하지
  // 않는다. timeoutMs는 "이만큼 기다렸으면 채점이 끝났을 시간"이지
  // "이 안에 반드시 조용해져야 한다"가 아니다.
  const resultSignal = RESULT_SIGNAL[platform]?.[outcome];
  const timeoutMs = QUIET_TIMEOUT_MS[platform];
  const { recording, reachedQuiet } = await waitForQuiet(page, {
    minBatches: 1,
    // signal이 있는 플랫폼은 침묵 기반 종료를 쓰지 않는다. 채점 중간에
    // DOM이 몇 초간 조용해지는 구간이 실제로 있어(polling 간격), 침묵을
    // "완료"로 착각하고 Judging 상태에서 멈춘 적이 있다(2026-08-24
    // 실측). quietMs를 timeoutMs보다 크게 둬 이 경로가 절대 먼저
    // 이기지 못하게 한다.
    quietMs: resultSignal === undefined ? 4000 : timeoutMs + 1,
    timeoutMs,
    stopWhen: resultSignal,
    settleAfterSignalMs: 2000
  });

  console.info(
    reachedQuiet
      ? "[capture] 조용해졌다."
      : "[capture] 시간 제한에 닿았다. 배경 잡음이 있는 page로 보고 지금까지 기록한 것을 저장한다."
  );

  const payload = sanitize(
    {
      platform,
      outcome,
      problem: problem.label,
      capturedAt: new Date().toISOString(),
      codeSource,
      recording: redactRecording(recording)
    },
    code
  );
  const outputDir = resolve(repoRoot, "e2e/fixtures", platform);

  await mkdir(outputDir, { recursive: true });
  // 들여쓰기를 넣지 않는다. LeetCode 캡처는 mutation이 6천 건대라 pretty-print
  // 구조 overhead만으로 파일이 두 배 넘게 불어난다(실측: 내용 1.7MB → 파일
  // 4.1MB). 사람이 raw로 읽을 크기가 아니고, 다시 캡처하면 어차피 통째로
  // 바뀌어 줄 단위 diff의 이점도 없다.
  await writeFile(resolve(outputDir, `${outcome}.json`), `${JSON.stringify(payload)}\n`, "utf8");

  console.info(
    `[capture] batch ${payload.recording.batches.length}개, dialog ${payload.recording.dialogs.length}개를 남겼다.`
  );
}
