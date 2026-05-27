import { APP_NAME, type RuntimeMessage } from "../shared";

chrome.runtime.onInstalled.addListener(() => {
  console.info(`${APP_NAME} background service worker installed`);
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === "scaffold:ready") {
      sendResponse({ ok: true });
    }

    return false;
  }
);
