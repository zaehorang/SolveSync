import type { ExtensionStorage } from "./storage";

export const RETRY_BUNDLE_PRUNE_ALARM_NAME = "retry-bundle-prune";
export const RETRY_BUNDLE_PRUNE_PERIOD_MINUTES = 24 * 60;

export function registerRetryBundleMaintenance(
  storage: ExtensionStorage,
  ready: Promise<void> = Promise.resolve()
): void {
  const run = () => {
    void ready
      .then(() => runRetryBundleMaintenance(storage))
      .catch((error: unknown) => {
        console.error("SolveSync retry data cleanup failed.", error);
      });
  };

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RETRY_BUNDLE_PRUNE_ALARM_NAME) {
      run();
    }
  });
  chrome.runtime.onInstalled.addListener(run);
  chrome.runtime.onStartup.addListener(run);

  run();
}

export async function runRetryBundleMaintenance(
  storage: ExtensionStorage,
  now: Date = new Date()
): Promise<void> {
  await storage.pruneRetryBundles(now.toISOString());
  await chrome.alarms.create(RETRY_BUNDLE_PRUNE_ALARM_NAME, {
    periodInMinutes: RETRY_BUNDLE_PRUNE_PERIOD_MINUTES
  });
}
