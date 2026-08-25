/** 플랫폼별 제출 driver.
 *
 * selector는 전부 2026-08-24에 실제 page를 열어 확인한 것이다. 추측한
 * selector를 코드에 박는 것이 이 계층이 없애려는 문제 그 자체이므로, 여기
 * 있는 값을 바꿀 때는 반드시 실제 page에서 다시 확인한다.
 *
 * editor에 코드를 넣을 때 `keyboard.type`을 쓰지 않는다. Monaco와 CodeMirror는
 * 괄호 자동 완성과 자동 들여쓰기를 하므로 한 글자씩 치면 코드가 망가진다.
 * `insertText`는 keystroke을 흉내내지 않고 input event를 직접 넣어 두 기능을
 * 모두 우회한다.
 */
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CodingPlatform } from "../../src/shared";
import { BASE_PROBLEMS } from "./baseProblems";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export type CaptureOutcome = "accepted" | "rejected";

export interface PlatformDriver {
  /** 기준 문제 page로 이동하고 editor가 뜰 때까지 기다린다. */
  open(page: Page): Promise<void>;
  /** editor 내용을 통째로 교체한다. */
  writeSolution(page: Page, code: string): Promise<void>;
  /** 채점 제출을 누른다. 결과를 기다리지 않는다 — recorder가 관찰한다. */
  submit(page: Page): Promise<void>;
  /** 제출 코드 파일 확장자. 플랫폼 기본 언어에 맞춘다. */
  readonly extension: string;
  /** 채점 제출을 쓰지 않고 코드를 실행해 본다. 지원하는 플랫폼만 구현한다.
   *
   * 예제 입력에 대한 출력을 그대로 돌려준다. 판정은 호출자가 한다 — 정답
   * 캡처는 일치를, 오답 캡처는 불일치를 기대하므로 driver가 정할 일이 아니다. */
  dryRun?(page: Page, input: string): Promise<string>;
}

/** 신규 사용자에게 뜨는 bootstrap-tour 안내 popover를 닫는다.
 *
 * `#step-0`의 `svg[data-role="end"]`가 닫기 버튼이다 (2026-08-24 실측). editor
 * 위에 겹쳐 떠서 click actionability 검사를 영원히 막는다 — capture가 여기서
 * 타임아웃까지 통째로 멈췄었다. 첫 방문에만 뜨므로 없으면 조용히 지나간다. */
async function dismissProgrammersTour(page: Page): Promise<void> {
  const closeButton = page.locator('#step-0 svg[data-role="end"]');

  if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeButton.click();
  }
}

/** Monaco의 model에 직접 값을 넣는다.
 *
 * `keyboard.insertText`로 Monaco에 코드를 넣으면 auto-indent-on-newline이
 * 우리가 이미 들여쓴 줄마다 또 들여쓰기를 얹는다. 원본 335자가 841자로
 * 불어나고 중첩이 깊을수록 더 벌어졌다(2026-08-24 실측) — 컴파일이 실패한
 * 원인이었다. LeetCode page는 `window.monaco`를 전역에 노출하므로 model에
 * 직접 `setValue()`해서 입력 파이프라인을 완전히 우회한다. 이러면 auto-indent도
 * auto-close-bracket도 거치지 않는다. */
async function setMonacoValue(page: Page, code: string): Promise<void> {
  // **한 번 쓰고 끝내지 않는다.** LeetCode는 page가 뜬 뒤에도 저장해 둔 직전
  // 풀이를 editor에 복원한다. 그 복원이 우리가 쓴 값보다 늦게 오면 editor는
  // 조용히 예전 code로 돌아간다 — 335자를 넣었는데 예전 실행이 남긴 841자가
  // 그대로 제출 직전까지 남아 있었다(2026-08-25 실측). 써 넣고 잠시 뒤
  // 되읽어, 값이 유지될 때까지 다시 쓴다.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await writeMonacoValue(page, code);
    await page.waitForTimeout(1500);

    if ((await readMonacoValue(page)) === code) {
      return;
    }
  }

  throw new Error(
    "Monaco editor에 코드를 고정하지 못했다. page가 저장된 풀이로 계속 되돌리고 있다."
  );
}

