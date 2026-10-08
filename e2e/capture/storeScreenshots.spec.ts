/** Chrome Web Store용 스크린샷을 가짜 데이터로 찍는다.
 *
 * 실제 계정으로 찍으면 login, email, 비공개 저장소를 가려야 하고 다시 찍을 때마다
 * 같은 검토를 반복해야 한다. 그래서 제품 번들(`dist/`)을 그대로 로드하고
 * `chrome.storage.local`에만 데모 값을 심는다. GitHub로 나가는 요청은 막아
 * 가짜 token이 외부로 나가지 않게 한다.
 *
 * `E2E_STORE_SCREENSHOTS=1 npm run store:screenshots`로만 돈다. 결과는
 * `assets/store/`의 1280x800 PNG다.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "../../src/shared/storageSchema";
import type { SettingsState } from "../../src/shared/storageSchema";
import type { SyncHistoryEntry, SyncRepository } from "../../src/shared/types";
import { loadExtension, type LoadedExtension } from "../support/extension";
import { seedGitHubAuthSession } from "../support/extensionPage";

/** page 안에서만 쓰는 확장 API. e2e tsconfig는 chrome 타입을 싣지 않는다. */
declare const chrome: {
  storage: { local: { set(items: Record<string, unknown>): Promise<void> } };
};

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const outputDir = resolve(repoRoot, "assets/store");
const SCREEN = { width: 1280, height: 800 };

const DEMO_LOGIN = "solve-sync-demo";
const DEMO_REPOSITORY: SyncRepository = {
  owner: DEMO_LOGIN,
  name: "algorithm-solutions",
  fullName: `${DEMO_LOGIN}/algorithm-solutions`,
  defaultBranch: "main",
  private: false,
  htmlUrl: `https://github.com/${DEMO_LOGIN}/algorithm-solutions`
};
const DEMO_BRANCH = "main";

/** Store Listing 언어마다 한 세트를 찍는다. en이 기본(`default_locale`)이다. */
const LOCALES = ["en", "ko"] as const;
type Locale = (typeof LOCALES)[number];

const CAPTIONS: Record<Locale, { options: Caption; popup: Caption }> = {
  en: {
    options: {
      title: "You choose the<br>repository and branch",
      body: "Sign in with the GitHub App, then pick a repository you own and a Sync Branch. Test connection never creates a commit."
    },
    popup: {
      title: "Accepted solutions<br>land in GitHub",
      body: "Accepted solutions from LeetCode, Programmers, and SWEA are committed to your repository, and Sync History shows the result."
    }
  },
  ko: {
    options: {
      title: "저장소와 branch는<br>직접 고릅니다",
      body: "GitHub App으로 로그인한 뒤, App을 설치한 본인 저장소와 Sync Branch를 선택합니다. 연결 테스트는 commit을 만들지 않습니다."
    },
    popup: {
      title: "Accepted 풀이가<br>GitHub에 쌓입니다",
      body: "LeetCode, Programmers, SWEA에서 Accepted 받은 풀이를 선택한 저장소에 commit하고 Sync History로 결과를 보여줍니다."
    }
  }
};

test.describe("Store 스크린샷", () => {
  test.skip(
    process.env.E2E_STORE_SCREENSHOTS !== "1",
    "E2E_STORE_SCREENSHOTS=1일 때만 찍는다. assets/store의 PNG를 덮어쓴다."
  );

  let extension: LoadedExtension;

  test.beforeEach(async () => {
    extension = await loadExtension();
    // 데모 token이 실제 GitHub로 나가지 않게 가로챈다. Popup은 열릴 때 연결을
    // 확인하므로 그 요청에만 데모 저장소 응답을 준다.
    await extension.context.route(/^https:\/\/(api\.)?github\.com\//, (route) => {
      const body = mockGitHubResponse(new URL(route.request().url()).pathname);

      return body === null
        ? route.fulfill({ status: 404, json: { message: "Not Found" } })
        : route.fulfill({ status: 200, json: body });
    });
    await mkdir(outputDir, { recursive: true });
  });

  test.afterEach(async () => {
    await extension.close();
  });

  for (const locale of LOCALES) {
    test(`연결된 Options와 Popup Sync History (${locale})`, async () => {
      const extensionId = await extension.extensionId();
      const caption = CAPTIONS[locale];

      await seedDemoState(extension, demoHistoryEntries(locale), locale);

      const options = await extension.context.newPage();

      await options.setViewportSize({ width: 1100, height: 1400 });
      await options.goto(`chrome-extension://${extensionId}/options/index.html`);
      await expect(options.getByText(DEMO_REPOSITORY.fullName).first()).toBeVisible();
      await settle(options);

      await frameImage(
        extension,
        await options.locator("section.setup-panel").screenshot(),
        caption.options,
        locale,
        resolve(outputDir, `screenshot-options-connected-${locale}-1280x800.png`),
        640
      );

      const popup = await extension.context.newPage();

      await popup.setViewportSize({ width: 380, height: 640 });
      await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
      await expect(popup.getByText("Two Sum").first()).toBeVisible();
      await settle(popup);

      await frameImage(
        extension,
        await popup.screenshot({ fullPage: false }),
        caption.popup,
        locale,
        resolve(outputDir, `screenshot-popup-history-${locale}-1280x800.png`)
      );
    });
  }
});

