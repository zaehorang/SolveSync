import { describe, expect, it } from "vitest";

import { createProgrammersAcceptedPresentationTracker } from "./programmersAcceptedPresentation";

describe("Programmers Accepted presentation tracker", () => {
  it("uses a hidden Accepted presentation as a non-emitting baseline", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    expect(harness.tracker.reset(harness.documentRef)).toBe(root);
    expect(harness.reconcile([]).becameAcceptedVisible).toBe(false);
  });

  it("emits once when a hidden Accepted presentation becomes visible", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    root.removeAttribute("aria-hidden");

    expect(
      harness.reconcile([attributeMutation(root, "aria-hidden")])
        .becameAcceptedVisible
    ).toBe(true);
    expect(
      harness.reconcile([attributeMutation(root, "class")]).becameAcceptedVisible
    ).toBe(false);
  });

  it("evaluates one attribute batch from its final DOM state", () => {
    const root = presentationRoot("정답입니다!", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    root.removeAttribute("aria-hidden");
    root.setAttribute("class", "modal fade show");

    expect(
      harness.reconcile([
        attributeMutation(root, "aria-hidden"),
        attributeMutation(root, "class")
      ]).becameAcceptedVisible
    ).toBe(true);

    root.setAttribute("aria-hidden", "true");
    root.removeAttribute("aria-hidden");

    expect(
      harness.reconcile([
        attributeMutation(root, "aria-hidden"),
        attributeMutation(root, "aria-hidden")
      ]).becameAcceptedVisible
    ).toBe(false);
  });

  it("supports root hidden and computed-style visibility transitions", () => {
    const hiddenRoot = presentationRoot("정답입니다!", { hidden: "" });
    const hiddenHarness = trackerHarness(hiddenRoot);

    hiddenRoot.removeAttribute("hidden");
    expect(
      hiddenHarness.reconcile([attributeMutation(hiddenRoot, "hidden")])
        .becameAcceptedVisible
    ).toBe(true);

    const styledRoot = presentationRoot("정답입니다!", {}, { display: "none" });
    const styledHarness = trackerHarness(styledRoot);
    styledRoot.computedStyle.display = "block";

    expect(
      styledHarness.reconcile([attributeMutation(styledRoot, "style")])
        .becameAcceptedVisible
    ).toBe(true);
  });

  it("re-arms after a visible presentation becomes inactive", () => {
    const root = presentationRoot("정답입니다!");
    const harness = trackerHarness(root);

    root.setAttribute("aria-hidden", "true");
    expect(
      harness.reconcile([attributeMutation(root, "aria-hidden")])
        .becameAcceptedVisible
    ).toBe(false);

    root.removeAttribute("aria-hidden");
    expect(
      harness.reconcile([attributeMutation(root, "aria-hidden")])
        .becameAcceptedVisible
    ).toBe(true);
  });

  it("re-arms on a non-Accepted title without promoting from unrelated content", () => {
    const root = presentationRoot("정답입니다!");
    const harness = trackerHarness(root);

    root.setTitle("오답입니다!");
    expect(harness.reconcile([contentMutation(root)]).becameAcceptedVisible).toBe(
      false
    );

    root.setTitle("정답입니다!");
    expect(
      harness.reconcile([contentMutation(root)], { freshAcceptedText: true })
        .becameAcceptedVisible
    ).toBe(true);
  });

  it("does not treat representative non-Accepted title text as Accepted", () => {
    const root = presentationRoot("채점 결과", { "aria-hidden": "true" });
    const harness = trackerHarness(root);

    root.removeAttribute("aria-hidden");

    expect(
      harness.reconcile([attributeMutation(root, "aria-hidden")])
        .becameAcceptedVisible
    ).toBe(false);
  });

  it("takes a replacement root as a baseline and ignores old-root records", () => {
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
    const replacement = tracker.reconcile(
      documentRef,
      [attributeMutation(firstRoot, "aria-hidden")],
      { freshAcceptedText: false, routeChanged: false }
    );

    expect(replacement).toEqual({
      root: secondRoot,
      rootChanged: true,
      becameAcceptedVisible: false
    });
  });
});

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

function trackerHarness(root: FakePresentationElement) {
  const documentRef = fakeDocument(root);
  const tracker = createProgrammersAcceptedPresentationTracker({ readComputedStyle });
  tracker.reset(documentRef);

  return {
    tracker,
    documentRef,
    reconcile(
      mutations: MutationRecord[],
      context: Partial<{
        freshAcceptedText: boolean;
        routeChanged: boolean;
      }> = {}
    ) {
      return tracker.reconcile(documentRef, mutations, {
        freshAcceptedText: context.freshAcceptedText ?? false,
        routeChanged: context.routeChanged ?? false
      });
    }
  };
}

function fakeDocument(
  root: FakePresentationElement | null = null
): Pick<Document, "querySelector"> {
  return {
    querySelector: () => root as unknown as Element | null
  } as Pick<Document, "querySelector">;
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
