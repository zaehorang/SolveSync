/** mutation 안으로 제한된 text 후보 수집과 판정 (ADR 0022).
 *
 * 여기에는 Coding Platform이 등장하지 않는다. 순회는 세 플랫폼이 같고
 * 판정만 다르므로, 판정은 Coding Platform Adapter가 술어로 넘긴다.
 */
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
export const MAX_RESULT_TEXT_LENGTH = 180;
const MAX_TRAVERSAL_DEPTH = 6;
const MAX_TEXT_CANDIDATES = 80;
const MAX_JOINED_LEAF_TEXTS = 8;
const IGNORED_ELEMENT_NAMES = new Set(["script", "style", "noscript"]);

interface TextCandidateNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: Iterable<TextCandidateNode>;
  getAttribute?(name: string): string | null;
  parentElement?: TextCandidateNode | null;
  nodeName?: string;
  tagName?: string;
}

export interface TextCandidate {
  text: string;
  allowExactAcceptedFallback: boolean;
}

/** 후보 text 하나가 해당 Coding Platform의 Accepted 문구인지 판정한다.
 *
 * 순회는 플랫폼과 무관하므로 한 곳에 남기고 판정만 Coding Platform Adapter가
 * 넘긴다. 순회를 구현체로 복사하면 사본이 셋이 되고 그중 하나가 조용히
 * 달라진다. */
export type AcceptedTextPredicate = (candidate: TextCandidate) => boolean;

export function mutationListMatchesText(
  mutations: readonly MutationRecord[],
  isAccepted: AcceptedTextPredicate
): boolean {
  return mutations.some((mutation) => {
    if (mutation.type === "childList") {
      return addedNodesHaveAcceptedText(
        Array.from(mutation.addedNodes, toCandidateNode),
        isAccepted
      );
    }

    if (mutation.type === "characterData") {
      return characterDataMutationHasAccepted(mutation, isAccepted);
    }

    return false;
  });
}

function characterDataMutationHasAccepted(
  mutation: MutationRecord,
  isAccepted: AcceptedTextPredicate
): boolean {
  if (mutation.oldValue === null || textHasAccepted(mutation.oldValue, isAccepted)) {
    return false;
  }

  return nodeHasAcceptedText(toCandidateNode(mutation.target), isAccepted);
}

function addedNodesHaveAcceptedText(
  nodes: readonly TextCandidateNode[],
  isAccepted: AcceptedTextPredicate
): boolean {
  if (nodes.some((node) => nodeHasAcceptedText(node, isAccepted))) {
    return true;
  }

  const candidates: TextCandidate[] = [];
  const leafTexts: string[] = [];

  for (const node of nodes) {
    if (isHiddenFromDetection(node)) {
      continue;
    }

    appendLeafTexts(leafTexts, collectLeafTexts(node, 0, candidates));

    if (candidates.length >= MAX_TEXT_CANDIDATES) {
      break;
    }
  }

  addJoinedLeafCandidates(candidates, leafTexts);

  return candidates.some(isAccepted);
}

function nodeHasAcceptedText(
  node: TextCandidateNode,
  isAccepted: AcceptedTextPredicate
): boolean {
  if (isHiddenFromDetection(node)) {
    return false;
  }

  return collectCandidateTexts(node).some(isAccepted);
}

function collectCandidateTexts(node: TextCandidateNode): TextCandidate[] {
  const candidates: TextCandidate[] = [];
  const leafTexts = collectLeafTexts(node, 0, candidates);

  if (leafTexts.length === 1) {
    addTextCandidate(candidates, leafTexts[0] ?? "", true);
  }

  return candidates;
}

function collectLeafTexts(
  node: TextCandidateNode,
  depth: number,
  candidates: TextCandidate[]
): string[] {
  if (candidates.length >= MAX_TEXT_CANDIDATES) {
    return [];
  }

  if (node.nodeType === TEXT_NODE) {
    const text = addTextCandidate(candidates, node.textContent ?? "", depth === 0);

    return text === null ? [] : [text];
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return [];
  }

  if (isIgnoredElement(node) || isHiddenElement(node)) {
    return [];
  }

  addTextCandidate(candidates, node.getAttribute?.("aria-label") ?? "", true);
  addTextCandidate(candidates, node.getAttribute?.("title") ?? "", true);

  if (depth >= MAX_TRAVERSAL_DEPTH) {
    return [];
  }

  const leafTexts: string[] = [];

  for (const child of node.childNodes ?? []) {
    const childLeafTexts = collectLeafTexts(child, depth + 1, candidates);
    appendLeafTexts(leafTexts, childLeafTexts);

    if (candidates.length >= MAX_TEXT_CANDIDATES) {
      break;
    }
  }

  addJoinedLeafCandidates(candidates, leafTexts);

  return leafTexts;
}

function appendLeafTexts(target: string[], source: readonly string[]): void {
  for (const text of source) {
    if (target.length >= MAX_JOINED_LEAF_TEXTS) {
      return;
    }

    target.push(text);
  }
}

function addJoinedLeafCandidates(
  candidates: TextCandidate[],
  leafTexts: readonly string[]
): void {
  if (
    leafTexts.length < 2 ||
    leafTexts.length > MAX_JOINED_LEAF_TEXTS ||
    candidates.length >= MAX_TEXT_CANDIDATES
  ) {
    return;
  }

  addTextCandidate(candidates, leafTexts.join(" "), false);
  addTextCandidate(candidates, leafTexts.join(""), false);
}

function addTextCandidate(
  candidates: TextCandidate[],
  text: string,
  allowExactAcceptedFallback: boolean
): string | null {
  if (candidates.length >= MAX_TEXT_CANDIDATES) {
    return null;
  }

  const normalized = normalizeCandidateText(text);

  if (normalized.length === 0 || normalized.length > MAX_RESULT_TEXT_LENGTH) {
    return null;
  }

  candidates.push({
    text: normalized,
    allowExactAcceptedFallback
  });

  return normalized;
}

function textHasAccepted(text: string, isAccepted: AcceptedTextPredicate): boolean {
  const normalized = normalizeCandidateText(text);

  return (
    normalized.length > 0 &&
    isAccepted({ text: normalized, allowExactAcceptedFallback: true })
  );
}

export function normalizeCandidateText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isIgnoredElement(node: TextCandidateNode): boolean {
  const elementName = (node.tagName ?? node.nodeName ?? "").toLowerCase();

  return IGNORED_ELEMENT_NAMES.has(elementName);
}

function isHiddenFromDetection(node: TextCandidateNode): boolean {
  let current: TextCandidateNode | null | undefined = node;

  while (current !== null && current !== undefined) {
    if (current.nodeType === ELEMENT_NODE && isHiddenElement(current)) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function isHiddenElement(node: TextCandidateNode): boolean {
  const hiddenAttribute = node.getAttribute?.("hidden");
  const ariaHidden = normalizeCandidateText(
    node.getAttribute?.("aria-hidden") ?? ""
  ).toLowerCase();

  return (
    (hiddenAttribute !== null && hiddenAttribute !== undefined) ||
    ariaHidden === "true"
  );
}

function toCandidateNode(node: Node): TextCandidateNode {
  return node as unknown as TextCandidateNode;
}

