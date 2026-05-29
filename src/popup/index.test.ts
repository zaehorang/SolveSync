import { describe, expect, it } from "vitest";

import {
  DEFAULT_UI_LANGUAGE,
  STORAGE_SCHEMA_VERSION,
  type PublicSettingsState
} from "../shared";
import { getSetupStatusView } from "./index";

describe("popup index owner repository copy", () => {
  it("asks users to choose an owned repository", () => {
    expect(
      getSetupStatusView({
        ...makePublicSettings(),
        selectedRepository: null
      })
    ).toMatchObject({
      label: "Repository required",
      detail: "Open Options and choose an owned repository.",
      tone: "warning"
    });
  });

  it("labels no repository access as no owned repositories", () => {
    expect(
      getSetupStatusView({
        ...makePublicSettings(),
        connectionStatus: {
          code: "no_accessible_repositories",
          checkedAt: "2026-01-01T00:00:00.000Z",
          error: null
        }
      })
    ).toMatchObject({
      label: "No owned repositories",
      tone: "warning"
    });
  });
});

function makePublicSettings(): PublicSettingsState {
  return {
    version: STORAGE_SCHEMA_VERSION,
    hasGithubPat: true,
    selectedRepository: {
      owner: "octo",
      name: "algorithms",
      fullName: "octo/algorithms",
      defaultBranch: "main",
      private: true,
      htmlUrl: "https://github.com/octo/algorithms"
    },
    selectedBranch: {
      name: "main",
      sha: "branch-sha",
      protected: false
    },
    autoSyncEnabled: true,
    uiLanguage: DEFAULT_UI_LANGUAGE,
    connectionStatus: {
      code: "connected",
      checkedAt: "2026-01-01T00:00:00.000Z",
      error: null
    },
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}
