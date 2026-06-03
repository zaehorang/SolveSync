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
