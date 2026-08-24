/** 플랫폼별 기준 문제.
 *
 * 같은 문제로 반복해야 캡처와 풀사이클 결과를 비교할 수 있다. 바꾸면 이전
 * 캡처와의 비교가 끊기므로 바꿀 때는 플랫폼 문서도 함께 고친다.
 */
import type { CodingPlatform } from "../../src/shared";

export interface BaseProblem {
  readonly platform: CodingPlatform;
  readonly url: string;
  /** 사람이 문제를 알아보기 위한 이름. 코드에서 쓰지 않는다. */
  readonly label: string;
}

export const BASE_PROBLEMS: Record<CodingPlatform, BaseProblem> = {
  leetcode: {
    platform: "leetcode",
    url: "https://leetcode.com/problems/two-sum/",
    label: "Two Sum"
  },
  programmers: {
    platform: "programmers",
    url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
    label: "두 수의 곱 구하기 (코딩테스트 입문)"
  },
  swea: {
    // 모든 문제가 같은 URL을 쓰므로 contestProbId를 query로 넘긴다.
    platform: "swea",
    url: "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do?contestProbId=AV134DPqAA8CFAYh",
    label: "1206. View"
  }
};
