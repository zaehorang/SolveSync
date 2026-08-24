/** 캡처 실행기.
 *
 * ```bash
 * CAPTURE_PLATFORM=programmers CAPTURE_OUTCOME=accepted npm run e2e:capture
 * ```
 *
 * Verification Profile을 **확장 없이** 열고, 기준 문제 page에 recorder를
 * 무장한 뒤 제출 결과가 멎을 때까지 기다렸다가 `e2e/fixtures/{platform}/`에
 * 남긴다. 환경 변수가 없으면 건너뛰므로 일반 `npm run e2e`에 섞여도 된다.
 *
 * **제출은 이 spec이 하지 않는다.** 제출 버튼 selector는 실제 page를 보고
 * 확정해야 한다. 추측한 selector를 코드에 박는 것이 이 프로젝트가 없애려는
 * 문제 그 자체다. 첫 캡처에서 확정한 뒤 자동화한다.
 */
import { test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CodingPlatform } from "../../src/shared";
import { openVerificationProfile } from "../support/profile";
import { BASE_PROBLEMS } from "./baseProblems";
import { findLeaks, redactHtml } from "./redact";
import { armRecorder, waitForQuiet, type Recording } from "./recorder";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** 상태를 함께 남겨야 재생이 가능한 플랫폼이 있다.
 *
 * Programmers는 같은 modal node를 재사용해 `class` 하나만 바뀔 수 있고, 그
 * 경우 mutation record만으로는 무슨 일이 있었는지 알 수 없다. */
const WATCH: Partial<
  Record<CodingPlatform, { selector: string; titleSelector: string }>
> = {
  programmers: { selector: "#modal-dialog", titleSelector: ".modal-title" }
};

const platform = process.env.CAPTURE_PLATFORM as CodingPlatform | undefined;
const outcome = process.env.CAPTURE_OUTCOME ?? "accepted";

/** 저장 직전에 한 번 더 본다. redaction이 새면 여기서 멈춘다. */
function sanitize(recording: Recording): Recording {
  const serialized = redactHtml(JSON.stringify(recording));
  const leaks = findLeaks(serialized);

  if (leaks.length > 0) {
    throw new Error(
      `캡처에 남으면 안 되는 값이 있다 (${leaks.join(", ")}). 저장하지 않는다.`
    );
  }

  return JSON.parse(serialized) as Recording;
}

test.describe("Accepted DOM 캡처", () => {
  test.skip(
    platform === undefined,
    "CAPTURE_PLATFORM이 없으면 캡처하지 않는다. 실제 제출이 필요한 작업이다."
  );
  // 사람이 제출을 만드는 동안 기다린다.
  test.setTimeout(10 * 60 * 1000);

  test("기준 문제의 제출 결과를 fixture로 남긴다", async () => {
    if (platform === undefined) {
      return;
    }

    const problem = BASE_PROBLEMS[platform];
    const watch = WATCH[platform];
    const context = await openVerificationProfile();

    try {
      const page = await context.newPage();

      await armRecorder(page, {
        watchSelector: watch?.selector,
        watchTitleSelector: watch?.titleSelector
      });
      await page.goto(problem.url, { waitUntil: "domcontentloaded" });

      console.info(`[capture] ${problem.label}`);
      console.info(`[capture] recorder 무장 완료. ${outcome} 제출을 만들어라.`);
      console.info("[capture] 변화가 4초 이상 멎으면 자동으로 저장한다.");

      // 첫 batch는 page 자체 렌더로도 생긴다. 제출 결과까지 보려면 넉넉히 둔다.
      const recording = await waitForQuiet(page, {
        minBatches: 3,
        quietMs: 4000,
        timeoutMs: 9 * 60 * 1000
      });
      const sanitized = sanitize(recording);
      const outputDir = resolve(repoRoot, "e2e/fixtures", platform);

      await mkdir(outputDir, { recursive: true });
      await writeFile(
        resolve(outputDir, `${outcome}.json`),
        `${JSON.stringify(
          {
            platform,
            outcome,
            problem: problem.label,
            capturedAt: new Date().toISOString(),
            recording: sanitized
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      console.info(
        `[capture] batch ${sanitized.batches.length}개, dialog ${sanitized.dialogs.length}개를 남겼다.`
      );
    } finally {
      await context.close();
    }
  });
});
