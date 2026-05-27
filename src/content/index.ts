import {
  APP_NAME,
  isRuntimeMessage,
  type AcceptedDetectedMessage,
  type RuntimeMessage
} from "../shared";
import {
  createDebouncedCallback,
  extractTitleSlugFromPathname,
  mutationListHasAccepted
} from "./detector";
import { ContentToast, createToastModel } from "./toast";

const ACCEPTED_DEBOUNCE_MS = 700;

export function createAcceptedDetectedMessage(
  titleSlug: string,
  pageUrl: string,
  detectedAt: string
): AcceptedDetectedMessage {
  return {
    type: "content:accepted_detected",
    payload: {
      titleSlug,
      pageUrl,
      detectedAt
    }
  };
}

export function startContentScript(): void {
  const titleSlug = extractTitleSlugFromPathname(window.location.pathname);
  const toast = new ContentToast(document, sendToastAction);

  sendRuntimeMessage({
    type: "scaffold:ready",
    surface: "content"
  });

  if (titleSlug !== null) {
    startAcceptedObserver(titleSlug);
  }

  chrome.runtime.onMessage.addListener((rawMessage) => {
    if (!isRuntimeMessage(rawMessage)) {
      return false;
    }

    if (rawMessage.type === "sync:status") {
      toast.show(createToastModel(rawMessage.payload));
    }

    return false;
  });

  console.debug(`${APP_NAME} content script loaded`, { titleSlug });
}

if (canStartContentScript()) {
  startContentScript();
}

function startAcceptedObserver(slug: string): void {
  const notifyAccepted = createDebouncedCallback(() => {
    sendRuntimeMessage(
      createAcceptedDetectedMessage(slug, window.location.href, new Date().toISOString())
    );
  }, ACCEPTED_DEBOUNCE_MS);

  const observer = new MutationObserver((mutations) => {
    if (mutationListHasAccepted(mutations)) {
      notifyAccepted();
    }
  });

  observer.observe(document.body ?? document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

function sendToastAction(
  action: Extract<RuntimeMessage, { type: "content:toast_action" }>["payload"]["action"],
  recordId: string | null
): void {
  sendRuntimeMessage({
    type: "content:toast_action",
    payload: {
      action,
      recordId
    }
  });
}

function sendRuntimeMessage(message: RuntimeMessage): void {
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    console.debug(`${APP_NAME} content script could not reach background`, error);
  }
}

function canStartContentScript(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof chrome !== "undefined" &&
    chrome.runtime?.sendMessage !== undefined &&
    chrome.runtime?.onMessage !== undefined
  );
}
