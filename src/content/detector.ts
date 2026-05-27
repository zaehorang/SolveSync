const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const EXACT_ACCEPTED_PATTERN = /^accepted$/i;
const ACCEPTED_RESULT_PATTERN =
  /\baccepted\b\s+\d+\s*\/\s*\d+\s+testcases?\s+passed\b/i;
const NON_ACCEPTED_RESULT_PATTERN =
  /\b(wrong answer|runtime error|compile error|time limit exceeded|memory limit exceeded|pending|judging|not accepted)\b/i;
const GENERIC_ACCEPTED_PAGE_TEXT_PATTERN =
  /\b(accepted submissions|accepted solutions|acceptance rate)\b/i;
const MAX_RESULT_TEXT_LENGTH = 180;
const MAX_TRAVERSAL_DEPTH = 6;
const MAX_TEXT_CANDIDATES = 80;
const MAX_JOINED_LEAF_TEXTS = 8;
const IGNORED_ELEMENT_NAMES = new Set(["script", "style", "noscript"]);

export interface DebounceScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

interface TextCandidateNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: Iterable<TextCandidateNode>;
  getAttribute?(name: string): string | null;
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

export function mutationListHasAccepted(
  mutations: readonly MutationRecord[]
): boolean {
  return mutations.some((mutation) => {
    if (nodeHasAcceptedText(toCandidateNode(mutation.target))) {
      return true;
    }

    return Array.from(mutation.addedNodes).some((node) =>
      nodeHasAcceptedText(toCandidateNode(node))
    );
  });
}

export function createDebouncedCallback(
  callback: () => void,
  delayMs: number,
  scheduler: DebounceScheduler = defaultScheduler
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return () => {
    if (timer !== null) {
      scheduler.clearTimeout(timer);
    }

    timer = scheduler.setTimeout(() => {
      timer = null;
      callback();
    }, delayMs);
  };
}

function nodeHasAcceptedText(node: TextCandidateNode): boolean {
  return collectCandidateTexts(node).some((candidate) =>
    isAcceptedTextCandidate(candidate)
  );
}

function collectCandidateTexts(node: TextCandidateNode): TextCandidate[] {
  const candidates: TextCandidate[] = [];
  collectLeafTexts(node, 0, candidates);

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

  if (isIgnoredElement(node)) {
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
    for (const text of childLeafTexts) {
      if (leafTexts.length <= MAX_JOINED_LEAF_TEXTS) {
        leafTexts.push(text);
      }
    }

    if (candidates.length >= MAX_TEXT_CANDIDATES) {
      break;
    }
  }

  addJoinedLeafCandidate(candidates, leafTexts);

  return leafTexts;
}

function addJoinedLeafCandidate(
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

function isAcceptedTextCandidate(candidate: TextCandidate): boolean {
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

function toCandidateNode(node: Node): TextCandidateNode {
  return node as unknown as TextCandidateNode;
}

const defaultScheduler: DebounceScheduler = {
  setTimeout(callback, delayMs) {
    return setTimeout(callback, delayMs);
  },
  clearTimeout(timer) {
    clearTimeout(timer);
  }
};
