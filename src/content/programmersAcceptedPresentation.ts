import { isProgrammersAcceptedResultText } from "./detector";

const PRESENTATION_ROOT_SELECTOR = "#modal-dialog";
const PRESENTATION_HEADING_SELECTOR =
  ".modal-title, [role=\"heading\"], h1, h2, h3, h4, h5, h6";
const MAX_PRESENTATION_HEADINGS = 24;

export const PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER = [
  "aria-hidden",
  "hidden",
  "class",
  "style"
] as const;

export type ProgrammersAcceptedPresentationState =
  | "inactive"
  | "acceptedVisible";

export type ProgrammersAcceptedPresentationTransition =
  | "becameAcceptedVisible"
  | "becameInactive";

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

export interface ProgrammersAcceptedPresentationTracker {
  reset(documentRef: Pick<Document, "querySelector">): void;
  refreshRoot(documentRef: Pick<Document, "querySelector">): boolean;
  handleMutations(
    mutations: readonly MutationRecord[]
  ): ProgrammersAcceptedPresentationTransition | null;
  synchronizeCurrentState(): void;
  rearmIfInactive(): void;
  mutationsTouchPresentation(mutations: readonly MutationRecord[]): boolean;
  getRoot(): Element | null;
  getState(): ProgrammersAcceptedPresentationState;
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
    hasExactAcceptedHeading(root) &&
    isPresentationVisible(root, readComputedStyle)
      ? "acceptedVisible"
      : "inactive";

  const setRoot = (nextRoot: Element | null): boolean => {
    if (nextRoot === root) {
      return false;
    }

    root = nextRoot;
    state = readState();
    return true;
  };

  return {
    reset(documentRef) {
      root = null;
      state = "inactive";
      setRoot(findPresentationRoot(documentRef));
    },

    refreshRoot(documentRef) {
      return setRoot(findPresentationRoot(documentRef));
    },

    handleMutations(mutations) {
      if (
        root === null ||
        !mutations.some(
          (mutation) =>
            mutation.type === "attributes" &&
            mutation.target === root &&
            isPresentationAttribute(mutation.attributeName)
        )
      ) {
        return null;
      }

      const nextState = readState();

      if (nextState === state) {
        return null;
      }

      const previousState = state;
      state = nextState;

      return previousState === "inactive"
        ? "becameAcceptedVisible"
        : "becameInactive";
    },

    synchronizeCurrentState() {
      state = readState();
    },

    rearmIfInactive() {
      if (readState() === "inactive") {
        state = "inactive";
      }
    },

    mutationsTouchPresentation(mutations) {
      const currentRoot = root;

      return (
        currentRoot !== null &&
        mutations.some((mutation) =>
          isNodeWithinRoot(mutation.target, currentRoot)
        )
      );
    },

    getRoot() {
      return root;
    },

    getState() {
      return state;
    }
  };
}

function findDefaultProgrammersPresentationRoot(
  documentRef: Pick<Document, "querySelector">
): Element | null {
  return documentRef.querySelector(PRESENTATION_ROOT_SELECTOR);
}

function hasExactAcceptedHeading(root: Element): boolean {
  const headings = root.querySelectorAll(PRESENTATION_HEADING_SELECTOR);
  let inspected = 0;

  for (const heading of headings) {
    if (inspected >= MAX_PRESENTATION_HEADINGS) {
      break;
    }

    inspected += 1;

    if (isProgrammersAcceptedResultText(heading.textContent ?? "")) {
      return true;
    }
  }

  return (
    headings.length === 0 &&
    isProgrammersAcceptedResultText(root.textContent ?? "")
  );
}

function isPresentationVisible(
  root: Element,
  readComputedStyle: (element: Element) => PresentationStyle
): boolean {
  let current: Element | null = root;

  while (current !== null) {
    if (
      current.hasAttribute("hidden") ||
      normalize(current.getAttribute("aria-hidden") ?? "").toLowerCase() === "true"
    ) {
      return false;
    }

    const style = readComputedStyle(current);

    if (
      normalize(style.display).toLowerCase() === "none" ||
      normalize(style.visibility).toLowerCase() === "hidden"
    ) {
      return false;
    }

    current = current.parentElement;
  }

  return true;
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
