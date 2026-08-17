import {
  APP_NAME,
  DEFAULT_UI_LANGUAGE,
  isRuntimeMessage,
  isUiLanguagePreference,
  resolveUiLocale,
  type PublicSettingsState,
  type RuntimeMessage
} from "../shared";
import type { SyncStatusMessage } from "../shared/messages";
import {
  resolveContentPage,
  startAcceptedDetectionController
} from "./acceptedDetectionController";
import { createSweaBridgeNonce, requestSweaEditorCode } from "./sweaBridgeClient";
import { ContentToast, createToastModel } from "./toast";

interface RuntimeSuccessResponse<T> {
  ok: true;
  data: T;
}

interface RuntimeFailureResponse {
  ok: false;
  error?: unknown;
}

type RuntimeResponse<T> = RuntimeSuccessResponse<T> | RuntimeFailureResponse;

export function resolveContentToastLocale(
  settings: Pick<PublicSettingsState, "uiLanguage"> | null,
  browserLanguage: string | null | undefined
): "en" | "ko" {
  return resolveUiLocale(settings?.uiLanguage ?? DEFAULT_UI_LANGUAGE, browserLanguage);
}

export function startContentScript(): void {
  const page = resolveContentPage(new URL(window.location.href), document);
  const toast = new ContentToast(document, sendToastAction);
  let toastRenderSequence = 0;

  sendRuntimeMessage({
    type: "scaffold:ready",
    surface: "content"
  });

  startAcceptedDetectionController({
    documentRef: document,
    getCurrentUrl: () => window.location.href,
    sendAcceptedMessage: sendRuntimeMessage,
    createObserver: (callback) => new MutationObserver(callback),
    requestSweaEditorCode: () =>
      requestSweaEditorCode({
        windowRef: window,
        createNonce: createSweaBridgeNonce
      })
  });

  chrome.runtime.onMessage.addListener((rawMessage) => {
    if (!isRuntimeMessage(rawMessage)) {
      return false;
    }

    if (rawMessage.type === "sync:status") {
      const sequence = ++toastRenderSequence;
      void showSyncStatusToast(toast, rawMessage, () => sequence === toastRenderSequence);
    }

    return false;
  });

  console.debug(`${APP_NAME} content script loaded`, { page });
}

async function showSyncStatusToast(
  toast: ContentToast,
  message: SyncStatusMessage,
  shouldRender: () => boolean
): Promise<void> {
  const locale = await readContentToastLocale();

  if (!shouldRender()) {
    return;
  }

  toast.show(createToastModel(message.payload, locale));
}

if (canStartContentScript()) {
  startContentScript();
}

function sendToastAction(
  action: Extract<RuntimeMessage, { type: "content:toast_action" }>["payload"]["action"],
  syncHistoryEntryId: string | null,
  retryBundleId: string | null
): void {
  sendRuntimeMessage({
    type: "content:toast_action",
    payload: {
      action,
      syncHistoryEntryId,
      retryBundleId
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

async function readContentToastLocale(): Promise<"en" | "ko"> {
  try {
    const response = await sendRuntimeMessageWithResponse<PublicSettingsState>({
      type: "settings:read"
    });

    if (response.ok && isUiLanguagePreference(response.data.uiLanguage)) {
      return resolveContentToastLocale(response.data, getBrowserLanguage());
    }
  } catch (error) {
    console.debug(`${APP_NAME} content toast could not read settings`, error);
  }

  return resolveContentToastLocale(null, getBrowserLanguage());
}

function sendRuntimeMessageWithResponse<T>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response: RuntimeResponse<T>) => {
        const lastError = chrome.runtime.lastError;

        if (lastError !== undefined) {
          reject(lastError);
          return;
        }

        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function getBrowserLanguage(): string | null {
  return typeof navigator === "undefined" ? null : navigator.language;
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
