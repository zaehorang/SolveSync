import type { CodingPlatform, SupportedLanguage } from "./types";
import {
  LANGUAGE_REGISTRY,
  SUPPORTED_LANGUAGE_KEYS
} from "./languageRegistry";

export interface LanguagePathPolicy {
  folder: string;
  extension: string;
}

export interface ReadmeMarkers {
  start: string;
  end: string;
}

/** Solution README에서 문제 제목에 걸 링크의 재료.
 *
 * Catalog에 저장된 `url`을 그대로 쓸 수 없는 Coding Platform이 있어서 problem id도
 * 함께 받는다.
 */
export interface ProblemUrlInput {
  problemId: string;
  url: string;
}

export interface PlatformPolicy {
  codingPlatform: CodingPlatform;
  rootFolder: string;
  languages: Record<SupportedLanguage, LanguagePathPolicy>;
  solutionReadmePath: string;
  solutionCatalogPath: string;
  readmeMarkers: ReadmeMarkers;
  initialReadmeTitle: string;
  readmeIncludesDifficulty: boolean;
  commitPlatformLabel: string;
  /** 링크로 쓸 수 없으면 빈 문자열을 반환한다. 호출자가 링크 없이 렌더한다. */
  buildProblemUrl(problem: ProblemUrlInput): string;
}

/** query와 fragment를 떼어낸다.
 *
 * Programmers 문제 page URL에는 그때 보고 있던 언어가 `?language=python3`로
 * 남고 `#`만 붙는 경우도 있다. 문제를 가리키는 데 필요한 부분이 아니다.
 */
function stripQueryAndFragment(url: string): string {
  return url.split(/[?#]/u)[0] ?? "";
}

function buildLanguagePathPolicies(
  rootFolder: string
): Record<SupportedLanguage, LanguagePathPolicy> {
  return Object.fromEntries(
    SUPPORTED_LANGUAGE_KEYS.map((language) => {
      const definition = LANGUAGE_REGISTRY[language];

      return [
        language,
        {
          folder: `${rootFolder}/${definition.folder}`,
          extension: definition.extension
        }
      ];
    })
  ) as Record<SupportedLanguage, LanguagePathPolicy>;
}

export const PLATFORM_POLICIES = {
  leetcode: {
    codingPlatform: "leetcode",
    rootFolder: "leetcode",
    languages: buildLanguagePathPolicies("leetcode"),
    solutionReadmePath: "leetcode/README.md",
    solutionCatalogPath: "leetcode/.leetcode-sync/index.json",
    readmeMarkers: {
      start: "<!-- LEETCODE_TABLE_START -->",
      end: "<!-- LEETCODE_TABLE_END -->"
    },
    initialReadmeTitle: "LeetCode Solutions",
    readmeIncludesDifficulty: true,
    commitPlatformLabel: "leetcode",
    buildProblemUrl: (problem) => problem.url
  },
  programmers: {
    codingPlatform: "programmers",
    rootFolder: "programmers",
    languages: buildLanguagePathPolicies("programmers"),
    solutionReadmePath: "programmers/README.md",
    solutionCatalogPath: "programmers/.programmers-sync/index.json",
    readmeMarkers: {
      start: "<!-- PROGRAMMERS_TABLE_START -->",
      end: "<!-- PROGRAMMERS_TABLE_END -->"
    },
    initialReadmeTitle: "Programmers Solutions",
    readmeIncludesDifficulty: false,
    commitPlatformLabel: "programmers",
    buildProblemUrl: (problem) => stripQueryAndFragment(problem.url)
  },
  swea: {
    codingPlatform: "swea",
    rootFolder: "swea",
    languages: buildLanguagePathPolicies("swea"),
    solutionReadmePath: "swea/README.md",
    solutionCatalogPath: "swea/.swea-sync/index.json",
    readmeMarkers: {
      start: "<!-- SWEA_TABLE_START -->",
      end: "<!-- SWEA_TABLE_END -->"
    },
    initialReadmeTitle: "SW Expert Academy Solutions",
    readmeIncludesDifficulty: false,
    commitPlatformLabel: "swea",
    /** SWEA는 Accepted를 감지하는 page가 문제와 무관한 `solvingProblem.do`라
     *  Catalog의 `url`이 모든 문제에서 같다. problem id가 곧 `contestProbId`이므로
     *  링크는 그것으로 조립한다. */
    buildProblemUrl: (problem) =>
      problem.problemId.length === 0
        ? ""
        : `https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=${problem.problemId}`
  }
} as const satisfies Record<CodingPlatform, PlatformPolicy>;

export function getPlatformPolicy(codingPlatform: CodingPlatform): PlatformPolicy {
  return PLATFORM_POLICIES[codingPlatform];
}

export function getLanguagePathPolicy(
  codingPlatform: CodingPlatform,
  language: SupportedLanguage
): LanguagePathPolicy {
  return getPlatformPolicy(codingPlatform).languages[language];
}