async function readMonacoValue(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const monaco = (
      window as unknown as {
        monaco?: {
          editor: {
            getEditors(): { getModel(): { getValue(): string; getLanguageId(): string } }[];
          };
        };
      }
    ).monaco;
    const editors = monaco?.editor.getEditors() ?? [];
    const solution = editors.filter((e) => e.getModel().getLanguageId() !== "plaintext");

    return (solution.length > 0 ? solution : editors)[0]?.getModel().getValue() ?? null;
  });
}

async function writeMonacoValue(page: Page, code: string): Promise<void> {
  const applied = await page.evaluate((value) => {
    const monaco = (
      window as unknown as {
        monaco?: {
          editor: {
            getEditors(): {
              getModel(): { setValue(v: string): void; getLanguageId(): string };
            }[];
          };
        };
      }
    ).monaco;

    if (monaco === undefined) {
      return false;
    }

    const editors = monaco.editor.getEditors();

    if (editors.length === 0) {
      return false;
    }

    // **`[0]`을 쓰지 않는다.** LeetCode page에는 Monaco instance가 둘 있다
    // (실측 2026-08-25). 순서는 보장되지 않고, 크기로 고르는 것도 안 된다 —
    // page 로드 직후에는 아직 배치되지 않아 25px과 0px로 나온다. 실제로 크기
    // 기준이 엉뚱한 editor를 골라 이전 코드가 그대로 제출됐다.
    //
    // 구분자는 language다. 풀이 editor의 model은 선택한 언어(`cpp` 등)이고,
    // 다른 하나는 테스트케이스 입력이라 `plaintext`다.
    const pick = (list: typeof editors) => {
      const solution = list.filter((editor) => editor.getModel().getLanguageId() !== "plaintext");

      return (solution.length > 0 ? solution : list)[0];
    };

    pick(editors).getModel().setValue(value);
    return true;
  }, code);

  if (!applied) {
    throw new Error("window.monaco를 찾지 못했다. LeetCode page 구조가 바뀌었을 수 있다.");
  }
}

/** editor를 focus하고 전체 선택한 뒤 한 번에 넣는다.
 *
 * Monaco와 CodeMirror 모두 실제 입력을 받는 `textarea`를 화면에 보이지 않게
 * (0px 근처로) 숨겨 둔다. 그 textarea를 직접 클릭 대상으로 삼으면 Playwright의
 * actionability 검사(visible + stable)가 통과하지 못해 timeout까지 그대로
 * 멈춘다 — 실제로 Programmers 캡처가 여기서 멈췄었다. 대신 눈에 보이는
 * editor container를 클릭한다. 두 editor 모두 container 클릭이 숨은 textarea로
 * focus를 넘긴다. CodeMirror를 쓰는 SWEA도 마찬가지다. */
async function replaceEditorText(page: Page, containerSelector: string, code: string): Promise<void> {
  await page.locator(containerSelector).first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(code);
}

const leetcode: PlatformDriver = {
  extension: "cpp",
  async open(page) {
    await page.goto(BASE_PROBLEMS.leetcode.url, { waitUntil: "domcontentloaded" });
    await page.locator(".monaco-editor").first().waitFor({ state: "visible", timeout: 60_000 });
  },
  async writeSolution(page, code) {
    await setMonacoValue(page, code);
  },
  async submit(page) {
    // id가 없다. 접근성 이름으로 잡는다.
    await page.getByRole("button", { name: "Submit", exact: true }).click();
  }
};

const programmers: PlatformDriver = {
  extension: "swift",
  async open(page) {
    await page.goto(BASE_PROBLEMS.programmers.url, { waitUntil: "domcontentloaded" });
    await page.locator(".CodeMirror").first().waitFor({ state: "visible", timeout: 60_000 });
    await dismissProgrammersTour(page);
  },
  async writeSolution(page, code) {
    await replaceEditorText(page, ".CodeMirror", code);
  },
  async submit(page) {
    await page.locator("#submit-code").click();
  }
};

