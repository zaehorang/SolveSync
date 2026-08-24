import { describe, expect, it } from "vitest";

import { mutationListMatchesText } from "../mutationText";
import {
  elementNode,
  mutationRecord,
  nestedElement,
  textNode,
  type TestCandidateNode
} from "../__fixtures__/mutation";
import { acceptedChildListMutation } from "../__fixtures__/dom";
import {
  createProgrammersAdapter,
  extractProgrammersEditorCode,
  extractProgrammersRouteFromPathname,
  isProgrammersAcceptedCandidate,
  isProgrammersAcceptedResultText
} from "./programmers";

/** 순회는 공통이고 판정만 Programmers 것을 쓴다. */
function mutationListHasAccepted(mutations: readonly MutationRecord[]): boolean {
  return mutationListMatchesText(mutations, isProgrammersAcceptedCandidate);
}

describe("Programmers content detector", () => {
  it("extracts course and lesson ids from Programmers lesson paths", () => {
    expect(
      extractProgrammersRouteFromPathname("/learn/courses/30/lessons/120804")
    ).toEqual({
      courseId: "30",
      lessonId: "120804"
    });
    expect(
      extractProgrammersRouteFromPathname("/learn/courses/30/lessons/120804?foo=bar")
    ).toEqual({
      courseId: "30",
      lessonId: "120804"
    });
    expect(extractProgrammersRouteFromPathname("/learn/courses/30")).toBeNull();
  });

  it("detects the Programmers accepted modal text", () => {
    const mutation = mutationRecord({
      target: textNode("채점 결과"),
      addedNodes: [elementNode([textNode("정답입니다!")])]
    });

    expect(isProgrammersAcceptedResultText("정답입니다!")).toBe(true);
    expect(mutationListHasAccepted([mutation])).toBe(true);
  });

  it("does not treat Programmers result summary text as accepted", () => {
    const passed = mutationRecord({
      target: textNode("실행 결과"),
      addedNodes: [elementNode([textNode("통과")])]
    });
    const summary = mutationRecord({
      target: textNode("채점 결과"),
      addedNodes: [elementNode([textNode("합계: 100.0 / 100.0")])]
    });

    expect(isProgrammersAcceptedResultText("통과")).toBe(false);
    expect(isProgrammersAcceptedResultText("채점 결과")).toBe(false);
    expect(isProgrammersAcceptedResultText("합계: 100.0 / 100.0")).toBe(false);
    expect(isProgrammersAcceptedResultText("결과: 정답입니다!")).toBe(false);
    expect(mutationListHasAccepted([passed])).toBe(false);
    expect(mutationListHasAccepted([summary])).toBe(false);
  });

  it("does not reuse a stale accepted modal when code execution adds 통과", () => {
    const mutation = mutationRecord({
      target: elementNode([
        elementNode([textNode("정답입니다!")]),
        elementNode([textNode("실행 결과")])
      ]),
      addedNodes: [elementNode([textNode("통과")])]
    });

    expect(mutationListHasAccepted([mutation])).toBe(false);
  });

  it("detects a Korean Accepted phrase split across new sibling nodes", () => {
    const mutation = mutationRecord({
      target: elementNode([]),
      addedNodes: [textNode("정답입니다"), textNode("!")]
    });

    expect(mutationListHasAccepted([mutation])).toBe(true);
  });
});

