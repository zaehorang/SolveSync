import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDebouncedCallback,
  extractTitleSlugFromPathname,
  isAcceptedResultText,
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
    expect(isAcceptedResultText("Accepted\nRuntime 0 ms\nMemory 16 MB")).toBe(true);
    expect(isAcceptedResultText("Wrong Answer")).toBe(false);
    expect(isAcceptedResultText("Accepted Solutions")).toBe(false);
    expect(isAcceptedResultText("Acceptance Rate 53.2%")).toBe(false);
  });

  it("detects Accepted text in mutation candidates", () => {
    const mutation = {
      target: textNode("Pending"),
      addedNodes: [textNode("Accepted")]
    } as unknown as MutationRecord;

    expect(mutationListHasAccepted([mutation])).toBe(true);
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

function textNode(textContent: string): Pick<Node, "nodeType" | "textContent"> {
  return {
    nodeType: 3,
    textContent
  };
}
