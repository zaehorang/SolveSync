/** 등록된 Platform E2E Driver.
 *
 * 공통 spec은 이 목록만 보고 돈다. 새 플랫폼은 드라이버 파일 하나와 여기
 * 한 줄로 검증 계층 전체에 붙는다.
 *
 * **이 파일은 append만 한다.** Phase 4의 세 에이전트가 각자 한 줄씩 더하고,
 * 그 밖의 공유 파일(`e2e/support/`, 공통 spec, `package.json`,
 * `.github/workflows/ci.yml`)은 건드리지 않는다.
 */
import { leetcodeDriver } from "./leetcode";
import { programmersDriver } from "./programmers";
import { sweaDriver } from "./swea";
import type { PlatformE2EDriver } from "./types";

export const DRIVERS: PlatformE2EDriver[] = [leetcodeDriver, programmersDriver, sweaDriver];
