import {
  APP_NAME,
  isRuntimeMessage,
  type AcceptedDetectedMessage,
  type RuntimeMessage
} from "../shared";
import {
  type AcceptedDetectionPlatform,
  createDebouncedCallback,
  extractProgrammersRouteFromPathname,
  extractTitleSlugFromPathname,
  mutationListHasAccepted,
  type ProgrammersRoute
} from "./detector";
import { ContentToast, createToastModel } from "./toast";

const ACCEPTED_DEBOUNCE_MS = 700;

export type ContentPageContext =
  | {
      platform: "leetcode";
      titleSlug: string;
    }
  | {
      platform: "programmers";
      courseId: string;
      lessonId: string;
    }
  | {
      platform: "unsupported";
    };

export interface ProgrammersAcceptedSnapshot extends ProgrammersRoute {
  problemTitle: string;
  rawLanguage: string;
  code: string;
  pageUrl: string;
  detectedAt: string;
}

export function createAcceptedDetectedMessage(
  titleSlug: string,
  pageUrl: string,
  detectedAt: string
): AcceptedDetectedMessage {
  return {
    type: "content:accepted_detected",
    payload: {
      platform: "leetcode",
      titleSlug,
      pageUrl,
      detectedAt
    }
  };
}

export function createProgrammersAcceptedDetectedMessage(
  snapshot: ProgrammersAcceptedSnapshot
): AcceptedDetectedMessage {
  return {
    type: "content:accepted_detected",
    payload: {
      platform: "programmers",
      courseId: snapshot.courseId,
      lessonId: snapshot.lessonId,
      problemTitle: snapshot.problemTitle,
      language: snapshot.rawLanguage,
      code: snapshot.code,
      pageUrl: snapshot.pageUrl,
      detectedAt: snapshot.detectedAt
    }
  };
}

export function resolveContentPage(url: URL): ContentPageContext {
  if (url.hostname === "leetcode.com") {
    const titleSlug = extractTitleSlugFromPathname(url.pathname);

    return titleSlug === null
      ? { platform: "unsupported" }
      : { platform: "leetcode", titleSlug };
  }

  if (url.hostname === "school.programmers.co.kr") {
    const route = extractProgrammersRouteFromPathname(url.pathname);

    return route === null ? { platform: "unsupported" } : { platform: "programmers", ...route };
  }

  return { platform: "unsupported" };
}

export function extractProgrammersAcceptedSnapshot(
  documentRef: Pick<Document, "querySelector" | "title">,
  route: ProgrammersRoute,
  pageUrl: string,
  detectedAt: string
): ProgrammersAcceptedSnapshot {
  return {
    ...route,
    problemTitle: extractProgrammersProblemTitle(documentRef, route.lessonId),
    rawLanguage: extractProgrammersRawLanguage(documentRef),
    code: extractProgrammersEditorCode(documentRef) ?? "",
    pageUrl,
    detectedAt
  };
}

export function extractProgrammersEditorCode(
  documentRef: Pick<Document, "querySelector">
): string | null {
  const textarea = documentRef.querySelector<HTMLTextAreaElement>("textarea#code");

  if (textarea === null || textarea.value.trim().length === 0) {
    return null;
  }

  return textarea.value;
}

export function startContentScript(): void {
  const page = resolveContentPage(new URL(window.location.href));
  const toast = new ContentToast(document, sendToastAction);

  sendRuntimeMessage({
    type: "scaffold:ready",
    surface: "content"
  });

  if (page.platform !== "unsupported") {
    startAcceptedObserver(page);
  }

  chrome.runtime.onMessage.addListener((rawMessage) => {
    if (!isRuntimeMessage(rawMessage)) {
      return false;
    }

    if (rawMessage.type === "sync:status") {
      toast.show(createToastModel(rawMessage.payload));
    }

    return false;
  });

  console.debug(`${APP_NAME} content script loaded`, { page });
}

if (canStartContentScript()) {
  startContentScript();
}

