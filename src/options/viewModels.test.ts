import { describe, expect, it } from "vitest";

import {
  getConnectionStatusView,
  validateSettingsDraft
} from "./viewModels";

describe("options index owner repository copy", () => {
  it("asks users to choose a Sync Repository from owned repositories", () => {
    const validation = validateSettingsDraft({
      isGithubConnected: true,
      syncRepository: null,
      syncBranch: null
    });

    expect(validation.errors.repository).toBe(
      "Choose a Sync Repository from the owned repository list."
    );
  });

  it("labels empty repository state as no owned repositories", () => {
    expect(getConnectionStatusView("no_accessible_repositories")).toMatchObject({
      label: "No owned repositories",
      detail: "Install the SolveSync GitHub App for at least one repository you own.",
      tone: "warning"
    });
  });

  it("can render owner repository copy in Korean", () => {
    const validation = validateSettingsDraft(
      {
        isGithubConnected: true,
        syncRepository: null,
        syncBranch: null
      },
      "ko"
    );

    expect(validation.errors.repository).toBe(
      "본인 저장소 목록에서 Sync Repository를 선택하세요."
    );
  });
});
