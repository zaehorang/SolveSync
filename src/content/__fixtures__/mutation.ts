/** MutationRecord와 DOM node를 흉내 내는 테스트 fixture.
 *
 * 순회(ADR 0022)는 실제 DOM 없이도 검증할 수 있어야 하므로 node 표면만
 * 최소로 만든다. 실제 page에서 캡처한 DOM 재생은 Sealed E2E가 담당한다.
 */
export interface TestCandidateNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: TestCandidateNode[];
  getAttribute?(name: string): string | null;
  parentElement?: TestCandidateNode | null;
  nodeName?: string;
  tagName?: string;
}

export function textNode(textContent: string): TestCandidateNode {
  return {
    nodeType: 3,
    textContent,
    parentElement: null
  };
}

export function elementNode(
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

export function nestedElement(depth: number, childNodes: TestCandidateNode[]): TestCandidateNode {
  let node = elementNode(childNodes);

  for (let index = 0; index < depth; index += 1) {
    node = elementNode([node]);
  }

  return node;
}

export function mutationRecord(input: {
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
