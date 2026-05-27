import type { RuntimeMessage } from "../shared";

const APP_NAME = "PS-LP-Sync";

const titleSlug = getTitleSlug(window.location.pathname);

const readyMessage: RuntimeMessage = {
  type: "scaffold:ready",
  surface: "content"
};

try {
  void chrome.runtime.sendMessage(readyMessage);
} catch (error) {
  console.debug(`${APP_NAME} content script could not reach background`, error);
}

console.debug(`${APP_NAME} content script loaded`, { titleSlug });

function getTitleSlug(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([^/]+)/);
  return match?.[1] ?? null;
}
