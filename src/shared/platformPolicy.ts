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
    commitPlatformLabel: "leetcode"
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
