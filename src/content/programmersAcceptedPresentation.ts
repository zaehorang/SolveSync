import { isProgrammersAcceptedResultText } from "./detector";

const PRESENTATION_ROOT_SELECTOR = "#modal-dialog";
const PRESENTATION_TITLE_SELECTOR = ".modal-title";

export const PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER = [
  "aria-hidden",
  "hidden",
  "class",
  "style"
] as const;

type ProgrammersAcceptedPresentationState = "inactive" | "acceptedVisible";

interface PresentationStyle {
  display: string;
  visibility: string;
}

export interface ProgrammersAcceptedPresentationTrackerOptions {
  findPresentationRoot?(
    documentRef: Pick<Document, "querySelector">
  ): Element | null;
  readComputedStyle?(element: Element): PresentationStyle;
}

interface ProgrammersAcceptedPresentationContext {
  freshAcceptedText: boolean;
  routeChanged: boolean;
}

interface ProgrammersAcceptedPresentationReconciliation {
  root: Element | null;
  rootChanged: boolean;
  becameAcceptedVisible: boolean;
}

export interface ProgrammersAcceptedPresentationTracker {
  reset(documentRef: Pick<Document, "querySelector">): Element | null;
  reconcile(
    documentRef: Pick<Document, "querySelector">,
    mutations: readonly MutationRecord[],
    context: ProgrammersAcceptedPresentationContext
  ): ProgrammersAcceptedPresentationReconciliation;
}

export function createProgrammersAcceptedPresentationTracker(
  options: ProgrammersAcceptedPresentationTrackerOptions = {}
): ProgrammersAcceptedPresentationTracker {
  const findPresentationRoot =
    options.findPresentationRoot ?? findDefaultProgrammersPresentationRoot;
  const readComputedStyle = options.readComputedStyle ?? readDefaultComputedStyle;
  let root: Element | null = null;
  let state: ProgrammersAcceptedPresentationState = "inactive";

  const readState = (): ProgrammersAcceptedPresentationState =>
    root !== null &&
    hasExactAcceptedTitle(root) &&
    isPresentationVisible(root, readComputedStyle)
      ? "acceptedVisible"
      : "inactive";

  return {
    reset(documentRef) {
      root = findPresentationRoot(documentRef);
      state = readState();
      return root;
    },

    reconcile(documentRef, mutations, context) {
      const nextRoot = findPresentationRoot(documentRef);

      if (nextRoot !== root) {
        root = nextRoot;
        state = readState();

        return {
          root,
          rootChanged: true,
          becameAcceptedVisible: false
        };
      }

      if (root === null) {
        return {
          root,
          rootChanged: false,
          becameAcceptedVisible: false
        };
      }

      const currentRoot = root;

      const hasPresentationAttributeMutation = mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          mutation.target === currentRoot &&
          isPresentationAttribute(mutation.attributeName)
      );

      if (
        context.routeChanged &&
        !context.freshAcceptedText &&
        !hasPresentationAttributeMutation
      ) {
        state = readState();

        return {
          root,
          rootChanged: false,
          becameAcceptedVisible: false
        };
      }

      if (context.routeChanged && context.freshAcceptedText) {
        state = "inactive";
      }

      if (context.freshAcceptedText || hasPresentationAttributeMutation) {
        const previousState = state;
        state = readState();

        return {
          root,
          rootChanged: false,
          becameAcceptedVisible:
            previousState === "inactive" && state === "acceptedVisible"
        };
      }

      if (
        mutations.some((mutation) =>
          isNodeWithinRoot(mutation.target, currentRoot)
        ) &&
        readState() === "inactive"
      ) {
        state = "inactive";
      }

      return {
        root,
        rootChanged: false,
        becameAcceptedVisible: false
      };
    }
  };
}

function findDefaultProgrammersPresentationRoot(
  documentRef: Pick<Document, "querySelector">
): Element | null {
  return documentRef.querySelector(PRESENTATION_ROOT_SELECTOR);
}

function hasExactAcceptedTitle(root: Element): boolean {
  const title = root.querySelector(PRESENTATION_TITLE_SELECTOR);

  return (
    title !== null &&
    isProgrammersAcceptedResultText(title.textContent ?? "")
  );
}

function isPresentationVisible(
  root: Element,
  readComputedStyle: (element: Element) => PresentationStyle
): boolean {
  if (
    root.hasAttribute("hidden") ||
    normalize(root.getAttribute("aria-hidden") ?? "").toLowerCase() === "true"
  ) {
    return false;
  }

  const style = readComputedStyle(root);

  return (
    normalize(style.display).toLowerCase() !== "none" &&
    normalize(style.visibility).toLowerCase() !== "hidden"
  );
}

function readDefaultComputedStyle(element: Element): PresentationStyle {
  const view = element.ownerDocument?.defaultView;

  if (view === null || view === undefined) {
    return { display: "", visibility: "" };
  }

  const style = view.getComputedStyle(element);

  return {
    display: style.display,
    visibility: style.visibility
  };
}

function isPresentationAttribute(attributeName: string | null): boolean {
  return (
    attributeName !== null &&
    PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER.includes(
      attributeName as (typeof PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER)[number]
    )
  );
}

function isNodeWithinRoot(node: Node, root: Element): boolean {
  let current: Node | null = node;

  while (current !== null) {
    if (current === root) {
      return true;
    }

    current =
      current.parentNode ??
      ((current as Node & { parentElement?: Element | null }).parentElement ?? null);
  }

  return false;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
