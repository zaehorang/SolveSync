import { describe, expect, it } from "vitest";

import { mutationListMatchesText } from "../mutationText";
import {
  acceptedChildListMutation,
  makeDetectionDocument
} from "../__fixtures__/dom";
import {
  elementNode,
  mutationRecord,
  nestedElement,
  textNode,
  type TestCandidateNode
} from "../__fixtures__/mutation";
import {
  createLeetCodeAdapter,
  extractTitleSlugFromPathname,
  isAcceptedResultText,
  isLeetCodeAcceptedCandidate
} from "./leetcode";

const emptyDocument = { querySelector: () => null };

/** 순회는 공통이고 판정만 LeetCode 것을 쓴다. */
function mutationListHasAccepted(mutations: readonly MutationRecord[]): boolean {
  return mutationListMatchesText(mutations, isLeetCodeAcceptedCandidate);
}

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

describe("LeetCode adapter", () => {
  const pageUrl = "https://leetcode.com/problems/two-sum/";

  function resolve(url: string) {
    return createLeetCodeAdapter().resolveRoute(new URL(url), emptyDocument);
  }

  it("route를 URL에서 확정하고 다른 host와 다른 경로는 받지 않는다", () => {
    expect(resolve(pageUrl)?.key).toBe("leetcode:two-sum");
    expect(resolve("https://leetcode.com/problems/valid-parentheses/submissions/")?.key).toBe(
      "leetcode:valid-parentheses"
    );
    expect(resolve("https://leetcode.com/contest/weekly-contest-400/")).toBeNull();
    expect(resolve("https://example.com/problems/two-sum/")).toBeNull();
  });

  it("solution code 없이 Accepted message를 만든다", async () => {
    const route = resolve(pageUrl);
    const signal = route
      ?.observe(makeDetectionDocument({}), "startup")
      .detect([acceptedChildListMutation("Accepted")], {
        pageUrl,
        now: () => "2026-01-01T00:00:00.000Z"
      });

    expect(signal).not.toBeNull();

    const message = await Promise.resolve(signal?.toMessage());

    expect(message).toEqual({
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "leetcode",
        titleSlug: "two-sum",
        pageUrl,
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });
    // code는 background가 GraphQL로 조회한다. payload에 자리 자체가 없어야 한다.
    expect(Object.hasOwn(message?.payload ?? {}, "code")).toBe(false);
  });
});
