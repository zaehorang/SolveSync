/** SWEA editor bridge의 window.postMessage 계약 (ADR 0035).
 *
 * request와 response의 `source`를 다르게 둔다. 같은 값을 쓰면 bridge가 자기
 * 응답을 다시 요청으로 읽는다.
 *
 * 이 module은 isolated world content script와 MAIN world bridge bundle 양쪽에
 * 들어간다. 두 bundle 모두 IIFE이므로 여기에 runtime 의존을 추가하지 않는다.
 */

export const SWEA_BRIDGE_REQUEST_SOURCE = "solvesync-swea-bridge-request";
export const SWEA_BRIDGE_RESPONSE_SOURCE = "solvesync-swea-bridge-response";

export interface SweaBridgeRequest {
  source: typeof SWEA_BRIDGE_REQUEST_SOURCE;
  nonce: string;
}

export interface SweaBridgeResponse {
  source: typeof SWEA_BRIDGE_RESPONSE_SOURCE;
  nonce: string;
  /** editor code. 읽지 못하면 null이다. 이 외의 값은 protocol에 넣지 않는다. */
  code: string | null;
}

export function isSweaBridgeRequest(value: unknown): value is SweaBridgeRequest {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    value.source === SWEA_BRIDGE_REQUEST_SOURCE && typeof value.nonce === "string"
  );
}

export function isSweaBridgeResponse(value: unknown): value is SweaBridgeResponse {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    value.source === SWEA_BRIDGE_RESPONSE_SOURCE &&
    typeof value.nonce === "string" &&
    (typeof value.code === "string" || value.code === null)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