const DEMO_SHA = "0000000000000000000000000000000000000000";

/** Popup의 연결 확인이 읽는 GitHub API만 흉내 낸다. 나머지는 404다. */
function mockGitHubResponse(pathname: string): unknown {
  const repoPath = `/repos/${DEMO_REPOSITORY.fullName}`;

  if (pathname === repoPath) {
    return {
      id: 1,
      name: DEMO_REPOSITORY.name,
      full_name: DEMO_REPOSITORY.fullName,
      owner: { login: DEMO_REPOSITORY.owner },
      default_branch: DEMO_REPOSITORY.defaultBranch,
      private: DEMO_REPOSITORY.private,
      html_url: DEMO_REPOSITORY.htmlUrl,
      permissions: { pull: true, push: true }
    };
  }

  if (pathname === `${repoPath}/git/ref/heads/${DEMO_BRANCH}`) {
    return { ref: `refs/heads/${DEMO_BRANCH}`, object: { sha: DEMO_SHA, type: "commit" } };
  }

  if (pathname === `${repoPath}/git/commits/${DEMO_SHA}`) {
    return { sha: DEMO_SHA, tree: { sha: DEMO_SHA } };
  }

  if (pathname === `${repoPath}/branches`) {
    return [{ name: DEMO_BRANCH, commit: { sha: DEMO_SHA }, protected: false }];
  }

  if (pathname.startsWith(`${repoPath}/git/trees/`)) {
    return { sha: DEMO_SHA, tree: [], truncated: false };
  }

  return null;
}

async function seedDemoState(
  extension: LoadedExtension,
  entries: SyncHistoryEntry[],
  locale: Locale
): Promise<void> {
  const extensionId = await extension.extensionId();
  const page = await extension.context.newPage();

  await page.goto(`chrome-extension://${extensionId}/options/index.html`);
  await seedGitHubAuthSession(page, {
    accessToken: "store-screenshot-demo-token",
    login: DEMO_LOGIN
  });
  await page.evaluate(async (values) => chrome.storage.local.set(values), {
    [STORAGE_KEYS.settings]: demoSettings(locale),
    [STORAGE_KEYS.syncHistory]: { version: STORAGE_SCHEMA_VERSION, entries }
  } as Record<string, unknown>);
  await page.close();
}

function demoSettings(locale: Locale): SettingsState {
  const now = new Date().toISOString();

  return {
    version: STORAGE_SCHEMA_VERSION,
    syncRepository: DEMO_REPOSITORY,
    syncBranch: { name: DEMO_BRANCH, sha: DEMO_SHA, protected: false },
    autoSyncEnabled: true,
    uiLanguage: locale,
    connectionStatus: { code: "connected", checkedAt: now, error: null },
    updatedAt: now
  };
}

/** 최근 항목이 Popup 맨 위에 온다. 영어 세트는 제목이 영어인 LeetCode를 먼저 둔다.
 * Programmers와 SWEA는 문제 제목이 원래 한국어다. */
