/** Coding Platform page를 흉내 내는 테스트 fixture.
 *
 * 실제 DOM 대신 최소 표면만 만든다. 실제 page에서 캡처한 DOM 재생은
 * Sealed E2E가 담당한다.
 */
import { vi } from "vitest";

export interface FakeElement {
  textContent: string | null;
  value?: string;
  content?: string;
  selectedOptions?: {
    item(index: number): FakeElement | null;
  };
  getAttribute(name: string): string | null;
}

export interface FakeProgrammersModal extends FakeElement {
  parentElement: Element | null;
  ownerDocument: Document | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  querySelector(selector: string): Element | null;
  setTitle(title: string): void;
}

export function element(input: {
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

export function programmersModal(
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


export function makeDocument(
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

export function makeDetectionDocument(
  nodes: Record<string, FakeElement | null>
): Pick<Document, "body" | "documentElement" | "querySelector" | "title"> {
  const root = element({ textContent: "" }) as unknown as HTMLElement;

  return {
    ...makeDocument(nodes),
    body: root,
    documentElement: root
  } as Pick<Document, "body" | "documentElement" | "querySelector" | "title">;
}

export function createFakeObserver(): {
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

export function attributeMutation(
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

export function programmersCharacterDataMutation(
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

export function acceptedChildListMutation(textContent: string): MutationRecord {
  return childListMutation(mutationElement([]), [mutationTextNode(textContent)]);
}

export function childListMutation(
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

export interface FakeMutationNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: FakeMutationNode[];
  parentElement?: FakeMutationNode | null;
  getAttribute?(name: string): string | null;
  tagName?: string;
}

export function mutationTextNode(textContent: string): FakeMutationNode {
  return {
    nodeType: 3,
    textContent,
    parentElement: null
  };
}

export function mutationElement(childNodes: FakeMutationNode[]): FakeMutationNode {
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
