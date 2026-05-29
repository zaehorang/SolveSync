import { describe, expect, it } from "vitest";

import {
  APP_NAME,
  DEFAULT_UI_LANGUAGE,
  NORMALIZED_ERROR_CODES,
  RUNTIME_MESSAGE_TYPES,
  STORAGE_SCHEMA_VERSION,
  isSupportedLanguage,
  resolveUiLocale
} from "./index";

describe("shared public barrel", () => {
  it("exports scaffold and shared contract symbols", () => {
    expect(APP_NAME).toBe("SolveSync");
    expect(STORAGE_SCHEMA_VERSION).toBe(3);
    expect(DEFAULT_UI_LANGUAGE).toBe("system");
    expect(resolveUiLocale("system", "ko-KR")).toBe("ko");
    expect(NORMALIZED_ERROR_CODES).toContain("setup_required");
    expect(RUNTIME_MESSAGE_TYPES).toContain("scaffold:ready");
    expect(isSupportedLanguage("python3")).toBe(true);
  });
});
