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
});
