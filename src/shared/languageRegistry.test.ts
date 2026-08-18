import { describe, expect, it } from "vitest";

import {
  LANGUAGE_REGISTRY,
  SUPPORTED_LANGUAGE_KEYS,
  getLanguageDefinition,
  mapPlatformLanguage
} from "./languageRegistry";
import type { CodingPlatform } from "./types";

const CODING_PLATFORMS: readonly CodingPlatform[] = [
  "leetcode",
  "programmers",
  "swea"
];

/** 각 플랫폼이 실제로 제출 언어로 제공하는 것. SWEA는 `select#sel_lang`에
 * C++14, JAVA, Python 3 셋만 둔다. */
const PLATFORM_SUPPORTED_LANGUAGES: Record<CodingPlatform, readonly string[]> = {
  leetcode: SUPPORTED_LANGUAGE_KEYS,
  programmers: SUPPORTED_LANGUAGE_KEYS,
  swea: ["python3", "java", "cpp"]
};

/** registry가 alias를 비교할 때 쓰는 정규화와 같은 규칙. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

describe("registry 무결성", () => {
  it("모든 지원 언어에 정의가 있고 key가 자기 자신을 가리킨다", () => {
    for (const language of SUPPORTED_LANGUAGE_KEYS) {
      expect(LANGUAGE_REGISTRY[language]).toBeDefined();
      expect(LANGUAGE_REGISTRY[language].key).toBe(language);
    }

    expect(Object.keys(LANGUAGE_REGISTRY).sort()).toEqual(
      [...SUPPORTED_LANGUAGE_KEYS].sort()
    );
  });

  it("folder와 extension이 언어마다 겹치지 않는다", () => {
    // 겹치면 서로 다른 언어의 Solution File이 같은 경로로 덮어써진다.
    const folders = SUPPORTED_LANGUAGE_KEYS.map(
      (language) => LANGUAGE_REGISTRY[language].folder
    );
    const extensions = SUPPORTED_LANGUAGE_KEYS.map(
      (language) => LANGUAGE_REGISTRY[language].extension
    );

    expect(new Set(folders).size).toBe(folders.length);
    expect(new Set(extensions).size).toBe(extensions.length);
  });

  it("folder와 extension에 경로 구분자나 공백이 없다", () => {
    for (const language of SUPPORTED_LANGUAGE_KEYS) {
      const { folder, extension } = LANGUAGE_REGISTRY[language];
      expect(folder).toMatch(/^[a-z0-9+]+$/u);
      expect(extension).toMatch(/^[a-z0-9+]+$/u);
    }
  });

  it("alias가 등록된 조합은 모두 자기 key로 매핑된다", () => {
    for (const language of SUPPORTED_LANGUAGE_KEYS) {
      for (const codingPlatform of CODING_PLATFORMS) {
        for (const alias of LANGUAGE_REGISTRY[language].aliases[codingPlatform]) {
          expect(mapPlatformLanguage(codingPlatform, alias)).toBe(language);
        }
      }
    }
  });

  it("플랫폼별 alias 보유 언어가 그 플랫폼의 실제 제출 언어와 일치한다", () => {
    // alias가 비어 있다는 것은 그 플랫폼이 그 언어를 제공하지 않는다는 뜻이다.
    // 실수로 비운 것과 구분되도록 기대 집합을 명시한다.
    for (const codingPlatform of CODING_PLATFORMS) {
      const withAliases = SUPPORTED_LANGUAGE_KEYS.filter(
        (language) => LANGUAGE_REGISTRY[language].aliases[codingPlatform].length > 0
      );

      expect([...withAliases].sort()).toEqual(
        [...PLATFORM_SUPPORTED_LANGUAGES[codingPlatform]].sort()
      );
    }
  });

  it("서로 다른 언어가 같은 alias를 쓰지 않는다", () => {
    // 겹치면 먼저 등록된 언어가 이기고 나머지는 조용히 도달 불가가 된다.
    for (const codingPlatform of CODING_PLATFORMS) {
      const seen = new Map<string, string>();

      for (const language of SUPPORTED_LANGUAGE_KEYS) {
        for (const alias of LANGUAGE_REGISTRY[language].aliases[codingPlatform]) {
          const key = normalize(alias);
          expect(seen.get(key) ?? language).toBe(language);
          seen.set(key, language);
        }
      }
    }
  });

  it("한 언어 안에 정규화 후 중복되는 alias가 없다", () => {
    // normalizeLanguageAlias가 공백, _, -를 모두 제거하므로 "python 3"은
    // "python3"과 같은 값이 된다. 그런 alias는 동작에 영향이 없는 죽은 설정이다.
    for (const language of SUPPORTED_LANGUAGE_KEYS) {
      for (const codingPlatform of CODING_PLATFORMS) {
        const aliases = LANGUAGE_REGISTRY[language].aliases[codingPlatform];
        const normalized = aliases.map(normalize);

        expect(new Set(normalized).size).toBe(normalized.length);
      }
    }
  });
});

describe("mapPlatformLanguage", () => {
  it("대소문자, 앞뒤 공백, 구분자 표기를 흡수한다", () => {
    expect(mapPlatformLanguage("leetcode", "  Swift ")).toBe("swift");
    expect(mapPlatformLanguage("leetcode", "GNU C++")).toBe("cpp");
    expect(mapPlatformLanguage("leetcode", "Java_Script")).toBe("javascript");
    expect(mapPlatformLanguage("programmers", "Python-3")).toBe("python3");
  });

  it("지원하지 않는 언어는 null을 돌려준다", () => {
    // 지원 목록 밖 언어는 commit하지 않는다는 제품 계약을 여기서 지킨다.
    for (const raw of ["ruby", "c", "php", "", "   "]) {
      expect(mapPlatformLanguage("leetcode", raw)).toBeNull();
    }
  });

  it("java가 javascript로 흡수되지 않는다", () => {
    expect(mapPlatformLanguage("leetcode", "java")).toBe("java");
    expect(mapPlatformLanguage("leetcode", "javascript")).toBe("javascript");
  });

  it("SWEA는 option value code와 version 없는 display 표기를 모두 받는다", () => {
    expect(mapPlatformLanguage("swea", "P")).toBe("cpp");
    expect(mapPlatformLanguage("swea", "J")).toBe("java");
    expect(mapPlatformLanguage("swea", "Y")).toBe("python3");
    expect(mapPlatformLanguage("swea", "C++14")).toBe("cpp");
    expect(mapPlatformLanguage("swea", "Python 3")).toBe("python3");
  });

  it("SWEA가 제공하지 않는 언어는 null을 돌려준다", () => {
    // SWEA 경로에는 Swift가 없다. 다른 플랫폼 alias가 새어 들어오면 안 된다.
    expect(mapPlatformLanguage("swea", "swift")).toBeNull();
    expect(mapPlatformLanguage("swea", "kotlin")).toBeNull();
  });
});

describe("getLanguageDefinition", () => {
  it("registry 항목을 그대로 돌려준다", () => {
    expect(getLanguageDefinition("python3")).toEqual(
      LANGUAGE_REGISTRY.python3
    );
    expect(getLanguageDefinition("python3").folder).toBe("python");
    expect(getLanguageDefinition("python3").extension).toBe("py");
  });
});