describe("Programmers presentation lifecycle", () => {
  it("hidden Accepted presentation은 event 없는 baseline이다", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });

    expect(harness(root).detect([])).toBe(false);
  });

  it("hidden Accepted presentation이 보이게 되면 한 번만 signal을 만든다", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const observation = harness(root);

    root.removeAttribute("aria-hidden");

    expect(observation.detect([attributeMutation(root, "aria-hidden")])).toBe(true);
    expect(observation.detect([attributeMutation(root, "class")])).toBe(false);
  });

  it("attribute batch 하나를 그 batch가 끝난 DOM state로 판정한다", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const observation = harness(root);

    root.removeAttribute("aria-hidden");
    root.setAttribute("class", "modal fade show");

    expect(
      observation.detect([
        attributeMutation(root, "aria-hidden"),
        attributeMutation(root, "class")
      ])
    ).toBe(true);

    root.setAttribute("aria-hidden", "true");
    root.removeAttribute("aria-hidden");

    expect(
      observation.detect([
        attributeMutation(root, "aria-hidden"),
        attributeMutation(root, "aria-hidden")
      ])
    ).toBe(false);
  });

  it("hidden 속성과 computed style visibility 전환을 모두 본다", () => {
    const hiddenRoot = presentationRoot("정답입니다!", { hidden: "" });
    const hidden = harness(hiddenRoot);

    hiddenRoot.removeAttribute("hidden");
    expect(hidden.detect([attributeMutation(hiddenRoot, "hidden")])).toBe(true);

    const styledRoot = presentationRoot("정답입니다!", {}, { display: "none" });
    const styled = harness(styledRoot);

    styledRoot.computedStyle.display = "block";
    expect(styled.detect([attributeMutation(styledRoot, "style")])).toBe(true);
  });

  it("보이던 presentation이 inactive가 되면 다시 무장한다", () => {
    const root = presentationRoot("정답입니다!");
    const observation = harness(root);

    root.setAttribute("aria-hidden", "true");
    expect(observation.detect([attributeMutation(root, "aria-hidden")])).toBe(false);

    root.removeAttribute("aria-hidden");
    expect(observation.detect([attributeMutation(root, "aria-hidden")])).toBe(true);
  });

  it("non-Accepted title에서 다시 무장하되 무관한 내용으로 승격하지 않는다", () => {
    const root = presentationRoot("정답입니다!");
    const observation = harness(root);

    root.setTitle("오답입니다!");
    expect(observation.detect([contentMutation(root)])).toBe(false);

    root.setTitle("정답입니다!");
    expect(
      observation.detect([contentMutation(root), acceptedChildListMutation("정답입니다!")])
    ).toBe(true);
  });

  it("대표적인 non-Accepted title text를 Accepted로 보지 않는다", () => {
    const root = presentationRoot("채점 결과", { "aria-hidden": "true" });
    const observation = harness(root);

    root.removeAttribute("aria-hidden");

    expect(observation.detect([attributeMutation(root, "aria-hidden")])).toBe(false);
  });

  it("교체된 root를 baseline으로 잡고 옛 root의 record는 무시한다", () => {
    const firstRoot = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const secondRoot = presentationRoot("정답입니다!");
    let currentRoot: FakePresentationElement | null = firstRoot;
    const observation = harness(firstRoot, () => currentRoot);

    currentRoot = secondRoot;

    // root가 바뀐 batch는 baseline만 잡고 signal을 만들지 않는다.
    expect(observation.detect([attributeMutation(firstRoot, "aria-hidden")])).toBe(false);
    expect(observation.targets()).toHaveLength(2);
  });
});

describe("Programmers Accepted payload", () => {
  const pageUrl = "https://school.programmers.co.kr/learn/courses/30/lessons/120804";

  function detectPayload(nodes: Record<string, unknown>) {
    const modal = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const documentRef = {
      title: "코딩테스트 연습 - fallback | 프로그래머스",
      body: {} as HTMLElement,
      documentElement: {} as HTMLElement,
      querySelector: (selector: string) =>
        selector === "#modal-dialog"
          ? (modal as unknown as Element)
          : ((nodes[selector] ?? null) as Element | null)
    } as unknown as Pick<
      Document,
      "body" | "documentElement" | "querySelector" | "title"
    >;
    const route = createProgrammersAdapter({ readComputedStyle }).resolveRoute(
      new URL(pageUrl),
      documentRef
    );
    const observation = route?.observe(documentRef, "startup");

    modal.removeAttribute("aria-hidden");

    return observation?.detect([attributeMutation(modal, "aria-hidden")], {
      pageUrl,
      now: () => "2026-01-01T00:00:00.000Z"
    });
  }

  it("textarea code와 page metadata를 payload로 만든다", async () => {
    const signal = detectPayload({
      "textarea#code": { value: "print(120804)\n" },
      h1: { textContent: "코딩테스트 연습" },
      h2: { textContent: "두 수의 곱 구하기" },
      'meta[property="og:title"]': {
        content: "코딩테스트 연습 - 두 수의 곱 구하기 | 프로그래머스"
      },
      'select[name="language"]': {
        value: "swift",
        selectedOptions: [{ textContent: "Swift" }]
      }
    });

    expect(await Promise.resolve(signal?.toMessage())).toEqual({
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "programmers",
        courseId: "30",
        lessonId: "120804",
        problemTitle: "두 수의 곱 구하기",
        language: "Swift",
        code: "print(120804)\n",
        pageUrl,
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });
  });

  it("Accepted modal의 제목보다 안정적인 page metadata를 우선한다", async () => {
    // modal이 떠 있는 동안 h1/h2는 결과 문구로 바뀔 수 있다.
    const signal = detectPayload({
      "textarea#code": { value: "solution code\n" },
      h1: { textContent: "정답입니다!" },
      h2: { textContent: "1239 (+1)" },
      'meta[property="og:title"]': {
        content: "코딩테스트 연습 - 나이 출력 | 프로그래머스"
      }
    });
    const message = await Promise.resolve(signal?.toMessage());

    expect(message?.payload).toMatchObject({ problemTitle: "나이 출력" });
  });

  it("렌더된 CodeMirror 줄을 solution code로 쓰지 않는다", () => {
    expect(
      extractProgrammersEditorCode({
        querySelector: (selector: string) =>
          selector === ".cm-line"
            ? ({ textContent: "visible only" } as Element)
            : null
      } as Pick<Document, "querySelector">)
    ).toBeNull();
  });
});

