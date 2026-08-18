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
    const emptyDocument = { querySelector: () => null };

    expect(
      resolveContentPage(new URL("https://leetcode.com/problems/two-sum/"), emptyDocument)
    ).toEqual({
      platform: "leetcode",
      titleSlug: "two-sum"
    });
    expect(
      resolveContentPage(
        new URL("https://school.programmers.co.kr/learn/courses/30/lessons/120804"),
        emptyDocument
      )
    ).toEqual({
      platform: "programmers",
      courseId: "30",
      lessonId: "120804"
    });
    expect(
      resolveContentPage(new URL("https://example.com/problems/two-sum/"), emptyDocument)
    ).toEqual({
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

  it("delivers the first Programmers snapshot at once and ignores the rest of the window", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "accepted code\n",
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(harness.observer.observe).toHaveBeenCalledWith(harness.documentRef.body, {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    // timer를 전혀 돌리지 않아도 이미 전달되어 있어야 한다.
    expect(harness.sentMessages).toHaveLength(1);

    harness.codeEditor.value = "edited but not accepted\n";
    vi.advanceTimersByTime(500);
    harness.observer.emit([acceptedChildListMutation("정답입니다!")]);
    vi.advanceTimersByTime(200);

    // 창 안의 후속 signal은 두 번째 event를 만들지 않는다.
    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        lessonId: "120804",
        code: "accepted code\n",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });
  });

  it("detects a reused hidden Programmers modal when it becomes visible exactly once", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first accepted code\n",
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(harness.observer.observe).toHaveBeenCalledWith(harness.modal, {
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "class", "style"]
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.codeEditor.value = "edited after Accepted\n";
    harness.observer.emit([attributeMutation(harness.modal, "class")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        code: "first accepted code\n"
      }
    });
  });

  it("coalesces text and visibility signals for one Programmers presentation episode", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness();

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([
      acceptedChildListMutation("정답입니다!"),
      attributeMutation(harness.modal, "aria-hidden")
    ]);
    vi.advanceTimersByTime(700);

    harness.observer.emit([acceptedChildListMutation("정답입니다!")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(1);
  });

  it("re-arms after close and ignores a visible Wrong Answer before a second Accepted", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first accepted code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    harness.modal.setAttribute("aria-hidden", "true");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.modal.setTitle("오답입니다!");
    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);
    expect(harness.sentMessages).toHaveLength(1);

    harness.modal.setAttribute("aria-hidden", "true");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.modal.setTitle("정답입니다!");
    harness.codeEditor.value = "second accepted code\n";
    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(2);
    expect(harness.sentMessages[1]).toMatchObject({
      payload: {
        code: "second accepted code\n"
      }
    });
  });

  it("re-arms when a visible Accepted title becomes non-Accepted", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness();

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    harness.modal.setTitle("오답입니다!");
    harness.observer.emit([
      programmersCharacterDataMutation(
        harness.modal,
        "오답입니다!",
        "정답입니다!"
      )
    ]);
    harness.modal.setTitle("정답입니다!");
    harness.observer.emit([
      programmersCharacterDataMutation(
        harness.modal,
        "정답입니다!",
        "오답입니다!"
      )
    ]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(2);
  });

  it("delivers Programmers events for both routes across an SPA move", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first route code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.setPageUrl(
      "https://school.programmers.co.kr/learn/courses/30/lessons/120820"
    );
    harness.codeEditor.value = "second route code\n";
    harness.observer.emit([acceptedChildListMutation("정답입니다!")]);
    vi.advanceTimersByTime(700);

    // 앞 route에서 관찰한 Accepted도 그 route의 snapshot으로 전달된다. 미뤘다가
    // 버리면 사용자가 푼 문제가 조용히 사라진다.
    expect(harness.sentMessages).toHaveLength(2);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        lessonId: "120804",
        code: "first route code\n"
      }
    });
    expect(harness.sentMessages[1]).toMatchObject({
      payload: {
        lessonId: "120820",
        pageUrl: harness.pageUrl(),
        code: "second route code\n"
      }
    });
  });

  it("detects an attribute-only Accepted on a new Programmers route using the same modal root", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first route code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.modal.setAttribute("aria-hidden", "true");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);

    harness.setPageUrl(
      "https://school.programmers.co.kr/learn/courses/30/lessons/120820"
    );
    harness.codeEditor.value = "second route code\n";
    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(2);
    expect(harness.sentMessages[1]).toMatchObject({
      payload: {
        lessonId: "120820",
        pageUrl: harness.pageUrl(),
        code: "second route code\n"
      }
    });
  });

  it("keeps a stale visible Accepted as the new route baseline without a fresh signal", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "old route code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.setPageUrl(
      "https://school.programmers.co.kr/learn/courses/30/lessons/120820"
    );
    harness.observer.emit([
      childListMutation(mutationElement([]), [mutationTextNode("새 문제")])
    ]);
    harness.observer.emit([attributeMutation(harness.modal, "class")]);
    vi.advanceTimersByTime(700);

    // 새 route에서는 fresh 신호가 없었다. 앞 route의 event 하나만 남는다.
    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        lessonId: "120804",
        code: "old route code\n"
      }
    });
  });

  it("rebinds a replacement modal root and treats its current state as baseline", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness();
    const oldRoot = harness.modal;
    const replacementRoot = programmersModal("정답입니다!");

    harness.replaceModal(replacementRoot);
    harness.observer.emit([
      childListMutation(mutationElement([]), [mutationElement([])])
    ]);
    harness.observer.emit([attributeMutation(oldRoot, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(0);
    expect(harness.observer.disconnect).toHaveBeenCalledTimes(2);
    expect(harness.observer.observe).toHaveBeenCalledWith(replacementRoot, {
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "class", "style"]
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

  it("delivers one event per route across an SPA move", () => {
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
          titleSlug: "two-sum",
          pageUrl: "https://leetcode.com/problems/two-sum/",
          detectedAt: "2026-01-01T00:00:00.000Z"
        }
      },
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

  it("keeps an event captured before the user leaves the route", () => {
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

    // 감지 시점에 전달했으므로 사용자가 곧바로 이동해도 남는다.
    expect(sendAcceptedMessage).toHaveBeenCalledTimes(1);
    expect(sendAcceptedMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ titleSlug: "two-sum" })
      })
    );
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

interface FakeProgrammersModal extends FakeElement {
  parentElement: Element | null;
  ownerDocument: Document | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  querySelector(selector: string): Element | null;
  setTitle(title: string): void;
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

function programmersModal(
  initialTitle: string,
  initialAttributes: Record<string, string> = {}
): FakeProgrammersModal {
  const attributes = new Map(Object.entries(initialAttributes));
  let title = initialTitle;

  return {
    get textContent() {
      return title;
    },
    set textContent(value: string | null) {
      title = value ?? "";
    },
    parentElement: null,
    ownerDocument: null,
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    querySelector(selector) {
      return selector === ".modal-title"
        ? ({ textContent: title } as Element)
        : null;
    },
    setTitle(nextTitle) {
      title = nextTitle;
    }
  };
}

function createProgrammersControllerHarness(
  options: {
    code?: string;
    now?: () => string;
    pageUrl?: string;
  } = {}
) {
  let pageUrl =
    options.pageUrl ??
    "https://school.programmers.co.kr/learn/courses/30/lessons/120804";
  const codeEditor = element({ value: options.code ?? "accepted code\n" });
  const modal = programmersModal("정답입니다!", { "aria-hidden": "true" });
  const nodes: Record<string, FakeElement | null> = {
    "#modal-dialog": modal,
    "textarea#code": codeEditor,
    'meta[property="og:title"]': element({
      content: "코딩테스트 연습 - 두 수의 곱 구하기 | 프로그래머스"
    }),
    'select[name="language"]': element({
      value: "swift",
      selectedOption: element({ textContent: "Swift" })
    })
  };
  const documentRef = makeDetectionDocument(nodes);
  const sentMessages: unknown[] = [];
  const observer = createFakeObserver();

  startAcceptedDetectionController({
    documentRef,
    getCurrentUrl: () => pageUrl,
    sendAcceptedMessage: (message) => sentMessages.push(message),
    createObserver: observer.factory,
    now: options.now
  });

  return {
    codeEditor,
    documentRef,
    modal,
    observer,
    sentMessages,
    pageUrl: () => pageUrl,
    replaceModal(nextModal: FakeProgrammersModal) {
      nodes["#modal-dialog"] = nextModal;
    },
    setPageUrl(nextPageUrl: string) {
      pageUrl = nextPageUrl;
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
  disconnect: ReturnType<typeof vi.fn>;
  emit(mutations: MutationRecord[]): void;
} {
  let callback: MutationCallback | null = null;
  const observe = vi.fn();
  const disconnect = vi.fn();

  return {
    factory(nextCallback) {
      callback = nextCallback;

      return {
        observe,
        disconnect
      };
    },
    observe,
    disconnect,
    emit(mutations) {
      if (callback === null) {
        throw new Error("Observer callback was not registered");
      }

      callback(mutations, {} as MutationObserver);
    }
  };
}

function attributeMutation(
  target: FakeProgrammersModal,
  attributeName: string
): MutationRecord {
  return {
    type: "attributes",
    target: target as unknown as Node,
    attributeName,
    oldValue: null
  } as MutationRecord;
}

function programmersCharacterDataMutation(
  modal: FakeProgrammersModal,
  textContent: string,
  oldValue: string
): MutationRecord {
  const target = mutationTextNode(textContent);
  target.parentElement = modal as unknown as FakeMutationNode;

  return {
    type: "characterData",
    target: target as unknown as Node,
    addedNodes: [],
    removedNodes: [],
    oldValue
  } as unknown as MutationRecord;
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
