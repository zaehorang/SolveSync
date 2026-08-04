import { describe, expect, it } from "vitest";

import { createProgrammersAcceptedPresentationTracker } from "./programmersAcceptedPresentation";

describe("Programmers Accepted presentation tracker", () => {
  it("uses a hidden Accepted presentation as a non-emitting baseline", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    expect(harness.tracker.getState()).toBe("inactive");
    expect(harness.tracker.handleMutations([])).toBeNull();
  });

  it("emits once when aria-hidden is removed from an Accepted presentation", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    root.removeAttribute("aria-hidden");

    expect(harness.tracker.handleMutations([attributeMutation(root, "aria-hidden")])).toBe(
      "becameAcceptedVisible"
    );
    expect(harness.tracker.handleMutations([attributeMutation(root, "class")])).toBeNull();
  });

  it("evaluates one attribute batch from its final DOM state", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    root.removeAttribute("aria-hidden");
    root.setAttribute("class", "modal fade show");

    expect(
      harness.tracker.handleMutations([
        attributeMutation(root, "aria-hidden"),
        attributeMutation(root, "class")
      ])
    ).toBe("becameAcceptedVisible");

    root.setAttribute("aria-hidden", "true");
    root.removeAttribute("aria-hidden");

    expect(
      harness.tracker.handleMutations([
        attributeMutation(root, "aria-hidden"),
        attributeMutation(root, "aria-hidden")
      ])
    ).toBeNull();
  });

  it("detects hidden and computed-style visibility transitions", () => {
    const hiddenRoot = presentationRoot("정답입니다!", { hidden: "" });
    const hiddenHarness = trackerHarness(hiddenRoot);

    hiddenRoot.removeAttribute("hidden");
    expect(
      hiddenHarness.tracker.handleMutations([attributeMutation(hiddenRoot, "hidden")])
    ).toBe("becameAcceptedVisible");

    const styledRoot = presentationRoot("정답입니다!", {}, { display: "none" });
    const styledHarness = trackerHarness(styledRoot);
    styledRoot.computedStyle.display = "block";

    expect(
      styledHarness.tracker.handleMutations([attributeMutation(styledRoot, "style")])
    ).toBe("becameAcceptedVisible");
  });

  it("ignores attribute changes while the presentation remains hidden", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    root.setAttribute("class", "modal fade show");

    expect(harness.tracker.handleMutations([attributeMutation(root, "class")])).toBeNull();
  });

  it("re-arms only after a visible presentation becomes inactive", () => {
    const root = presentationRoot("정답입니다!");
    const harness = trackerHarness(root);

    expect(harness.tracker.getState()).toBe("acceptedVisible");

    root.setAttribute("aria-hidden", "true");
    expect(harness.tracker.handleMutations([attributeMutation(root, "aria-hidden")])).toBe(
      "becameInactive"
    );

    root.removeAttribute("aria-hidden");
    expect(harness.tracker.handleMutations([attributeMutation(root, "aria-hidden")])).toBe(
      "becameAcceptedVisible"
    );
  });

  it("ignores unrelated targets and unsupported attributes", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const unrelated = presentationRoot("정답입니다!");
    const harness = trackerHarness(root);

    root.removeAttribute("aria-hidden");

    expect(
      harness.tracker.handleMutations([attributeMutation(unrelated, "aria-hidden")])
    ).toBeNull();
    expect(harness.tracker.handleMutations([attributeMutation(root, "data-state")])).toBeNull();
  });

  it.each(["오답입니다!", "통과", "채점 결과", "합계: 100.0 / 100.0"])(
    "does not treat %s as Accepted",
    (title) => {
      const root = presentationRoot(title, { "aria-hidden": "true" });
      const harness = trackerHarness(root);

      root.removeAttribute("aria-hidden");

      expect(
        harness.tracker.handleMutations([attributeMutation(root, "aria-hidden")])
      ).toBeNull();
    }
  );

  it("honors hidden ancestors without observing the whole page", () => {
    const ancestor = presentationRoot("", { hidden: "" });
    const root = presentationRoot("정답입니다!");
    root.parentElement = ancestor as unknown as Element;
    const harness = trackerHarness(root);

    expect(harness.tracker.getState()).toBe("inactive");
  });

  it("takes a replacement root as a baseline and ignores queued old-root records", () => {
    const firstRoot = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const secondRoot = presentationRoot("정답입니다!");
    let currentRoot: FakePresentationElement | null = firstRoot;
    const tracker = createProgrammersAcceptedPresentationTracker({
      findPresentationRoot: () => currentRoot as unknown as Element | null,
      readComputedStyle
    });
    const documentRef = fakeDocument();
    tracker.reset(documentRef);

    currentRoot = secondRoot;
    expect(tracker.refreshRoot(documentRef)).toBe(true);
    expect(tracker.getState()).toBe("acceptedVisible");
    expect(
      tracker.handleMutations([attributeMutation(firstRoot, "aria-hidden")])
    ).toBeNull();
  });
});

interface FakePresentationElement {
  textContent: string;
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
  querySelectorAll(selector: string): NodeListOf<Element>;
}

function presentationRoot(
  title: string,
  initialAttributes: Record<string, string> = {},
  initialStyle: Partial<FakePresentationElement["computedStyle"]> = {}
): FakePresentationElement {
  const attributes = new Map(Object.entries(initialAttributes));
  const heading = { textContent: title } as Element;

  return {
    textContent: title,
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
    querySelectorAll() {
      return (title.length === 0 ? [] : [heading]) as unknown as NodeListOf<Element>;
    }
  };
}

function trackerHarness(root: FakePresentationElement) {
  const tracker = createProgrammersAcceptedPresentationTracker({
    findPresentationRoot: () => root as unknown as Element,
    readComputedStyle
  });

  tracker.reset(fakeDocument());

  return { tracker };
}

function fakeDocument(): Pick<Document, "querySelector"> {
  return { querySelector: () => null } as Pick<Document, "querySelector">;
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
