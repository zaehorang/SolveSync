import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { NormalizedError, SyncBranch, SyncRepository } from "../shared";
import {
  getConnectionStatusView,
  getDefaultBranchSelection,
  getRepositoryFilterState,
  getSetupFlowStepStates,
  mapConnectionErrorCode,
  validateSettingsDraft
} from "./index";

describe("options state helpers", () => {
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
        githubPat: "",
        syncRepository: null,
        syncBranch: null,
        connectionStatus: "not_tested"
      })
    ).toEqual({
      pat: "active",
      repository: "disabled",
      branch: "disabled",
      connection: "disabled"
    });

    expect(
      getSetupFlowStepStates({
        githubPat: "pat",
        syncRepository: repository,
        syncBranch: branch,
        connectionStatus: "connected"
      })
    ).toEqual({
      pat: "complete",
      repository: "complete",
      branch: "complete",
      connection: "complete"
    });
  });

  it("validates missing required settings before save", () => {
    const validation = validateSettingsDraft({
      githubPat: " ",
      syncRepository: null,
      syncBranch: null
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toMatchObject({
      githubPat: "GitHub PAT is required.",
      repository: "Choose a Sync Repository from the owned repository list.",
      branch: "Choose an existing Sync Branch or create one first."
    });
  });

  it("localizes validation messages for the selected locale", () => {
    const validation = validateSettingsDraft(
      {
        githubPat: " ",
        syncRepository: null,
        syncBranch: null
      },
      "ko"
    );

    expect(validation.errors).toMatchObject({
      githubPat: "GitHub PAT가 필요합니다.",
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

  it("keeps Save controls balanced on desktop and full width on mobile", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const actionPanelRule = css.match(/\.action-panel\s*\{[^}]*\}/s)?.[0] ?? "";
    const actionButtonRule =
      css.match(/\.action-panel \.button\s*\{[^}]*\}/s)?.[0] ?? "";
    const actionStatusRule =
      css.match(/\.action-panel \.status-text\s*\{[^}]*\}/s)?.[0] ?? "";

    expect(actionPanelRule).toContain("justify-content: flex-end");
    expect(actionButtonRule).toContain("order: 2");
    expect(actionButtonRule).toContain("min-width: 128px");
    expect(actionStatusRule).toContain("order: 1");
    expect(actionStatusRule).toContain("flex: 1 1 320px");
    expect(css).toMatch(
      /\.action-panel \.status-text:empty\s*\{[^}]*display:\s*none/s
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*\.action-panel\s*\{[^}]*grid-template-columns:\s*1fr/s
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*\.action-panel \.button\s*\{[^}]*width:\s*100%/s
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*\.action-panel \.button\s*\{[^}]*justify-self:\s*stretch/s
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
