import { APP_NAME } from "../shared";
import { registerBackgroundRuntime } from "./runtime";
import { registerRetryBundleMaintenance } from "./maintenance";
import { createDefaultExtensionStorage } from "./storage";

chrome.runtime.onInstalled.addListener(() => {
  console.info(`${APP_NAME} background service worker installed`);
});

const storageAccessReady = chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS"
});
const storage = createDefaultExtensionStorage();

registerBackgroundRuntime({
  storage,
  ready: storageAccessReady
});
registerRetryBundleMaintenance(storage, storageAccessReady);
