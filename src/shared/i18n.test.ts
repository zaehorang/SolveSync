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
