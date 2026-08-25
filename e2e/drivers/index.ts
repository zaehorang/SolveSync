/** 등록된 Platform E2E Driver.
 *
 * 공통 spec은 이 목록만 보고 돈다. 새 플랫폼은 드라이버 파일 하나와 여기
 * 한 줄로 검증 계층 전체에 붙는다.
 *
 * 여기 없는 드라이버는 어느 계층도 돌지 않는다. 새 플랫폼을 추가하면
 * 이 목록에 한 줄을 더한다.
 */
import { leetcodeDriver } from "./leetcode";
import { programmersDriver } from "./programmers";
import { sweaDriver } from "./swea";
import type { PlatformE2EDriver } from "./types";

export const DRIVERS: PlatformE2EDriver[] = [leetcodeDriver, programmersDriver, sweaDriver];
