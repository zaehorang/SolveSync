/** isolated world에서 MAIN world bridge에 code를 한 번 요청한다 (ADR 0035).
 *
 * 응답은 `event.source`, `event.origin`, 전용 message type, 요청한 nonce가 모두
 * 맞을 때만 사용한다. Bridge가 없거나 응답이 늦으면 null이고, 호출한 쪽은 이를
 * empty code로 다뤄 `swea_extract_failed`가 되게 한다.
 */

import {
  isSweaBridgeResponse,
  SWEA_BRIDGE_REQUEST_SOURCE,
  type SweaBridgeRequest
} from "./sweaBridgeProtocol";

const DEFAULT_BRIDGE_TIMEOUT_MS = 2000;

export interface SweaBridgeWindow {
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  location: { origin: string };
}

export interface RequestSweaEditorCodeOptions {
  windowRef: SweaBridgeWindow;
  createNonce(): string;
  timeoutMs?: number;
  setTimeoutRef?: typeof setTimeout;
  clearTimeoutRef?: typeof clearTimeout;
}

export function requestSweaEditorCode(
  options: RequestSweaEditorCodeOptions
): Promise<string | null> {
  const windowRef = options.windowRef;
  const origin = windowRef.location.origin;
  const nonce = options.createNonce();
  const schedule = options.setTimeoutRef ?? setTimeout;
  const cancel = options.clearTimeoutRef ?? clearTimeout;

  return new Promise((resolve) => {
    let settled = false;

    const finish = (code: string | null): void => {
      if (settled) {
        return;
      }

      settled = true;
      cancel(timer);
      windowRef.removeEventListener("message", onMessage);
      resolve(code);
    };

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== windowRef || event.origin !== origin) {
        return;
      }

      if (!isSweaBridgeResponse(event.data) || event.data.nonce !== nonce) {
        return;
      }

      finish(event.data.code);
    };

    const timer = schedule(() => {
      finish(null);
    }, options.timeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS);

    windowRef.addEventListener("message", onMessage);

    const request: SweaBridgeRequest = {
      source: SWEA_BRIDGE_REQUEST_SOURCE,
      nonce
    };

    windowRef.postMessage(request, origin);
  });
}

export function createSweaBridgeNonce(): string {
  return `solvesync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
