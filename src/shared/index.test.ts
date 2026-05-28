import { describe, expect, it } from "vitest";

import {
  APP_NAME,
  NORMALIZED_ERROR_CODES,
  RUNTIME_MESSAGE_TYPES,
  STORAGE_SCHEMA_VERSION,
  isSupportedLanguage
} from "./index";

describe("shared public barrel", () => {
  it("exports scaffold and shared contract symbols", () => {
    expect(APP_NAME).toBe("SolveSync");
    expect(STORAGE_SCHEMA_VERSION).toBe(2);
    expect(NORMALIZED_ERROR_CODES).toContain("setup_required");
    expect(RUNTIME_MESSAGE_TYPES).toContain("scaffold:ready");
    expect(isSupportedLanguage("python3")).toBe(true);
  });
});