const PAGE_URL = "https://school.programmers.co.kr/learn/courses/30/lessons/120804";

function harness(
  root: FakePresentationElement,
  getRoot: () => FakePresentationElement | null = () => root
) {
  const documentRef = fakeDetectionDocument(getRoot);
  const adapter = createProgrammersAdapter({
    findPresentationRoot: () => getRoot() as unknown as Element | null,
    readComputedStyle
  });
  const route = adapter.resolveRoute(new URL(PAGE_URL), documentRef);

  if (route === null) {
    throw new Error("Programmers route를 확정하지 못했다.");
  }

  const observation = route.observe(documentRef, "startup");

  return {
    targets: () => observation.targets(),
    detect(mutations: MutationRecord[]): boolean {
      return (
        observation.detect(mutations, {
          pageUrl: PAGE_URL,
          now: () => "2026-01-01T00:00:00.000Z"
        }) !== null
      );
    }
  };
}

interface FakePresentationElement {
  parentElement: Element | null;
  ownerDocument: Document | null;
  computedStyle: {
    display: string;
    visibility: string;
  };
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  querySelector(selector: string): Element | null;
  setTitle(title: string): void;
}

function presentationRoot(
  initialTitle: string,
  initialAttributes: Record<string, string> = {},
  initialStyle: Partial<FakePresentationElement["computedStyle"]> = {}
): FakePresentationElement {
  const attributes = new Map(Object.entries(initialAttributes));
  const titleElement = { textContent: initialTitle };

  return {
    parentElement: null,
    ownerDocument: null,
    computedStyle: {
      display: initialStyle.display ?? "block",
      visibility: initialStyle.visibility ?? "visible"
    },
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
        ? (titleElement as Element)
        : null;
    },
    setTitle(title) {
      titleElement.textContent = title;
    }
  };
}

/** `#modal-dialog`에만 root를 돌려준다. 모든 selector에 root를 돌려주면
 * `textarea#code` 조회가 값 없는 node를 받아 조립에서 터진다. */
function fakeDetectionDocument(getRoot: () => FakePresentationElement | null) {
  const documentRoot = {} as HTMLElement;

  return {
    title: "",
    body: documentRoot,
    documentElement: documentRoot,
    querySelector(selector: string) {
      return selector === "#modal-dialog"
        ? (getRoot() as unknown as Element | null)
        : null;
    }
  } as unknown as Pick<
    Document,
    "body" | "documentElement" | "querySelector" | "title"
  >;
}

function readComputedStyle(element: Element) {
  return (element as unknown as FakePresentationElement).computedStyle;
}

function attributeMutation(
  target: FakePresentationElement,
  attributeName: string
): MutationRecord {
  return {
    type: "attributes",
    target: target as unknown as Node,
    attributeName,
    oldValue: null
  } as MutationRecord;
}

function contentMutation(target: FakePresentationElement): MutationRecord {
  return {
    type: "childList",
    target: target as unknown as Node,
    addedNodes: [],
    removedNodes: []
  } as unknown as MutationRecord;
}
