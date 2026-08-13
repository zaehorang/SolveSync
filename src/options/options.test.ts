import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { NormalizedError, SyncBranch, SyncRepository } from "../shared";
import {
  getConnectionStatusView,
  getDefaultBranchSelection,
  getDeviceFlowRenderState,
  getOptionsAuthErrorMessage,
  getOptionsExtensionStateUnavailableMessage,
  getRepositoryFilterState,
  getRepositoryListRenderState,
  getSetupFlowStepStates,
  mapConnectionErrorCode,
  openGitHubVerification,
  readSettings,
  saveSettings,
  validateSettingsDraft
} from "./index";

describe("options state helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters repositories by owner or name without selecting a repository", () => {
    const repositories = [
      makeRepository("octo/algorithms"),
      makeRepository("zae/leetcode-sync"),
      makeRepository("team/swift-solutions")
    ];

    const state = getRepositoryFilterState(repositories, "swift");

    expect(state.visibleRepositories).toEqual([repositories[2]]);
    expect(state.hasMatches).toBe(true);
  });

  it("keeps repository non-ready states separate from selectable options", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const repositories = [makeRepository("octo/algorithms")];

    expect(html).toContain('id="repository-list-status"');
    expect(html).toContain('class="repository-list-status"');
    expect(source).toContain("elements.repositorySelect.hidden = listState !== \"ready\";");
    expect(source).toContain("elements.repositorySelect.replaceChildren();");
    expect(source).not.toContain("document.createElement(\"option\");\n    option.disabled = true");
    expect(css).toContain(".repository-list-status");
    expect(css).not.toContain('select[data-list-state="empty"]');
    expect(
      getRepositoryListRenderState(
        {
          loadingRepositories: true,
          repositories
        },
        getRepositoryFilterState(repositories, "")
      )
    ).toBe("loading");
    expect(
      getRepositoryListRenderState(
        {
          loadingRepositories: false,
          repositories: []
        },
        getRepositoryFilterState([], "")
      )
    ).toBe("empty");
    expect(
      getRepositoryListRenderState(
        {
          loadingRepositories: false,
          repositories
        },
        getRepositoryFilterState(repositories, "missing")
      )
    ).toBe("no-matches");
    expect(
      getRepositoryListRenderState(
        {
          loadingRepositories: false,
          repositories
        },
        getRepositoryFilterState(repositories, "octo")
      )
    ).toBe("ready");
  });

  it("uses GitHub Device Flow controls without a PAT input", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const startAuthSource = source.slice(
      source.indexOf("async function startGitHubAuth"),
      source.indexOf("async function verifyPendingGitHubAuth")
    );

    expect(html).toContain('id="github-auth-start"');
    expect(html).toContain('id="github-user-code"');
    expect(html).toContain('id="github-open-verification"');
    expect(html).toContain('id="github-auth-status" class="field-message" aria-live="polite"');
    expect(html).toContain('id="github-install-app"');
    expect(html).not.toContain("github-pat");
    expect(html).not.toContain('type="password"');
    expect(startAuthSource).toContain("state.pendingAuth = response.data;");
    expect(startAuthSource).toContain("scheduleAuthPoll(elements, state);");
    expect(startAuthSource).not.toContain("window.open");

    expect(
      getDeviceFlowRenderState({
        userCode: "ABCD-1234",
        verificationUri: "https://github.com/login/device",
        expiresAt: "2026-01-01T00:15:00.000Z",
        intervalSeconds: 5
      })
    ).toEqual({
      hidden: false,
      userCode: "ABCD-1234"
    });
  });

  it("copies the rendered Device Flow code before opening GitHub", async () => {
    const clipboard = {
      writeText: vi.fn(async () => undefined)
    };
    const openWindow = vi.fn();

    const copied = await openGitHubVerification(
      {
        userCode: "ABCD-1234",
        verificationUri: "https://github.com/login/device",
        expiresAt: "2026-01-01T00:15:00.000Z",
        intervalSeconds: 5
      },
      clipboard,
      openWindow
    );

    expect(copied).toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith("ABCD-1234");
    expect(openWindow).toHaveBeenCalledWith(
      "https://github.com/login/device",
      "_blank",
      "noopener"
    );
    expect(clipboard.writeText.mock.invocationCallOrder[0]).toBeLessThan(
      openWindow.mock.invocationCallOrder[0]
    );
  });

  it("still opens GitHub and reports failure when copying the code fails", async () => {
    const clipboard = {
      writeText: vi.fn(async () => {
        throw new Error("Clipboard permission denied");
      })
    };
    const openWindow = vi.fn();

    const copied = await openGitHubVerification(
      {
        userCode: "ABCD-1234",
        verificationUri: "https://github.com/login/device",
        expiresAt: "2026-01-01T00:15:00.000Z",
        intervalSeconds: 5
      },
      clipboard,
      openWindow
    );

    expect(copied).toBe(false);
    expect(openWindow).toHaveBeenCalledOnce();
  });

  it("localizes GitHub App configuration errors in Options", () => {
    const error = makeError(
      "github_app_not_configured",
      "This build is missing GitHub App configuration. Contact the extension administrator."
    );

    expect(getOptionsAuthErrorMessage(error, "en")).toBe(
      "This build is missing GitHub App configuration. Contact the extension administrator."
    );
    expect(getOptionsAuthErrorMessage(error, "ko")).toBe(
      "이 빌드에 GitHub App 설정이 없습니다. 확장 프로그램 관리자에게 문의하세요."
    );
  });

  it("uses the repository default branch when no saved branch is selected", () => {
    const repository = makeRepository("octo/algorithms", "main");
    const branches = [
      makeBranch("leetcode-sync-test"),
      makeBranch("main"),
      makeBranch("feature")
    ];

    expect(getDefaultBranchSelection(repository, branches, null)).toBe("main");
  });

  it("preserves a saved branch when it still exists", () => {
    const repository = makeRepository("octo/algorithms", "main");
    const branches = [makeBranch("main"), makeBranch("leetcode-sync-test")];

    expect(
      getDefaultBranchSelection(repository, branches, "leetcode-sync-test")
    ).toBe("leetcode-sync-test");
  });

  it("marks setup flow steps as active, complete, or disabled without auto-selecting choices", () => {
    const repository = makeRepository("octo/algorithms", "main");
    const branch = makeBranch("main");

    expect(
      getSetupFlowStepStates({
        isGithubConnected: false,
        syncRepository: null,
        syncBranch: null,
        connectionStatus: "not_tested"
      })
    ).toEqual({
      auth: "active",
      repository: "disabled",
      branch: "disabled",
      connection: "disabled"
    });

    expect(
      getSetupFlowStepStates({
        isGithubConnected: true,
        syncRepository: repository,
        syncBranch: branch,
        connectionStatus: "connected"
      })
    ).toEqual({
      auth: "complete",
      repository: "complete",
      branch: "complete",
      connection: "complete"
    });
  });

  it("validates missing required settings before save", () => {
    const validation = validateSettingsDraft({
      isGithubConnected: false,
      syncRepository: null,
      syncBranch: null
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toMatchObject({
      githubAuth: "Sign in with GitHub first.",
      repository: "Choose a Sync Repository from the owned repository list.",
      branch: "Choose an existing Sync Branch or create one first."
    });
  });

  it("localizes validation messages for the selected locale", () => {
    const validation = validateSettingsDraft(
      {
        isGithubConnected: false,
        syncRepository: null,
        syncBranch: null
      },
      "ko"
    );

    expect(validation.errors).toMatchObject({
      githubAuth: "먼저 GitHub로 로그인하세요.",
      repository: "본인 저장소 목록에서 Sync Repository를 선택하세요.",
      branch: "기존 Sync Branch를 선택하거나 먼저 생성하세요."
    });
  });

  it("maps connection status and normalized errors to user-facing labels", () => {
    const error = makeError("github_auth_failed", "GitHub authentication failed.");

    expect(mapConnectionErrorCode(error.code)).toBe("auth_failed");
    expect(getConnectionStatusView("connected")).toMatchObject({
      label: "Connected",
      tone: "success"
    });
    expect(getConnectionStatusView("auth_failed", error)).toMatchObject({
      label: "Auth failed",
      detail: "GitHub authentication failed.",
      tone: "error"
    });
  });

  it("localizes connection status labels without changing status behavior", () => {
    expect(getConnectionStatusView("connected", null, "ko")).toMatchObject({
      label: "연결됨",
      tone: "success"
    });
  });

  it("shows extension recovery copy when initial settings read fails", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        lastError: {
          message: "Storage read failed"
        },
        sendMessage: vi.fn(
          (
            _message: unknown,
            callback: (response: undefined) => void
          ) => callback(undefined)
        )
      }
    });

    await expect(readSettings()).rejects.toMatchObject({
      code: "extension_state_unavailable",
      userMessage:
        "Could not read extension settings. Reload the extension or reopen Options."
    });
    expect(getOptionsExtensionStateUnavailableMessage("en")).toBe(
      "Could not access extension settings. Reload the extension or reopen Options."
    );
    expect(getOptionsExtensionStateUnavailableMessage("en")).not.toBe(
      "Could not commit the solution to GitHub."
    );
    expect(getOptionsExtensionStateUnavailableMessage("ko")).toBe(
      "확장 설정에 접근할 수 없습니다. 확장을 다시 로드하거나 Options를 다시 여세요."
    );
  });

  it("normalizes settings save write failures as extension-local state failures", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        lastError: {
          message: "Storage write failed"
        },
        sendMessage: vi.fn(
          (
            _message: unknown,
            callback: (response: undefined) => void
          ) => callback(undefined)
        )
      }
    });

    await expect(
      saveSettings({
        autoSyncEnabled: true
      })
    ).rejects.toMatchObject({
      code: "extension_state_unavailable",
      userMessage:
        "Could not read extension settings. Reload the extension or reopen Options."
    });
    expect(getOptionsExtensionStateUnavailableMessage("en")).not.toContain(
      "GitHub"
    );
  });

  it("keeps Save controls as an integrated sticky footer", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const actionPanelRule = css.match(/\.action-panel\s*\{[^}]*\}/s)?.[0] ?? "";
    const actionPanelInnerRule =
      css.match(/\.action-panel-inner\s*\{[^}]*\}/s)?.[0] ?? "";
    const actionButtonRule =
      css.match(/\.action-panel \.button\s*\{[^}]*\}/s)?.[0] ?? "";
    const actionStatusRule =
      css.match(/\.action-panel \.status-text\s*\{[^}]*\}/s)?.[0] ?? "";

    expect(html).toContain('<section class="action-panel"');
    expect(html).toContain('<div class="action-panel-inner">');
    expect(html).not.toContain('class="panel action-panel"');
    expect(actionPanelRule).toContain("bottom: 0");
    expect(actionPanelRule).toContain("border-top: 1px solid var(--ss-hairline)");
    expect(actionPanelRule).toContain("background: rgb(238 244 251 / 0.82)");
    expect(actionPanelRule).toContain("box-shadow: 0 -6px 18px rgb(15 23 42 / 0.06)");
    expect(actionPanelRule).not.toContain("border-color");
    expect(actionPanelInnerRule).toContain("justify-content: flex-end");
    expect(actionButtonRule).toContain("min-width: 128px");
    expect(actionStatusRule).toContain("flex: 0 1 520px");
    expect(actionStatusRule).toContain("text-align: right");
    expect(css).toMatch(
      /\.action-panel \.status-text:empty\s*\{[^}]*display:\s*none/s
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*\.action-panel-inner\s*\{[^}]*grid-template-columns:\s*1fr/s
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*\.action-panel \.button\s*\{[^}]*width:\s*100%/s
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*\.action-panel \.button\s*\{[^}]*justify-self:\s*stretch/s
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*\.action-panel \.status-text\s*\{[^}]*text-align:\s*left/s
    );
    expect(source).toContain(
      'const baseClass = element.id === "save-status" ? "status-text" : "field-message";'
    );
    expect(source).toContain("element.className = `${baseClass}");
  });

  it("keeps the mobile language segmented control in three columns", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const segmentedControlRule =
      css.match(/\.segmented-control\s*\{[^}]*\}/s)?.[0] ?? "";
    const mobileRules =
      css.match(/@media \(max-width: 680px\)\s*\{[\s\S]*\}\s*$/s)?.[0] ?? "";

    expect(segmentedControlRule).toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr))"
    );
    expect(segmentedControlRule).toContain("border-radius: 999px");
    expect(mobileRules).not.toMatch(
      /\.segmented-control\s*\{[^}]*grid-template-columns:\s*1fr/s
    );
    expect(mobileRules).not.toMatch(
      /\.segmented-control\s*\{[^}]*border-radius:\s*var\(--ss-radius-panel\)/s
    );
    expect(mobileRules).toMatch(
      /\.segment-option\s*\{[^}]*min-width:\s*0/s
    );
  });

  it("prevents the hidden Auto Sync input from inheriting full-width overflow", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const switchRowRule = css.match(/\.switch-row\s*\{[^}]*\}/s)?.[0] ?? "";
    const switchInputRule =
      css.match(/\.switch-row input\s*\{[^}]*\}/s)?.[0] ?? "";

    expect(switchRowRule).toContain("max-width: 100%");
    expect(switchRowRule).toContain("min-width: 0");
    expect(switchInputRule).toContain("position: absolute");
    expect(switchInputRule).toContain("width: 1px");
    expect(switchInputRule).toContain("height: 1px");
    expect(switchInputRule).toContain("min-height: 0");
    expect(switchInputRule).toContain("border: 0");
    expect(switchInputRule).toContain("padding: 0");
    expect(css).toMatch(/\.switch-row input:checked \+ \.switch-control\s*\{/s);
    expect(css).toMatch(
      /\.switch-row input:focus-visible \+ \.switch-control\s*\{/s
    );
  });

  it("keeps Auto Sync as a native checkbox wrapped by its label", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

    expect(html).toMatch(
      /<label class="switch-row" for="auto-sync-enabled">[\s\S]*<input id="auto-sync-enabled" type="checkbox" \/>/
    );
    expect(html).toContain(
      '<span class="switch-control" aria-hidden="true"></span>'
    );
  });
});

function makeRepository(fullName: string, defaultBranch = "main"): SyncRepository {
  const [owner, name] = fullName.split("/");

  return {
    owner,
    name,
    fullName,
    defaultBranch,
    private: false,
    htmlUrl: `https://github.com/${fullName}`
  };
}

function makeBranch(name: string): SyncBranch {
  return {
    name,
    sha: `${name}-sha`,
    protected: false
  };
}

function makeError(
  code: NormalizedError["code"],
  userMessage: string
): NormalizedError {
  return {
    code,
    userMessage,
    debugMessage: null,
    retryable: false
  };
}
