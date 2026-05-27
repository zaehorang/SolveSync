import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDebouncedCallback,
  extractProgrammersRouteFromPathname,
  extractTitleSlugFromPathname,
  isAcceptedResultText,
  isProgrammersAcceptedResultText,
  mutationListHasAccepted
} from "./detector";

describe("LeetCode content detector", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts the title slug from LeetCode problem paths", () => {
    expect(extractTitleSlugFromPathname("/problems/two-sum/")).toBe("two-sum");
    expect(extractTitleSlugFromPathname("/problems/valid-parentheses/submissions/")).toBe(
      "valid-parentheses"
    );
    expect(extractTitleSlugFromPathname("/contest/weekly-contest-400/")).toBeNull();
  });

  it("detects Accepted result text without matching generic page copy", () => {
    expect(isAcceptedResultText("Accepted")).toBe(true);
    expect(isAcceptedResultText("Accepted 116 / 116 testcases passed")).toBe(true);
    expect(isAcceptedResultText("Accepted\nRuntime 0 ms\nMemory 16 MB")).toBe(false);
    expect(isAcceptedResultText("Wrong Answer")).toBe(false);
    expect(isAcceptedResultText("Accepted Solutions")).toBe(false);
    expect(isAcceptedResultText("Accepted Submissions")).toBe(false);
    expect(isAcceptedResultText("Acceptance Rate 53.2%")).toBe(false);
  });

  it("detects Accepted text in mutation candidates", () => {
    const mutation = {
      target: textNode("Pending"),
      addedNodes: [textNode("Accepted")]
    } as unknown as MutationRecord;

    expect(mutationListHasAccepted([mutation])).toBe(true);
  });

  it("detects accepted result text inside a large nested result panel", () => {
    const mutation = mutationRecord({
      target: textNode("Judging"),
      addedNodes: [
        elementNode([
          elementNode([textNode("All Submissions")]),
          elementNode([
            textNode("Accepted"),
            textNode(" 116 / 116 "),
            textNode(" testcases passed")
          ]),
          elementNode([textNode("Horang submitted at May 27, 2026 17:44")]),
          elementNode([textNode("Runtime")]),
          elementNode([textNode("0 ms Beats 100.00 %")]),
          elementNode([textNode("Memory")]),
          elementNode([textNode("19.19 MB Beats 95.85 %")]),
          elementNode([textNode("Code Swift")]),
          elementNode([textNode("class Solution { ".repeat(40))]),
          elementNode([
            textNode(
              "More challenges 26. Remove Duplicates from Sorted Array 203. Remove Linked List Elements"
            )
          ])
        ])
      ]
    });

    expect(mutationListHasAccepted([mutation])).toBe(true);
  });

  it("does not rely on a large container textContent for accepted detection", () => {
    const mutation = mutationRecord({
      target: textNode("Pending"),
      addedNodes: [
        elementNode([], {
          textContent: [
            "Accepted 116 / 116 testcases passed",
            "Runtime 0 ms Memory 19.19 MB Code Swift",
            "class Solution {",
            "let code = String(repeating: \"x\", count: 200)",
            "More challenges Remove Duplicates from Sorted Array"
          ].join(" ")
        })
      ]
    });

    expect(mutationListHasAccepted([mutation])).toBe(false);
  });

  it("ignores generic accepted page copy in changed containers", () => {
    const mutation = mutationRecord({
      target: textNode("Description"),
      addedNodes: [
        elementNode([
          elementNode([textNode("Description")]),
          elementNode([textNode("Accepted")]),
          elementNode([textNode("Editorial")]),
          elementNode([textNode("Solutions")]),
          elementNode([textNode("Accepted Submissions")]),
          elementNode([textNode("Acceptance Rate 53.2%")])
        ])
      ]
    });

    expect(mutationListHasAccepted([mutation])).toBe(false);
  });

  it("ignores failed or pending result text", () => {
    const wrongAnswer = mutationRecord({
      target: textNode("Pending"),
      addedNodes: [
        elementNode([
          textNode("Wrong Answer"),
          textNode(" 115 / 116 "),
          textNode(" testcases passed")
        ])
      ]
    });
    const runtimeError = mutationRecord({
      target: textNode("Pending"),
      addedNodes: [elementNode([textNode("Runtime Error")])]
    });

    expect(mutationListHasAccepted([wrongAnswer])).toBe(false);
    expect(mutationListHasAccepted([runtimeError])).toBe(false);
    expect(isAcceptedResultText("Pending")).toBe(false);
    expect(isAcceptedResultText("Judging")).toBe(false);
  });

  it("stops traversal before very deep accepted text", () => {
    const mutation = mutationRecord({
      target: textNode("Pending"),
      addedNodes: [
        nestedElement(7, [
          textNode("Accepted"),
          textNode(" 116 / 116 "),
          textNode(" testcases passed")
        ])
      ]
    });

    expect(mutationListHasAccepted([mutation])).toBe(false);
  });

  it("debounces repeated accepted detections", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 200);

    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(199);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

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
    expect(mutationListHasAccepted([mutation], "programmers")).toBe(true);
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
    expect(mutationListHasAccepted([passed], "programmers")).toBe(false);
    expect(mutationListHasAccepted([summary], "programmers")).toBe(false);
  });
});

interface TestCandidateNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: TestCandidateNode[];
  getAttribute?(name: string): string | null;
  nodeName?: string;
  tagName?: string;
}

function textNode(textContent: string): TestCandidateNode {
  return {
    nodeType: 3,
    textContent
  };
}

function elementNode(
  childNodes: TestCandidateNode[],
  options: {
    attrs?: Record<string, string>;
    tagName?: string;
    textContent?: string;
  } = {}
): TestCandidateNode {
  const tagName = options.tagName ?? "div";
  const attrs = options.attrs ?? {};

  return {
    nodeType: 1,
    textContent:
      options.textContent ?? childNodes.map((child) => child.textContent ?? "").join(""),
    childNodes,
    nodeName: tagName.toUpperCase(),
    tagName: tagName.toUpperCase(),
    getAttribute(name: string) {
      return attrs[name] ?? null;
    }
  };
}

function nestedElement(depth: number, childNodes: TestCandidateNode[]): TestCandidateNode {
  let node = elementNode(childNodes);

  for (let index = 0; index < depth; index += 1) {
    node = elementNode([node]);
  }

  return node;
}

function mutationRecord(input: {
  target: TestCandidateNode;
  addedNodes: TestCandidateNode[];
}): MutationRecord {
  return input as unknown as MutationRecord;
}
