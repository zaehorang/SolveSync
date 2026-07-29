import { describe, expect, it } from "vitest";

import {
  extractProgrammersRouteFromPathname,
  extractTitleSlugFromPathname,
  isAcceptedResultText,
  isProgrammersAcceptedResultText,
  mutationListHasAccepted
} from "./detector";

describe("LeetCode content detector", () => {
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
    const mutation = mutationRecord({
      target: textNode("Pending"),
      addedNodes: [textNode("Accepted")]
    });

    expect(mutationListHasAccepted([mutation])).toBe(true);
  });

  it("detects an exact Accepted status inside one new wrapper element", () => {
    const mutation = mutationRecord({
      target: elementNode([]),
      addedNodes: [elementNode([textNode("Accepted")], { tagName: "span" })]
    });

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

  it("ignores stale Accepted text in a childList target", () => {
    const mutation = mutationRecord({
      target: elementNode([
        elementNode([textNode("Accepted")]),
        elementNode([textNode("Runtime")])
      ]),
      addedNodes: [elementNode([textNode("Wrong Answer")])]
    });

    expect(mutationListHasAccepted([mutation])).toBe(false);
  });

  it("detects only a non-Accepted to Accepted character data transition", () => {
    expect(
      mutationListHasAccepted([
        mutationRecord({
          type: "characterData",
          target: textNode("Accepted"),
          oldValue: "Judging"
        })
      ])
    ).toBe(true);
    expect(
      mutationListHasAccepted([
        mutationRecord({
          type: "characterData",
          target: textNode("Accepted"),
          oldValue: "Accepted"
        })
      ])
    ).toBe(false);
    expect(
      mutationListHasAccepted([
        mutationRecord({
          type: "characterData",
          target: textNode("Accepted"),
          oldValue: null
        })
      ])
    ).toBe(false);
  });

  it("combines split text only inside one childList mutation", () => {
    const oneMutation = mutationRecord({
      target: elementNode([]),
      addedNodes: [
        textNode("Accepted"),
        textNode(" 116 / 116 "),
        textNode("testcases passed")
      ]
    });
    const splitAcrossMutations = [
      mutationRecord({
        target: elementNode([]),
        addedNodes: [textNode("Accepted 116 /")]
      }),
      mutationRecord({
        target: elementNode([]),
        addedNodes: [textNode("116 testcases passed")]
      })
    ];

    expect(mutationListHasAccepted([oneMutation])).toBe(true);
    expect(mutationListHasAccepted(splitAcrossMutations)).toBe(false);
  });

  it("ignores hidden Accepted nodes and hidden ancestors", () => {
    const hidden = mutationRecord({
      target: elementNode([]),
      addedNodes: [
        elementNode([textNode("Accepted")], {
          attrs: { hidden: "" }
        })
      ]
    });
    const ariaHiddenAncestor = mutationRecord({
      target: elementNode([]),
      addedNodes: [
        elementNode([elementNode([textNode("Accepted")])], {
          attrs: { "aria-hidden": "true" }
        })
      ]
    });

    expect(mutationListHasAccepted([hidden])).toBe(false);
    expect(mutationListHasAccepted([ariaHiddenAncestor])).toBe(false);
  });

  it("ignores removed Accepted nodes and unrelated additions", () => {
    const mutation = mutationRecord({
      target: elementNode([]),
      addedNodes: [elementNode([textNode("SolveSync synced")])],
      removedNodes: [elementNode([textNode("Accepted")])]
    });

    expect(mutationListHasAccepted([mutation])).toBe(false);
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

  it("does not reuse a stale accepted modal when code execution adds 통과", () => {
    const mutation = mutationRecord({
      target: elementNode([
        elementNode([textNode("정답입니다!")]),
        elementNode([textNode("실행 결과")])
      ]),
      addedNodes: [elementNode([textNode("통과")])]
    });

    expect(mutationListHasAccepted([mutation], "programmers")).toBe(false);
  });

  it("detects a Korean Accepted phrase split across new sibling nodes", () => {
    const mutation = mutationRecord({
      target: elementNode([]),
      addedNodes: [textNode("정답입니다"), textNode("!")]
    });

    expect(mutationListHasAccepted([mutation], "programmers")).toBe(true);
  });
});

interface TestCandidateNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: TestCandidateNode[];
  getAttribute?(name: string): string | null;
  parentElement?: TestCandidateNode | null;
  nodeName?: string;
  tagName?: string;
}

function textNode(textContent: string): TestCandidateNode {
  return {
    nodeType: 3,
    textContent,
    parentElement: null
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
  const node: TestCandidateNode = {
    nodeType: 1,
    textContent:
      options.textContent ?? childNodes.map((child) => child.textContent ?? "").join(""),
    childNodes,
    parentElement: null,
    nodeName: tagName.toUpperCase(),
    tagName: tagName.toUpperCase(),
    getAttribute(name: string) {
      return attrs[name] ?? null;
    }
  };

  for (const child of childNodes) {
    child.parentElement = node;
  }

  return node;
}

function nestedElement(depth: number, childNodes: TestCandidateNode[]): TestCandidateNode {
  let node = elementNode(childNodes);

  for (let index = 0; index < depth; index += 1) {
    node = elementNode([node]);
  }

  return node;
}

function mutationRecord(input: {
  type?: "childList" | "characterData";
  target: TestCandidateNode;
  addedNodes?: TestCandidateNode[];
  removedNodes?: TestCandidateNode[];
  oldValue?: string | null;
}): MutationRecord {
  return {
    type: input.type ?? "childList",
    target: input.target,
    addedNodes: input.addedNodes ?? [],
    removedNodes: input.removedNodes ?? [],
    oldValue: input.oldValue ?? null
  } as unknown as MutationRecord;
}
