import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS_STATE,
  EMPTY_IN_FLIGHT_SYNCS_STATE,
  EMPTY_PROCESSED_SUBMISSIONS_STATE,
  EMPTY_RETRY_PAYLOADS_STATE,
  EMPTY_SYNC_HISTORY_STATE,
  STORAGE_SCHEMA_VERSION,
  isSettingsState,
  isVersionedStorageState,
  toPublicSettingsState
} from "./storageSchema";

describe("storage schema contracts", () => {
  it("keeps every top-level storage state versioned", () => {
    const states = [
      DEFAULT_SETTINGS_STATE,
      EMPTY_PROCESSED_SUBMISSIONS_STATE,
      EMPTY_SYNC_HISTORY_STATE,
      EMPTY_RETRY_PAYLOADS_STATE,
      EMPTY_IN_FLIGHT_SYNCS_STATE
    ];

    expect(states.every((state) => state.version === STORAGE_SCHEMA_VERSION)).toBe(true);
    expect(states.every(isVersionedStorageState)).toBe(true);
  });

  it("keeps the stored PAT out of public settings", () => {
    const publicSettings = toPublicSettingsState({
      ...DEFAULT_SETTINGS_STATE,
      githubPat: "redacted-local-value"
    });

    expect(publicSettings.hasGithubPat).toBe(true);
    expect("githubPat" in publicSettings).toBe(false);
  });

  it("guards the settings state shape", () => {
    expect(isSettingsState(DEFAULT_SETTINGS_STATE)).toBe(true);
    expect(isSettingsState({ ...DEFAULT_SETTINGS_STATE, version: 999 })).toBe(false);
  });
});
