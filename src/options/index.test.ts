import { describe, expect, it } from "vitest";

import { getConnectionStatusView, validateSettingsDraft } from "./index";

describe("options index owner repository copy", () => {
  it("asks users to choose from owned repositories", () => {
    const validation = validateSettingsDraft({
      githubPat: "pat",
      syncRepository: null,
      syncBranch: null
    });

    expect(validation.errors.repository).toBe(
      "Choose a repository from the owned repository list."
    );
  });

  it("labels empty repository state as no owned repositories", () => {
    expect(getConnectionStatusView("no_accessible_repositories")).toMatchObject({
      label: "No owned repositories",
      detail: "Check that the token includes a repository owned by your account.",
      tone: "warning"
    });
  });

  it("can render owner repository copy in Korean", () => {
    const validation = validateSettingsDraft(
      {
        githubPat: "pat",
        syncRepository: null,
        syncBranch: null
      },
      "ko"
    );

    expect(validation.errors.repository).toBe(
      "본인 저장소 목록에서 저장소를 선택하세요."
    );
  });
});
