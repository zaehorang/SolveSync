/** 빌드된 확장을 실제 Chrome에 unpacked로 로드한다.
 *
 * 테스트 전용 manifest 변형을 만들지 않는다. 검증 대상이 프로덕션 산출물과
 * 달라지면 이 계층의 존재 이유가 사라진다. 그래서 `dist/`를 그대로 쓰고
 * Coding Platform 요청만 로컬 fixture로 가로챈다.
 */
import { chromium, type BrowserContext, type Worker } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const distPath = resolve(repoRoot, "dist");

export interface LoadedExtension {
  context: BrowserContext;
  /** MV3 service worker. 기동 전이면 첫 이벤트까지 기다린다. */
  serviceWorker(): Promise<Worker>;
  extensionId(): Promise<string>;
  close(): Promise<void>;
}

export interface LoadExtensionOptions {
  /** 기본은 headless. MV3 확장 로드가 불안정하면 false로 내린다. */
  headless?: boolean;
  /** Live E2E는 로그인 세션이 남는 전용 프로필을 쓴다. 생략하면 매번 버린다. */
  userDataDir?: string;
}

export async function loadExtension(
  options: LoadExtensionOptions = {}
): Promise<LoadedExtension> {
  const ephemeral = options.userDataDir === undefined;
  const userDataDir =
    options.userDataDir ?? (await mkdtemp(join(tmpdir(), "solvesync-e2e-")));

  const context = await chromium.launchPersistentContext(userDataDir, {
    // headless 기본값은 `chromium_headless_shell`을 쓰는데 그 바이너리는
    // 확장을 지원하지 않아 service worker가 영영 기동하지 않는다. 정식
    // Chromium 채널을 명시해야 MV3 확장이 headless에서 뜬다.
    channel: "chromium",
    headless: options.headless ?? true,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`
    ]
  });

  const serviceWorker = async (): Promise<Worker> =>
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));

  return {
    context,
    serviceWorker,
    async extensionId() {
      const worker = await serviceWorker();

      // chrome-extension://<id>/background/index.js
      return new URL(worker.url()).host;
    },
    async close() {
      await context.close();

      if (ephemeral) {
        await rm(userDataDir, { recursive: true, force: true });
      }
    }
  };
}