function startAcceptedObserver(
  page: Extract<ContentPageContext, { platform: AcceptedDetectionPlatform }>
): void {
  const notifyAccepted = createDebouncedCallback(() => {
    sendRuntimeMessage(createAcceptedMessageForPage(page, new Date().toISOString()));
  }, ACCEPTED_DEBOUNCE_MS);

  const observer = new MutationObserver((mutations) => {
    if (mutationListHasAccepted(mutations, page.platform)) {
      notifyAccepted();
    }
  });

  observer.observe(document.body ?? document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

function createAcceptedMessageForPage(
  page: Extract<ContentPageContext, { platform: AcceptedDetectionPlatform }>,
  detectedAt: string
): AcceptedDetectedMessage {
  if (page.platform === "leetcode") {
    return createAcceptedDetectedMessage(page.titleSlug, window.location.href, detectedAt);
  }

  return createProgrammersAcceptedDetectedMessage(
    extractProgrammersAcceptedSnapshot(document, page, window.location.href, detectedAt)
  );
}

function extractProgrammersProblemTitle(
  documentRef: Pick<Document, "querySelector" | "title">,
  fallback: string
): string {
  const candidates = [
    readMetaContent(documentRef.querySelector<HTMLMetaElement>('meta[property="og:title"]')),
    readMetaContent(documentRef.querySelector<HTMLMetaElement>('meta[name="title"]')),
    documentRef.title,
    readTextContent(documentRef.querySelector<HTMLElement>("h1")),
    readTextContent(documentRef.querySelector<HTMLElement>("h2")),
    fallback
  ];

  for (const candidate of candidates) {
    const title = cleanProgrammersTitle(candidate ?? "");

    if (title.length > 0) {
      return title;
    }
  }

  return fallback;
}

function extractProgrammersRawLanguage(
  documentRef: Pick<Document, "querySelector">
): string {
  const selectors = [
    'select[name="language"]',
    "select#language",
    'select[name="language_id"]',
    'input[name="language"]',
    "[data-language][aria-selected=\"true\"]",
    "[data-language].active"
  ];

  for (const selector of selectors) {
    const language = readLanguageCandidate(documentRef.querySelector(selector));

    if (language !== null) {
      return language;
    }
  }

  return "";
}

function readLanguageCandidate(node: Element | null): string | null {
  if (node === null) {
    return null;
  }

  const candidate = node as Element & {
    value?: string;
    selectedOptions?: {
      item?(index: number): { textContent?: string | null; value?: string } | null;
      [index: number]: { textContent?: string | null; value?: string } | undefined;
    };
  };
  const selectedOption =
    candidate.selectedOptions?.item?.(0) ?? candidate.selectedOptions?.[0] ?? null;

  return firstNonEmpty(
    selectedOption?.textContent,
    selectedOption?.value,
    candidate.getAttribute?.("data-language"),
    candidate.value,
    candidate.textContent
  );
}

function readTextContent(node: Element | null): string | null {
  return firstNonEmpty(node?.textContent);
}

function readMetaContent(node: HTMLMetaElement | null): string | null {
  return firstNonEmpty(node?.content);
}

function cleanProgrammersTitle(raw: string): string {
  const title = normalizeText(raw)
    .replace(/\s*\|\s*프로그래머스.*$/i, "")
    .replace(/^코딩테스트\s*연습\s*-\s*/, "")
    .trim();

  return /^(코딩테스트\s*연습|프로그래머스|programmers)$/i.test(title) ? "" : title;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizeText(value ?? "");

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sendToastAction(
  action: Extract<RuntimeMessage, { type: "content:toast_action" }>["payload"]["action"],
  recordId: string | null
): void {
  sendRuntimeMessage({
    type: "content:toast_action",
    payload: {
      action,
      recordId
    }
  });
}

function sendRuntimeMessage(message: RuntimeMessage): void {
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    console.debug(`${APP_NAME} content script could not reach background`, error);
  }
}

function canStartContentScript(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof chrome !== "undefined" &&
    chrome.runtime?.sendMessage !== undefined &&
    chrome.runtime?.onMessage !== undefined
  );
}
