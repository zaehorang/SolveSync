/** 드라이버가 쓰는 판정 text가 캡처에 실재하는지 확인한다.
 *
 * Sealed E2E는 최소 뼈대 page를 짓는다. 그 자유도가 **판정 text까지 상상하는
 * 데로 번지면** 우리가 상상한 DOM으로 우리 adapter를 검증하는 순환이 되고,
 * 통과해도 아무것도 보장하지 않는다.
 *
 * 그래서 text는 드라이버에 상수로 두되(읽고 리뷰할 수 있어야 한다) 그 값이
 * `e2e/fixtures/{platform}/{outcome}.json`에 실재하는지 공통 spec이 재생 전에
 * 확인한다. 플랫폼이 문구를 바꿔 새 캡처가 들어오면 이 확인이 먼저 깨진다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CodingPlatform } from "../../src/shared";
import type { SealedOutcome } from "../drivers/types";

const fixturesRoot = fileURLToPath(new URL("../fixtures", import.meta.url));

const cache = new Map<string, string>();

/** 캡처 JSON 전체를 문자열로 본다.
 *
 * 판정 text가 어느 필드에 담기는지는 플랫폼마다 다르다 — SWEA는 layer를
 * 품은 element의 text, Programmers는 `watchedAfter.titleText`, LeetCode는
 * 제자리 교체된 text node다. 필드를 특정하면 그 자체가 또 하나의 가정이
 * 되므로 "캡처 어딘가에 있었는가"만 묻는다. */
function readRecording(
  platform: CodingPlatform,
  outcome: SealedOutcome
): string {
  const key = `${platform}/${outcome}`;
  const cached = cache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const contents = readFileSync(resolve(fixturesRoot, `${key}.json`), "utf8");

  cache.set(key, contents);

  return contents;
}

export function capturedRecordingContains(
  platform: CodingPlatform,
  outcome: SealedOutcome,
  text: string
): boolean {
  // 캡처는 JSON이라 문자열이 이스케이프돼 있다. 같은 규칙으로 인코딩해 찾는다.
  const encoded = JSON.stringify(text).slice(1, -1);

  return readRecording(platform, outcome).includes(encoded);
}
