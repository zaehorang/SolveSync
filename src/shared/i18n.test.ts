import { describe, expect, it } from "vitest";

import {
  DEFAULT_UI_LANGUAGE,
  isUiLanguagePreference,
  resolveUiLocale,
  t
} from "./i18n";

describe("i18n foundation", () => {
  it("resolves system browser language to a supported UI locale", () => {
    expect(resolveUiLocale("system", "ko-KR")).toBe("ko");
    expect(resolveUiLocale("system", "en-US")).toBe("en");
  });

  it("prioritizes explicit language preference over browser language", () => {
    expect(resolveUiLocale("ko", "en-US")).toBe("ko");
    expect(resolveUiLocale("en", "ko-KR")).toBe("en");
  });

  it("falls back to English for unknown or missing browser language", () => {
    expect(resolveUiLocale("system", "fr-FR")).toBe("en");
    expect(resolveUiLocale("system", null)).toBe("en");
    expect(resolveUiLocale("system", undefined)).toBe("en");
  });

  it("guards UI language preferences", () => {
    expect(DEFAULT_UI_LANGUAGE).toBe("system");
    expect(isUiLanguagePreference("system")).toBe(true);
    expect(isUiLanguagePreference("en")).toBe(true);
    expect(isUiLanguagePreference("ko")).toBe(true);
    expect(isUiLanguagePreference("fr")).toBe(false);
  });

  it("defines repository cleanup copy in English and Korean", () => {
    expect(t("en", "options.section.cleanup.title")).toBe("Repository file cleanup");
    expect(t("ko", "options.section.cleanup.title")).toBe("저장소 파일 정리");
    expect(t("en", "action.cleanupRepository")).toBe("Clean up now");
    expect(t("ko", "action.cleanupRepository")).toBe("지금 정리하기");
    expect(t("en", "options.cleanup.running")).toBe("Cleaning up repository files...");
    expect(t("ko", "options.cleanup.committed")).toBe(
      "Solution README 정리 commit을 만들었습니다."
    );
    expect(t("en", "options.cleanup.noChanges")).toBe(
      "Repository files already use the current format."
    );
    expect(t("ko", "options.cleanup.failed", { detail: "권한 없음" })).toBe(
      "저장소 파일 정리에 실패했습니다: 권한 없음"
    );
  });

  it("does not name specific Coding Platforms in platform-agnostic security and lede copy", () => {
    const keys = [
      "options.page.lede",
      "options.security.noProblemStatement",
      "popup.security.note"
    ] as const;

    for (const locale of ["en", "ko"] as const) {
      for (const key of keys) {
        expect(t(locale, key)).not.toMatch(/LeetCode|Programmers|SWEA/);
        expect(t(locale, key)).toContain("Coding Platform");
      }
    }
  });

  it("uses clear Options copy for sync branch creation and failed retries", () => {
    expect(t("en", "options.field.createBranch")).toBe("Create Sync Branch");
    expect(t("ko", "options.field.createBranch")).toBe("Sync Branch 만들기");
    expect(t("en", "options.createBranch.copy")).toBe(
      "Created from the latest commit on the default branch, only when you click Create Sync Branch."
    );
    expect(t("en", "options.page.lede")).toBe(
      "Sync Accepted solutions from supported Coding Platforms to the GitHub repository and branch you choose."
    );
    expect(t("en", "options.security.retryStorage")).toBe(
      "Retry Bundles for failed syncs can temporarily store Accepted solution code in local storage."
    );
  });

  it("does not version the separate backend security disclosure", () => {
    expect(t("en", "options.security.noBackend")).toBe(
      "The extension does not run a separate backend server."
    );
    expect(t("ko", "options.security.noBackend")).toBe(
      "확장 프로그램은 별도 backend server를 운영하지 않습니다."
    );
  });

  it("uses Chrome extension terminology in Korean Options copy", () => {
    expect(t("ko", "options.page.eyebrow")).toBe(
      "Chrome 확장 프로그램 설정"
    );
    expect(t("ko", "options.message.extensionStateUnavailable")).toBe(
      "확장 프로그램 설정에 접근할 수 없습니다. 확장 프로그램을 다시 로드하거나 Options를 다시 여세요."
    );
  });

  it("interpolates params without throwing for missing params", () => {
    expect(t("en", "validation.required", { field: "Repository" })).toBe(
      "Repository is required."
    );
    expect(t("en", "validation.required")).toBe("{field} is required.");
  });

  it("localizes the explicit Device Flow verification action and results", () => {
    expect(t("en", "action.copyCodeAndOpenGitHub")).toBe(
      "Copy code and open GitHub"
    );
    expect(t("ko", "action.copyCodeAndOpenGitHub")).toBe(
      "코드 복사 후 GitHub 열기"
    );
    expect(t("en", "options.auth.codeCopied")).toBe(
      "Code copied. Complete authorization on GitHub."
    );
    expect(t("ko", "options.auth.codeCopied")).toBe(
      "코드를 복사했습니다. GitHub에서 승인을 완료하세요."
    );
    expect(t("en", "options.auth.codeCopyFailed")).toBe(
      "Could not copy the code. Copy the code shown above, then continue on GitHub."
    );
    expect(t("ko", "options.auth.codeCopyFailed")).toBe(
      "코드를 복사하지 못했습니다. 위 코드를 직접 복사한 뒤 GitHub에서 계속하세요."
    );
  });

  it("localizes missing GitHub App configuration guidance", () => {
    expect(t("en", "options.message.githubAppNotConfigured")).toBe(
      "This build is missing GitHub App configuration. Contact the extension administrator."
    );
    expect(t("ko", "options.message.githubAppNotConfigured")).toBe(
      "이 빌드에 GitHub App 설정이 없습니다. 확장 프로그램 관리자에게 문의하세요."
    );
  });
});
