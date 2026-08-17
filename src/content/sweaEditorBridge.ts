/** SWEA 풀이 페이지의 MAIN world bridge (ADR 0035).
 *
 * page script와 같은 world에서 실행되며 CodeMirror instance의 `getValue()`를
 * 읽어 요청한 nonce로 한 번만 응답한다. 자발적으로 값을 보내지 않는다.
 *
 * isolated world content script에서는 CodeMirror instance가 보이지 않고,
 * `textarea#textSource`는 비어 있으며, `.CodeMirror-line`은 가상 스크롤 때문에
 * 화면에 보이는 줄만 갖는다. 그래서 이 경로가 필요하다.
 */

import {
  isSweaBridgeRequest,
  SWEA_BRIDGE_RESPONSE_SOURCE,
  type SweaBridgeResponse
} from "./sweaBridgeProtocol";

interface CodeMirrorInstance {
  getValue?: () => unknown;
}

export function readSweaEditorCode(
  documentRef: Pick<Document, "querySelectorAll">
): string | null {
  const hosts = documentRef.querySelectorAll(".CodeMirror");

  for (const host of Array.from(hosts)) {
    const editor = (host as Element & { CodeMirror?: CodeMirrorInstance })
      .CodeMirror;
    const value = editor?.getValue?.();

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

export function startSweaEditorBridge(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (!isSweaBridgeRequest(event.data)) {
      return;
    }

    const response: SweaBridgeResponse = {
      source: SWEA_BRIDGE_RESPONSE_SOURCE,
      nonce: event.data.nonce,
      code: readSweaEditorCode(document)
    };

    window.postMessage(response, window.location.origin);
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  startSweaEditorBridge();
}
