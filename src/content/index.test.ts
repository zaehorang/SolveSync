import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAcceptedDetectedMessage,
  createProgrammersAcceptedDetectedMessage,
  extractProgrammersAcceptedEditorSnapshot,
  extractProgrammersEditorCode,
  resolveContentPage,
  startAcceptedDetectionController
} from "./acceptedDetectionController";
import { resolveContentToastLocale } from "./index";

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

describe("accepted detection controller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures the first Programmers snapshot immediately and keeps a fixed window", () => {
    vi.useFakeTimers();
    const codeEditor = element({ value: "accepted code\n" });
    const documentRef = makeDetectionDocument({
      "textarea#code": codeEditor,
      'meta[property="og:title"]': element({
        content: "코딩테스트 연습 - 두 수의 곱 구하기 | 프로그래머스"
      }),
      'select[name="language"]': element({
        value: "swift",
        selectedOption: element({ textContent: "Swift" })
      })
    });
    const sentMessages: unknown[] = [];
    const observer = createFakeObserver();

    startAcceptedDetectionController({
      documentRef,
      getCurrentUrl: () =>
        "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
      sendAcceptedMessage: (message) => sentMessages.push(message),
      createObserver: observer.factory,
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(observer.observe).toHaveBeenCalledWith(documentRef.body, {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true
    });

    observer.emit([acceptedChildListMutation("정답입니다!")]);
    codeEditor.value = "edited but not accepted\n";
    vi.advanceTimersByTime(500);
    observer.emit([acceptedChildListMutation("정답입니다!")]);
    vi.advanceTimersByTime(199);
    expect(sentMessages).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      payload: {
        lessonId: "120804",
        code: "accepted code\n",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });
  });

  it("emits one event per real Accepted window and ignores later non-Accepted UI changes", () => {
    vi.useFakeTimers();
    const documentRef = makeDetectionDocument({});
    const sentMessages: unknown[] = [];
    const observer = createFakeObserver();

    startAcceptedDetectionController({
      documentRef,
      getCurrentUrl: () => "https://leetcode.com/problems/two-sum/",
      sendAcceptedMessage: (message) => sentMessages.push(message),
      createObserver: observer.factory,
      now: () => "2026-01-01T00:00:00.000Z"
    });

    observer.emit([acceptedChildListMutation("Accepted")]);
    vi.advanceTimersByTime(700);
    observer.emit([
      childListMutation(
        mutationElement([mutationTextNode("Accepted")]),
        [mutationTextNode("Wrong Answer")]
      )
    ]);
    vi.advanceTimersByTime(700);
    expect(sentMessages).toHaveLength(1);

    observer.emit([acceptedChildListMutation("Accepted")]);
    vi.advanceTimersByTime(700);
    expect(sentMessages).toHaveLength(2);
  });

  it("cancels pending work on SPA route changes and uses the new route next time", () => {
    vi.useFakeTimers();
    let pageUrl = "https://leetcode.com/problems/two-sum/";
    const documentRef = makeDetectionDocument({});
    const sentMessages: unknown[] = [];
    const observer = createFakeObserver();

    startAcceptedDetectionController({
      documentRef,
      getCurrentUrl: () => pageUrl,
      sendAcceptedMessage: (message) => sentMessages.push(message),
      createObserver: observer.factory,
      now: () => "2026-01-01T00:00:00.000Z"
    });

    observer.emit([acceptedChildListMutation("Accepted")]);
    pageUrl = "https://leetcode.com/problems/valid-parentheses/";
    observer.emit([acceptedChildListMutation("Accepted")]);
    vi.advanceTimersByTime(700);
    expect(sentMessages).toEqual([
      {
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "leetcode",
          titleSlug: "valid-parentheses",
          pageUrl,
          detectedAt: "2026-01-01T00:00:00.000Z"
        }
      }
    ]);
  });

  it("discards a pending event if the route changes without another mutation", () => {
    vi.useFakeTimers();
    let pageUrl = "https://leetcode.com/problems/two-sum/";
    const observer = createFakeObserver();
    const sendAcceptedMessage = vi.fn();

    startAcceptedDetectionController({
      documentRef: makeDetectionDocument({}),
      getCurrentUrl: () => pageUrl,
      sendAcceptedMessage,
      createObserver: observer.factory
    });

    observer.emit([acceptedChildListMutation("Accepted")]);
    pageUrl = "https://leetcode.com/problems/valid-parentheses/";
    vi.advanceTimersByTime(700);

    expect(sendAcceptedMessage).not.toHaveBeenCalled();
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

function makeDetectionDocument(
  nodes: Record<string, FakeElement | null>
): Pick<Document, "body" | "documentElement" | "querySelector" | "title"> {
  const root = element({ textContent: "" }) as unknown as HTMLElement;

  return {
    ...makeDocument(nodes),
    body: root,
    documentElement: root
  } as Pick<Document, "body" | "documentElement" | "querySelector" | "title">;
}

function createFakeObserver(): {
  factory: (
    callback: MutationCallback
  ) => Pick<MutationObserver, "observe" | "disconnect">;
  observe: ReturnType<typeof vi.fn>;
  emit(mutations: MutationRecord[]): void;
} {
  let callback: MutationCallback | null = null;
  const observe = vi.fn();

  return {
    factory(nextCallback) {
      callback = nextCallback;

      return {
        observe,
        disconnect: vi.fn()
      };
    },
    observe,
    emit(mutations) {
      if (callback === null) {
        throw new Error("Observer callback was not registered");
      }

      callback(mutations, {} as MutationObserver);
    }
  };
}

function acceptedChildListMutation(textContent: string): MutationRecord {
  return childListMutation(mutationElement([]), [mutationTextNode(textContent)]);
}

function childListMutation(
  target: FakeMutationNode,
  addedNodes: FakeMutationNode[]
): MutationRecord {
  return {
    type: "childList",
    target,
    addedNodes,
    removedNodes: [],
    oldValue: null
  } as unknown as MutationRecord;
}

interface FakeMutationNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: FakeMutationNode[];
  parentElement?: FakeMutationNode | null;
  getAttribute?(name: string): string | null;
  tagName?: string;
}

function mutationTextNode(textContent: string): FakeMutationNode {
  return {
    nodeType: 3,
    textContent,
    parentElement: null
  };
}

function mutationElement(childNodes: FakeMutationNode[]): FakeMutationNode {
  const node: FakeMutationNode = {
    nodeType: 1,
    textContent: childNodes.map((child) => child.textContent ?? "").join(""),
    childNodes,
    parentElement: null,
    tagName: "DIV",
    getAttribute: () => null
  };

  for (const child of childNodes) {
    child.parentElement = node;
  }

  return node;
}