const swea: PlatformDriver = {
  extension: "py",
  async open(page) {
    await page.goto(BASE_PROBLEMS.swea.url, { waitUntil: "domcontentloaded" });
    await page.locator(".CodeMirror").first().waitFor({ state: "visible", timeout: 60_000 });
  },
  async writeSolution(page, code) {
    // CodeMirror는 Monaco와 달리 `insertText` 한 방에 들여쓰기를 건드리지
    // 않는다. 직전 제출 코드가 editor에 남아 있는 것을 실측했는데 253자
    // 13줄로 원본 파일과 정확히 일치했다(2026-08-25). Python은 들여쓰기가
    // 문법이라 여기가 틀어지면 곧바로 Runtime Error가 되므로 확인해 뒀다.
    await replaceEditorText(page, ".CodeMirror", code);
  },
  async dryRun(page, input) {
    // 문제 page의 TEST 영역이다. page 안내문 그대로 "Test는 채점을 하는 것이
    // 아니며 정답 여부를 알려주지 않습니다" — 제출 횟수를 쓰지 않는다.
    // SWEA는 제출 횟수에 상한이 있어(page에 `제출횟수 11 / 99`로 표시된다)
    // 틀린 코드를 제출로 확인하는 것이 실제로 비싸다. (2026-08-25 실측)
    await page.locator("#scs_input").fill(input);

    await page.locator("#scs_output").evaluate((element) => {
      element.replaceChildren();
    });

    // Run에는 id가 없다. `onclick="return onRun();"`이고 text로만 구분된다.
    // role로 잡지 않는다 — `href`가 없는 `a`는 link role을 갖지 않는다.
    await page.locator("a").filter({ hasText: /^Run$/ }).first().click();

    // 출력은 `li` 목록으로 쌓이고 종류가 셋이다(2026-08-25 실측).
    //   `li.message`   진행 로그("성공적으로 컴파일 되었습니다" 등)
    //   `li.print_msg` 프로그램 표준출력
    //   `li.error_msg` 컴파일 오류·Runtime error
    // 끝났는지는 오류가 떴거나 완료 로그가 떴는지로 본다. 단순히 비어 있지
    // 않은지만 보면 "실행을 시작합니다"가 뜬 시점에 먼저 걸려 버린다.
    await page
      .locator('#scs_output li.error_msg, #scs_output li.message:has-text("실행이 완료")')
      .first()
      .waitFor({ state: "attached", timeout: 60_000 });

    const errors = await page.locator("#scs_output li.error_msg").allInnerTexts();

    if (errors.length > 0) {
      // 호출자가 예제와 대조해 막는다. 여기서 판정하지 않는다.
      return errors.join("\n").trim();
    }

    // 줄바꿈이 `<br>`이라 textContent는 줄을 뭉갠다 — innerText여야 한다.
    // 목록은 최신이 위로 쌓이므로 시간순으로 되돌린다.
    const printed = await page.locator("#scs_output li.print_msg span.text").allInnerTexts();

    return printed.reverse().join("").trim();
  },
  async submit(page) {
    // id가 있다. `onclick="return onEditSubmit();"` (2026-08-25 실측,
    // 로그인 세션 필요 — 비로그인 상태에서는 문제 page 자체가 로그인
    // page로 튕겨 확인할 수 없었다).
    await page.locator("#btnf_proposal").click();

    // 네이티브 confirm이 아니라 page가 직접 그리는 popup이다("제출 가능
    // 횟수가 1회 감소합니다. 정말로 제출하시겠습니까?"). recorder의
    // `page.on("dialog")` auto-accept는 네이티브 dialog만 잡으므로 이건
    // 걸리지 않는다 — 실제로 이 팝업만 뜨고 실제 제출은 안 된 채로 캡처가
    // 끝난 적이 있다(2026-08-25 실측). `확인`을 직접 눌러야 한다.
    await page.locator(".popup_layer.show .btn_blue").click();
  }
};

export const DRIVERS: Record<CodingPlatform, PlatformDriver> = {
  leetcode,
  programmers,
  swea
};

export async function readSolution(
  platform: CodingPlatform,
  outcome: CaptureOutcome
): Promise<string> {
  const { extension } = DRIVERS[platform];
  const path = resolve(repoRoot, "e2e/fixtures/solutions", `${platform}.${outcome}.${extension}`);

  return readFile(path, "utf8");
}

export interface DryRunSample {
  readonly input: string;
  /** 정답 코드가 내야 하는 출력. 문제 page가 예제로 제시한 값이다. */
  readonly expected: string;
}

/** dry-run에 쓸 예제 입출력. `dryRun`을 구현한 플랫폼만 갖는다. */
export async function readDryRunSample(platform: CodingPlatform): Promise<DryRunSample> {
  const base = resolve(repoRoot, "e2e/fixtures/solutions", platform);
  const [input, expected] = await Promise.all([
    readFile(`${base}.sample.txt`, "utf8"),
    readFile(`${base}.sample.out`, "utf8")
  ]);

  return { input, expected: expected.trim() };
}
