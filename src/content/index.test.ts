import { describe, expect, it } from "vitest";

import {
  createAcceptedDetectedMessage,
  createProgrammersAcceptedDetectedMessage,
  extractProgrammersAcceptedEditorSnapshot,
  extractProgrammersEditorCode,
  resolveContentToastLocale,
  resolveContentPage
} from "./index";

describe("content runtime wiring helpers", () => {
  it("resolves LeetCode and Programmers content page contexts", () => {
    expect(resolveContentPage(new URL("https://leetcode.com/problems/two-sum/"))).toEqual({
      platform: "leetcode",
      titleSlug: "two-sum"
    });
    expect(
      resolveContentPage(
        new URL("https://school.programmers.co.kr/learn/courses/30/lessons/120804")
      )
    ).toEqual({
      platform: "programmers",
      courseId: "30",
      lessonId: "120804"
    });
    expect(resolveContentPage(new URL("https://example.com/problems/two-sum/"))).toEqual({
      platform: "unsupported"
    });
  });

  it("creates accepted detected messages without solution code", () => {
    const message = createAcceptedDetectedMessage(
      "two-sum",
      "https://leetcode.com/problems/two-sum/",
      "2026-01-01T00:00:00.000Z"
    );

    expect(message).toEqual({
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "leetcode",
        titleSlug: "two-sum",
        pageUrl: "https://leetcode.com/problems/two-sum/",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });
    expect(Object.hasOwn(message.payload, "code")).toBe(false);
  });

  it("extracts Programmers textarea code and metadata into an Accepted Editor Snapshot", () => {
    const documentRef = makeDocument({
      "textarea#code": element({ value: "print(120804)\n" }),
      h1: element({ textContent: "코딩테스트 연습" }),
      h2: element({ textContent: "두 수의 곱 구하기" }),
      'meta[property="og:title"]': element({
        content: "코딩테스트 연습 - 두 수의 곱 구하기 | 프로그래머스"
      }),
      'select[name="language"]': element({
        value: "swift",
        selectedOption: element({ textContent: "Swift" })
      })
    });

    const acceptedEditorSnapshot = extractProgrammersAcceptedEditorSnapshot(
      documentRef,
      {
        courseId: "30",
        lessonId: "120804"
      },
      "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
      "2026-01-01T00:00:00.000Z"
    );

    expect(acceptedEditorSnapshot).toEqual({
      courseId: "30",
      lessonId: "120804",
      problemTitle: "두 수의 곱 구하기",
      rawLanguage: "Swift",
      code: "print(120804)\n",
      pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
      detectedAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("prefers stable Programmers page metadata over accepted modal headings", () => {
    const documentRef = makeDocument({
      "textarea#code": element({ value: "solution code\n" }),
      h1: element({ textContent: "정답입니다!" }),
      h2: element({ textContent: "1239 (+1)" }),
      'meta[property="og:title"]': element({
        content: "코딩테스트 연습 - 나이 출력 | 프로그래머스"
      }),
      'select[name="language"]': element({
        value: "swift",
        selectedOption: element({ textContent: "Swift" })
      })
    });

    const acceptedEditorSnapshot = extractProgrammersAcceptedEditorSnapshot(
      documentRef,
      {
        courseId: "30",
        lessonId: "120820"
      },
      "https://school.programmers.co.kr/learn/courses/30/lessons/120820",
      "2026-01-01T00:00:00.000Z"
    );

    expect(acceptedEditorSnapshot.problemTitle).toBe("나이 출력");
  });

  it("does not use rendered CodeMirror lines as solution code", () => {
    const documentRef = makeDocument({
      ".cm-line": element({ textContent: "visible only" })
    });

    expect(extractProgrammersEditorCode(documentRef)).toBeNull();
  });

  it("creates Programmers accepted detected messages from an Accepted Editor Snapshot", () => {
    const message = createProgrammersAcceptedDetectedMessage({
      courseId: "30",
      lessonId: "120804",
      problemTitle: "두 수의 곱 구하기",
      rawLanguage: "Swift",
      code: "import Foundation\n",
      pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
      detectedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(message).toEqual({
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "programmers",
        courseId: "30",
        lessonId: "120804",
        problemTitle: "두 수의 곱 구하기",
        language: "Swift",
        code: "import Foundation\n",
        pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });
  });

  it("resolves toast locale from settings preference and browser language", () => {
    expect(resolveContentToastLocale({ uiLanguage: "ko" }, "en-US")).toBe("ko");
    expect(resolveContentToastLocale({ uiLanguage: "en" }, "ko-KR")).toBe("en");
    expect(resolveContentToastLocale({ uiLanguage: "system" }, "ko-KR")).toBe("ko");
    expect(resolveContentToastLocale(null, "fr-FR")).toBe("en");
  });
});

interface FakeElement {
  textContent: string | null;
  value?: string;
  content?: string;
  selectedOptions?: {
    item(index: number): FakeElement | null;
  };
  getAttribute(name: string): string | null;
}

function element(input: {
  textContent?: string | null;
  value?: string;
  content?: string;
  selectedOption?: FakeElement;
  attrs?: Record<string, string>;
}): FakeElement {
  const attrs = input.attrs ?? {};

  return {
    textContent: input.textContent ?? null,
    value: input.value,
    content: input.content,
    selectedOptions:
      input.selectedOption === undefined
        ? undefined
        : {
            item(index: number) {
              return index === 0 ? input.selectedOption ?? null : null;
            }
          },
    getAttribute(name: string) {
      return attrs[name] ?? null;
    }
  };
}

function makeDocument(
  nodes: Record<string, FakeElement | null>,
  title = "코딩테스트 연습 - fallback | 프로그래머스"
): Pick<Document, "querySelector" | "title"> {
  return {
    title,
    querySelector(selector: string) {
      return (nodes[selector] ?? null) as Element | null;
    }
  } as unknown as Pick<Document, "querySelector" | "title">;
}
