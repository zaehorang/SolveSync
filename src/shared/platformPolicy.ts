import type { CodingPlatform, SupportedLanguage } from "./types";

export interface LanguagePathPolicy {
  folder: string;
  extension: string;
}

export interface ReadmeMarkers {
  start: string;
  end: string;
}

export interface PlatformPolicy {
  codingPlatform: CodingPlatform;
  rootFolder: string;
  languages: Record<SupportedLanguage, LanguagePathPolicy>;
  solutionReadmePath: string;
  solutionCatalogPath: string;
  readmeMarkers: ReadmeMarkers;
  initialReadmeTitle: string;
  commitPlatformLabel: string;
}

export const PLATFORM_POLICIES = {
  leetcode: {
    codingPlatform: "leetcode",
    rootFolder: "leetcode",
    languages: {
      swift: {
        folder: "leetcode/swift",
        extension: "swift"
      },
      python3: {
        folder: "leetcode/python",
        extension: "py"
      }
    },
    solutionReadmePath: "leetcode/README.md",
    solutionCatalogPath: "leetcode/.leetcode-sync/index.json",
    readmeMarkers: {
      start: "<!-- LEETCODE_TABLE_START -->",
      end: "<!-- LEETCODE_TABLE_END -->"
    },
    initialReadmeTitle: "LeetCode Solutions",
    commitPlatformLabel: "leetcode"
  },
  programmers: {
    codingPlatform: "programmers",
    rootFolder: "programmers",
    languages: {
      swift: {
        folder: "programmers/swift",
        extension: "swift"
      },
      python3: {
        folder: "programmers/python",
        extension: "py"
      }
    },
    solutionReadmePath: "programmers/README.md",
    solutionCatalogPath: "programmers/.programmers-sync/index.json",
    readmeMarkers: {
      start: "<!-- PROGRAMMERS_TABLE_START -->",
      end: "<!-- PROGRAMMERS_TABLE_END -->"
    },
    initialReadmeTitle: "Programmers Solutions",
    commitPlatformLabel: "programmers"
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
