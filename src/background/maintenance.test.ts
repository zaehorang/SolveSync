import { describe, expect, it, vi } from "vitest";

import type { ExtensionStorage } from "./storage";
import {
  RETRY_BUNDLE_PRUNE_ALARM_NAME,
  RETRY_BUNDLE_PRUNE_PERIOD_MINUTES,
  registerRetryBundleMaintenance,
  runRetryBundleMaintenance
} from "./maintenance";

describe("retry bundle maintenance", () => {
  it("prunes retry data and ensures the daily alarm", async () => {
    const pruneRetryBundles = vi.fn().mockResolvedValue({
      version: 5,
      bundles: []
    });
    const create = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      alarms: {
        create
      }
    });

    await runRetryBundleMaintenance(
      { pruneRetryBundles } as unknown as ExtensionStorage,
      new Date("2026-07-29T00:00:00.000Z")
    );

    expect(pruneRetryBundles).toHaveBeenCalledWith(
      "2026-07-29T00:00:00.000Z"
    );
    expect(create).toHaveBeenCalledWith(RETRY_BUNDLE_PRUNE_ALARM_NAME, {
      periodInMinutes: RETRY_BUNDLE_PRUNE_PERIOD_MINUTES
    });
  });

  it("registers boot, install, startup, and matching-alarm cleanup triggers", async () => {
    const alarmListeners: Array<(alarm: { name: string }) => void> = [];
    const installedListeners: Array<() => void> = [];
    const startupListeners: Array<() => void> = [];
    const pruneRetryBundles = vi.fn().mockResolvedValue({
      version: 5,
      bundles: []
    });
    vi.stubGlobal("chrome", {
      alarms: {
        create: vi.fn().mockResolvedValue(undefined),
        onAlarm: {
          addListener: vi.fn((listener) => alarmListeners.push(listener))
        }
      },
      runtime: {
        onInstalled: {
          addListener: vi.fn((listener) => installedListeners.push(listener))
        },
        onStartup: {
          addListener: vi.fn((listener) => startupListeners.push(listener))
        }
      }
    });

    registerRetryBundleMaintenance({
      pruneRetryBundles
    } as unknown as ExtensionStorage);
    await vi.waitFor(() => expect(pruneRetryBundles).toHaveBeenCalledTimes(1));

    installedListeners[0]?.();
    startupListeners[0]?.();
    alarmListeners[0]?.({ name: "other-alarm" });
    alarmListeners[0]?.({ name: RETRY_BUNDLE_PRUNE_ALARM_NAME });

    await vi.waitFor(() => expect(pruneRetryBundles).toHaveBeenCalledTimes(4));
  });
});