function demoHistoryEntries(locale: Locale): SyncHistoryEntry[] {
  const ago =
    locale === "en"
      ? { leetcode: 2, programmers: 38, swea: 95 }
      : { programmers: 2, swea: 38, leetcode: 95 };
  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60 * 1000).toISOString();

  return [
    demoEntry({
      id: "demo-programmers",
      codingPlatform: "programmers",
      titleSlug: "120804_두_수의_곱_구하기",
      problemTitle: "두 수의 곱 구하기",
      problemFrontendId: "120804",
      language: "Swift",
      supportedLanguage: "swift",
      acceptedSourceId: "programmers:120804:swift:demo",
      solutionPath: "programmers/swift/120804_두_수의_곱_구하기.swift",
      at: minutesAgo(ago.programmers)
    }),
    demoEntry({
      id: "demo-swea",
      codingPlatform: "swea",
      titleSlug: "AV13zZ7KAAACFAYh_1234_숫자_카드",
      problemTitle: "숫자 카드",
      problemFrontendId: "1234",
      language: "Python 3",
      supportedLanguage: "python3",
      acceptedSourceId: "swea:AV13zZ7KAAACFAYh:python3:demo",
      solutionPath: "swea/python/AV13zZ7KAAACFAYh_1234_숫자_카드.py",
      at: minutesAgo(ago.swea)
    }),
    demoEntry({
      id: "demo-leetcode",
      codingPlatform: "leetcode",
      titleSlug: "two-sum",
      problemTitle: "Two Sum",
      problemFrontendId: "1",
      language: "Python3",
      supportedLanguage: "python3",
      acceptedSourceId: "leetcode:demo-1",
      solutionPath: "leetcode/python/0001_two_sum.py",
      at: minutesAgo(ago.leetcode)
    })
  ];
}

interface DemoEntryInput {
  id: string;
  codingPlatform: SyncHistoryEntry["codingPlatform"];
  titleSlug: string;
  problemTitle: string;
  problemFrontendId: string;
  language: string;
  supportedLanguage: NonNullable<SyncHistoryEntry["supportedLanguage"]>;
  acceptedSourceId: string;
  solutionPath: string;
  at: string;
}

function demoEntry(input: DemoEntryInput): SyncHistoryEntry {
  const commitSha = `demo${input.id}`.padEnd(40, "0").slice(0, 40);

  return {
    id: input.id,
    codingPlatform: input.codingPlatform,
    status: "synced",
    titleSlug: input.titleSlug,
    problemTitle: input.problemTitle,
    problemFrontendId: input.problemFrontendId,
    language: input.language,
    supportedLanguage: input.supportedLanguage,
    syncDeduplicationKey: {
      codingPlatform: input.codingPlatform,
      acceptedSourceId: input.acceptedSourceId,
      titleSlug: input.titleSlug,
      language: input.supportedLanguage
    },
    syncRepository: DEMO_REPOSITORY,
    syncBranchName: DEMO_BRANCH,
    solutionPath: input.solutionPath,
    commitSha,
    commitUrl: `${DEMO_REPOSITORY.htmlUrl}/commit/${commitSha}`,
    fileUrl: `${DEMO_REPOSITORY.htmlUrl}/blob/${DEMO_BRANCH}/${input.solutionPath}`,
    error: null,
    retryBundleId: null,
    createdAt: input.at,
    updatedAt: input.at
  };
}

/** 글꼴과 transition이 끝난 뒤에 찍는다. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => document.fonts.ready);
  await page.waitForTimeout(300);
}

interface Caption {
  /** `<br>`만 쓰는 고정 문구다. 외부 입력을 넣지 않는다. */
  title: string;
  body: string;
}

/** Popup은 작아서 1280x800 배경 위에 설명과 함께 놓는다. */
async function frameImage(
  extension: LoadedExtension,
  image: Buffer,
  caption: Caption,
  locale: Locale,
  path: string,
  imageWidth = 380
): Promise<void> {
  const frame = await extension.context.newPage();
  const src = `data:image/png;base64,${image.toString("base64")}`;

  await frame.setViewportSize(SCREEN);
  await frame.setContent(`<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1280px; height: 800px; display: flex; align-items: center;
    justify-content: center; gap: 72px; background: #eef4fb;
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  .copy { max-width: 440px; color: #0f172a; }
  .copy h1 { font-size: 40px; line-height: 1.25; margin: 0 0 20px; }
  .copy p { font-size: 20px; line-height: 1.6; margin: 0; color: #334155; }
  img { width: ${imageWidth}px; max-height: 720px; object-fit: cover; object-position: top; border-radius: 16px; box-shadow: 0 24px 60px rgba(15, 23, 42, .18); }
</style></head><body>
  <div class="copy">
    <h1>${caption.title}</h1>
    <p>${caption.body}</p>
  </div>
  <img src="${src}" alt="">
</body></html>`);
  await settle(frame);
  await frame.screenshot({ path });
  await frame.close();
}
