import type { Platform, SupportedLanguage } from "./types";

export interface LanguagePathPolicy {
  folder: string;
  extension: string;
}

export interface ReadmeMarkers {
  start: string;
  end: string;
}

export interface PlatformPolicy {
  platform: Platform;
  rootFolder: string;
  languages: Record<SupportedLanguage, LanguagePathPolicy>;
  readmePath: string;
  indexPath: string;
  readmeMarkers: ReadmeMarkers;
  initialReadmeTitle: string;
  commitPlatformLabel: string;
}

export const PLATFORM_POLICIES = {
  leetcode: {
    platform: "leetcode",
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
    readmePath: "leetcode/README.md",
    indexPath: "leetcode/.leetcode-sync/index.json",
    readmeMarkers: {
      start: "<!-- LEETCODE_TABLE_START -->",
      end: "<!-- LEETCODE_TABLE_END -->"
    },
    initialReadmeTitle: "LeetCode Solutions",
    commitPlatformLabel: "leetcode"
  },
  programmers: {
    platform: "programmers",
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
    readmePath: "programmers/README.md",
    indexPath: "programmers/.programmers-sync/index.json",
    readmeMarkers: {
      start: "<!-- PROGRAMMERS_TABLE_START -->",
      end: "<!-- PROGRAMMERS_TABLE_END -->"
    },
    initialReadmeTitle: "Programmers Solutions",
    commitPlatformLabel: "programmers"
  }
} as const satisfies Record<Platform, PlatformPolicy>;

export function getPlatformPolicy(platform: Platform): PlatformPolicy {
  return PLATFORM_POLICIES[platform];
}

export function getLanguagePathPolicy(
  platform: Platform,
  language: SupportedLanguage
): LanguagePathPolicy {
  return getPlatformPolicy(platform).languages[language];
}
