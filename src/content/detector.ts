const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const EXACT_ACCEPTED_PATTERN = /^accepted$/i;
const ACCEPTED_RESULT_PATTERN =
  /\baccepted\b\s+\d+\s*\/\s*\d+\s+testcases?\s+passed\b/i;
const NON_ACCEPTED_RESULT_PATTERN =
  /\b(wrong answer|runtime error|compile error|time limit exceeded|memory limit exceeded|pending|judging|not accepted)\b/i;
const GENERIC_ACCEPTED_PAGE_TEXT_PATTERN =
  /\b(accepted submissions|accepted solutions|acceptance rate)\b/i;
const PROGRAMMERS_ACCEPTED_TEXT = "정답입니다!";
const SWEA_ACCEPTED_TEXT_PREFIX = "축하합니다. Pass입니다.";
const MAX_RESULT_TEXT_LENGTH = 180;
const MAX_TRAVERSAL_DEPTH = 6;
const MAX_TEXT_CANDIDATES = 80;
const MAX_JOINED_LEAF_TEXTS = 8;
const IGNORED_ELEMENT_NAMES = new Set(["script", "style", "noscript"]);

export type AcceptedDetectionPlatform = "leetcode" | "programmers" | "swea";

export interface TimeoutScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

interface TextCandidateNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: Iterable<TextCandidateNode>;
  getAttribute?(name: string): string | null;
  parentElement?: TextCandidateNode | null;
  nodeName?: string;
  tagName?: string;
}

interface TextCandidate {
  text: string;
  allowExactAcceptedFallback: boolean;
}

export function extractTitleSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([^/?#]+)/);
  const slug = match?.[1]?.trim();

  return slug === undefined || slug.length === 0 ? null : decodeURIComponent(slug);
}

export interface ProgrammersRoute {
  courseId: string;
  lessonId: string;
}

export function extractProgrammersRouteFromPathname(
  pathname: string
): ProgrammersRoute | null {
  const match = pathname.match(/^\/learn\/courses\/([^/?#]+)\/lessons\/([^/?#]+)/);
  const courseId = match?.[1]?.trim();
  const lessonId = match?.[2]?.trim();

  if (
    courseId === undefined ||
    courseId.length === 0 ||
    lessonId === undefined ||
    lessonId.length === 0
  ) {
    return null;
  }

  return {
    courseId: decodeURIComponent(courseId),
    lessonId: decodeURIComponent(lessonId)
  };
}

export const SWEA_SOLVING_PATHNAME = "/main/solvingProblem/solvingProblem.do";

export function isSweaSolvingPathname(pathname: string): boolean {
  return pathname === SWEA_SOLVING_PATHNAME;
}

export function isAcceptedResultText(text: string): boolean {
  const normalized = normalizeCandidateText(text);

  if (!isResultTextCandidate(normalized)) {
    return false;
  }

  return (
    ACCEPTED_RESULT_PATTERN.test(normalized) ||
    EXACT_ACCEPTED_PATTERN.test(normalized)
  );
}

export function isProgrammersAcceptedResultText(text: string): boolean {
  const normalized = normalizeCandidateText(text);

  return (
    normalized.length > 0 &&
    normalized.length <= MAX_RESULT_TEXT_LENGTH &&
    normalized === PROGRAMMERS_ACCEPTED_TEXT
  );
}

/** SWEA alert layer의 Accepted 문구.
 *
 * 실패는 `채점용 input 파일로 채점한 결과 fail 입니다.`로 시작하고 제한시간
 * 초과와 런타임 에러 문구가 그 뒤에 붙으므로 접두사가 겹치지 않는다. 뒤에 붙는
 * 부가 문구를 허용하되 접두사는 정확히 일치해야 한다.
 */
export function isSweaAcceptedResultText(text: string): boolean {
  const normalized = normalizeCandidateText(text);

  return (
    normalized.length > 0 &&
    normalized.length <= MAX_RESULT_TEXT_LENGTH &&
    normalized.startsWith(SWEA_ACCEPTED_TEXT_PREFIX)
  );
}

export function mutationListHasAccepted(
  mutations: readonly MutationRecord[],
  platform: AcceptedDetectionPlatform = "leetcode"
): boolean {
  return mutations.some((mutation) => {
    if (mutation.type === "childList") {
      return addedNodesHaveAcceptedText(
        Array.from(mutation.addedNodes, toCandidateNode),
        platform
      );
    }

    if (mutation.type === "characterData") {
      return characterDataMutationHasAccepted(mutation, platform);
    }

    return false;
  });
}

function characterDataMutationHasAccepted(
  mutation: MutationRecord,
  platform: AcceptedDetectionPlatform
): boolean {
  if (mutation.oldValue === null || textHasAccepted(mutation.oldValue, platform)) {
    return false;
  }

  return nodeHasAcceptedText(toCandidateNode(mutation.target), platform);
}

function addedNodesHaveAcceptedText(
  nodes: readonly TextCandidateNode[],
  platform: AcceptedDetectionPlatform
): boolean {
  if (nodes.some((node) => nodeHasAcceptedText(node, platform))) {
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

  return candidates.some((candidate) => isAcceptedTextCandidate(candidate, platform));
}

function nodeHasAcceptedText(
  node: TextCandidateNode,
  platform: AcceptedDetectionPlatform
): boolean {
  if (isHiddenFromDetection(node)) {
    return false;
  }

  return collectCandidateTexts(node).some((candidate) =>
    isAcceptedTextCandidate(candidate, platform)
  );
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

function isAcceptedTextCandidate(
  candidate: TextCandidate,
  platform: AcceptedDetectionPlatform
): boolean {
  if (platform === "programmers") {
    return isProgrammersAcceptedResultText(candidate.text);
  }

  if (platform === "swea") {
    return isSweaAcceptedResultText(candidate.text);
  }

  if (!isResultTextCandidate(candidate.text)) {
    return false;
  }

  if (ACCEPTED_RESULT_PATTERN.test(candidate.text)) {
    return true;
  }

  return (
    candidate.allowExactAcceptedFallback &&
    EXACT_ACCEPTED_PATTERN.test(candidate.text)
  );
}

function textHasAccepted(
  text: string,
  platform: AcceptedDetectionPlatform
): boolean {
  const normalized = normalizeCandidateText(text);

  return (
    normalized.length > 0 &&
    isAcceptedTextCandidate(
      {
        text: normalized,
        allowExactAcceptedFallback: true
      },
      platform
    )
  );
}

function isResultTextCandidate(text: string): boolean {
  return (
    text.length > 0 &&
    text.length <= MAX_RESULT_TEXT_LENGTH &&
    !NON_ACCEPTED_RESULT_PATTERN.test(text) &&
    !GENERIC_ACCEPTED_PAGE_TEXT_PATTERN.test(text)
  );
}

function normalizeCandidateText(text: string): string {
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

export const defaultTimeoutScheduler: TimeoutScheduler = {
  setTimeout(callback, delayMs) {
    return setTimeout(callback, delayMs);
  },
  clearTimeout(timer) {
    clearTimeout(timer);
  }
};
