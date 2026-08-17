import type { CodingPlatform, SupportedLanguage } from "./types";

export interface LanguageDefinition {
  key: SupportedLanguage;
  displayName: string;
  folder: string;
  extension: string;
  aliases: Record<CodingPlatform, readonly string[]>;
}

export const SUPPORTED_LANGUAGE_KEYS = [
  "swift",
  "python3",
  "java",
  "cpp",
  "javascript",
  "typescript",
  "kotlin",
  "go",
  "rust"
] as const satisfies readonly SupportedLanguage[];

export const LANGUAGE_REGISTRY: Record<SupportedLanguage, LanguageDefinition> = {
  swift: {
    key: "swift",
    displayName: "Swift",
    folder: "swift",
    extension: "swift",
    aliases: {
      leetcode: ["swift"],
      programmers: ["swift"]
    }
  },
  python3: {
    key: "python3",
    displayName: "Python3",
    folder: "python",
    extension: "py",
    aliases: {
      leetcode: ["python3"],
      programmers: ["python3"]
    }
  },
  java: {
    key: "java",
    displayName: "Java",
    folder: "java",
    extension: "java",
    aliases: {
      leetcode: ["java"],
      programmers: ["java"]
    }
  },
  cpp: {
    key: "cpp",
    displayName: "C++",
    folder: "cpp",
    extension: "cpp",
    aliases: {
      leetcode: ["c++", "cpp", "gnu c++"],
      programmers: ["c++", "cpp", "gnu c++"]
    }
  },
  javascript: {
    key: "javascript",
    displayName: "JavaScript",
    folder: "javascript",
    extension: "js",
    aliases: {
      leetcode: ["javascript"],
      programmers: ["javascript"]
    }
  },
  typescript: {
    key: "typescript",
    displayName: "TypeScript",
    folder: "typescript",
    extension: "ts",
    aliases: {
      leetcode: ["typescript"],
      programmers: ["typescript"]
    }
  },
  kotlin: {
    key: "kotlin",
    displayName: "Kotlin",
    folder: "kotlin",
    extension: "kt",
    aliases: {
      leetcode: ["kotlin"],
      programmers: ["kotlin"]
    }
  },
  go: {
    key: "go",
    displayName: "Go",
    folder: "go",
    extension: "go",
    aliases: {
      leetcode: ["go", "golang"],
      programmers: ["go", "golang"]
    }
  },
  rust: {
    key: "rust",
    displayName: "Rust",
    folder: "rust",
    extension: "rs",
    aliases: {
      leetcode: ["rust"],
      programmers: ["rust"]
    }
  }
};

export function getLanguageDefinition(
  language: SupportedLanguage
): LanguageDefinition {
  return LANGUAGE_REGISTRY[language];
}

export function mapPlatformLanguage(
  codingPlatform: CodingPlatform,
  rawLanguage: string
): SupportedLanguage | null {
  const normalized = normalizeLanguageAlias(rawLanguage);

  for (const language of SUPPORTED_LANGUAGE_KEYS) {
    if (
      LANGUAGE_REGISTRY[language].aliases[codingPlatform].some(
        (alias) => normalizeLanguageAlias(alias) === normalized
      )
    ) {
      return language;
    }
  }

  return null;
}

/** alias 비교용 정규화.
 *
 * 공백, `_`, `-`를 모두 제거하므로 `Python 3`, `python-3`, `python3`은 같은
 * 값이 된다. 표기 변형은 여기서 흡수되므로 alias 목록에는 정규화 후 서로 다른
 * 것만 둔다. `c++`와 `cpp`처럼 실제로 다른 것만 나열한다.
 */
function normalizeLanguageAlias(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
