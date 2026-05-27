import { APP_NAME } from "../shared";
import { registerBackgroundRuntime } from "./runtime";

chrome.runtime.onInstalled.addListener(() => {
  console.info(`${APP_NAME} background service worker installed`);
});

registerBackgroundRuntime();
