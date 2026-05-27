const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const ACCEPTED_WORD_PATTERN = /(^|[^a-z])accepted([^a-z]|$)/i;
const NON_ACCEPTED_RESULT_PATTERN =
  /\b(wrong answer|runtime error|compile error|time limit exceeded|memory limit exceeded|pending|judging|not accepted)\b/i;
const GENERIC_ACCEPTED_PAGE_TEXT_PATTERN =
  /\b(accepted submissions|accepted solutions|acceptance rate)\b/i;
const MAX_RESULT_TEXT_LENGTH = 180;

export interface DebounceScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

interface TextCandidateNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: Iterable<TextCandidateNode>;
  getAttribute?(name: string): string | null;
}

export function extractTitleSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/problems\/([^/?#]+)/);
  const slug = match?.[1]?.trim();

  return slug === undefined || slug.length === 0 ? null : decodeURIComponent(slug);
}

export function isAcceptedResultText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length === 0 || normalized.length > MAX_RESULT_TEXT_LENGTH) {
    return false;
  }

  if (
    NON_ACCEPTED_RESULT_PATTERN.test(normalized) ||
    GENERIC_ACCEPTED_PAGE_TEXT_PATTERN.test(normalized)
  ) {
    return false;
  }

  return ACCEPTED_WORD_PATTERN.test(normalized);
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
  return collectCandidateTexts(node).some(isAcceptedResultText);
}

function collectCandidateTexts(node: TextCandidateNode): string[] {
  if (node.nodeType === TEXT_NODE) {
    return [node.textContent ?? ""];
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return [];
  }

  const texts = [
    node.getAttribute?.("aria-label"),
    node.getAttribute?.("title"),
    node.textContent
  ].filter((text): text is string => text !== null && text !== undefined);

  const directText = Array.from(node.childNodes ?? [])
    .filter((child) => child.nodeType === TEXT_NODE)
    .map((child) => child.textContent ?? "")
    .join(" ")
    .trim();

  if (directText.length > 0) {
    texts.push(directText);
  }

  return texts;
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
