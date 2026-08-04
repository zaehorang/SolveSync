import type { AcceptedDetectedMessage } from "../shared";
import {
  defaultTimeoutScheduler,
  extractProgrammersRouteFromPathname,
  extractTitleSlugFromPathname,
  mutationListHasAccepted,
  type ProgrammersRoute,
  type TimeoutScheduler
} from "./detector";
import {
  createProgrammersAcceptedPresentationTracker,
  PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER,
  type ProgrammersAcceptedPresentationTracker
} from "./programmersAcceptedPresentation";

const ACCEPTED_COALESCING_WINDOW_MS = 700;

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

export interface ProgrammersAcceptedEditorSnapshot extends ProgrammersRoute {
  problemTitle: string;
  rawLanguage: string;
  code: string;
  pageUrl: string;
  detectedAt: string;
}

interface AcceptedDetectionDocument
  extends Pick<Document, "body" | "documentElement" | "querySelector" | "title"> {}

interface AcceptedMutationObserver {
  observe(target: Node, options?: MutationObserverInit): void;
  disconnect(): void;
}

export interface AcceptedDetectionControllerOptions {
  documentRef: AcceptedDetectionDocument;
  getCurrentUrl(): string;
  sendAcceptedMessage(message: AcceptedDetectedMessage): void;
  createObserver(callback: MutationCallback): AcceptedMutationObserver;
  now?(): string;
  scheduler?: TimeoutScheduler;
  coalescingWindowMs?: number;
  programmersPresentationTracker?: ProgrammersAcceptedPresentationTracker;
}

export function startAcceptedDetectionController(
  options: AcceptedDetectionControllerOptions
): () => void {
  const scheduler = options.scheduler ?? defaultTimeoutScheduler;
  const coalescingWindowMs =
    options.coalescingWindowMs ?? ACCEPTED_COALESCING_WINDOW_MS;
  let currentRouteKey = routeKeyForUrl(options.getCurrentUrl());
  const programmersPresentationTracker =
    options.programmersPresentationTracker ??
    createProgrammersAcceptedPresentationTracker();
  let pendingEvent: {
    routeKey: string;
    message: AcceptedDetectedMessage;
  } | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let observedProgrammersPresentationRoot: Element | null = null;

  const clearPendingEvent = (): void => {
    if (pendingTimer !== null) {
      scheduler.clearTimeout(pendingTimer);
    }

    pendingEvent = null;
    pendingTimer = null;
  };

  const flushPendingEvent = (): void => {
    const event = pendingEvent;
    pendingEvent = null;
    pendingTimer = null;

    if (event === null || routeKeyForUrl(options.getCurrentUrl()) !== event.routeKey) {
      return;
    }

    options.sendAcceptedMessage(event.message);
  };

  let presentationObserver: AcceptedMutationObserver | null = null;

  const bindProgrammersPresentationObserver = (): void => {
    const nextRoot = programmersPresentationTracker.getRoot();

    if (nextRoot === observedProgrammersPresentationRoot) {
      return;
    }

    presentationObserver?.disconnect();
    observedProgrammersPresentationRoot = nextRoot;

    if (nextRoot !== null) {
      presentationObserver?.observe(nextRoot, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: [...PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER]
      });
    }
  };

  const preparePage = (
    page: ContentPageContext,
    nextRouteKey: string
  ): boolean => {
    if (nextRouteKey === currentRouteKey) {
      return false;
    }

    currentRouteKey = nextRouteKey;
    clearPendingEvent();

    if (page.platform === "programmers") {
      programmersPresentationTracker.reset(options.documentRef);
      bindProgrammersPresentationObserver();
    } else {
      observedProgrammersPresentationRoot = null;
      presentationObserver?.disconnect();
    }
    return true;
  };

  const queueAcceptedEvent = (
    page: Exclude<ContentPageContext, { platform: "unsupported" }>,
    pageUrl: string,
    routeKey: string
  ): void => {
    if (pendingEvent !== null) {
      return;
    }

    const detectedAt = options.now?.() ?? new Date().toISOString();
    pendingEvent = {
      routeKey,
      message: createAcceptedMessageForPage(
        options.documentRef,
        page,
        pageUrl,
        detectedAt
      )
    };
    pendingTimer = scheduler.setTimeout(flushPendingEvent, coalescingWindowMs);
  };

  presentationObserver = options.createObserver((mutations) => {
    const pageUrl = options.getCurrentUrl();
    const page = resolveContentPageSafely(pageUrl);
    const nextRouteKey = createContentRouteKey(page);

    preparePage(page, nextRouteKey);

    if (page.platform !== "programmers") {
      return;
    }

    const transition = programmersPresentationTracker.handleMutations(mutations);

    if (transition === "becameAcceptedVisible") {
      queueAcceptedEvent(page, pageUrl, nextRouteKey);
    }
  });

  const initialPage = resolveContentPageSafely(options.getCurrentUrl());

  if (initialPage.platform === "programmers") {
    programmersPresentationTracker.reset(options.documentRef);
    bindProgrammersPresentationObserver();
  }

  const observer = options.createObserver((mutations) => {
    const pageUrl = options.getCurrentUrl();
    const page = resolveContentPageSafely(pageUrl);
    const nextRouteKey = createContentRouteKey(page);

    const routeChanged = preparePage(page, nextRouteKey);

    if (page.platform === "unsupported") {
      return;
    }

    if (page.platform === "leetcode") {
      if (mutationListHasAccepted(mutations, page.platform)) {
        queueAcceptedEvent(page, pageUrl, nextRouteKey);
      }

      return;
    }

    const stateBeforeRefresh = programmersPresentationTracker.getState();
    const rootChanged = programmersPresentationTracker.refreshRoot(options.documentRef);

    if (rootChanged) {
      bindProgrammersPresentationObserver();
    }

    const hasFreshAcceptedText = mutationListHasAccepted(mutations, page.platform);
    const acceptedWasAlreadyVisible =
      !routeChanged && !rootChanged && stateBeforeRefresh === "acceptedVisible";

    if (hasFreshAcceptedText && !acceptedWasAlreadyVisible) {
      queueAcceptedEvent(page, pageUrl, nextRouteKey);
    }

    if (hasFreshAcceptedText) {
      programmersPresentationTracker.synchronizeCurrentState();
    } else if (programmersPresentationTracker.mutationsTouchPresentation(mutations)) {
      programmersPresentationTracker.rearmIfInactive();
    }
  });

  observer.observe(options.documentRef.body ?? options.documentRef.documentElement, {
    childList: true,
    characterData: true,
    characterDataOldValue: true,
    subtree: true
  });

  return () => {
    clearPendingEvent();
    observer.disconnect();
    presentationObserver?.disconnect();
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

export function createContentRouteKey(page: ContentPageContext): string {
  if (page.platform === "leetcode") {
    return `leetcode:${page.titleSlug}`;
  }

  if (page.platform === "programmers") {
    return `programmers:${page.courseId}:${page.lessonId}`;
  }

  return "unsupported";
}

export function createAcceptedDetectedMessage(
  titleSlug: string,
  pageUrl: string,
  detectedAt: string
): AcceptedDetectedMessage {
  return {
    type: "content:accepted_detected",
    payload: {
      codingPlatform: "leetcode",
      titleSlug,
      pageUrl,
      detectedAt
    }
  };
}

export function createProgrammersAcceptedDetectedMessage(
  acceptedEditorSnapshot: ProgrammersAcceptedEditorSnapshot
): AcceptedDetectedMessage {
  return {
    type: "content:accepted_detected",
    payload: {
      codingPlatform: "programmers",
      courseId: acceptedEditorSnapshot.courseId,
      lessonId: acceptedEditorSnapshot.lessonId,
      problemTitle: acceptedEditorSnapshot.problemTitle,
      language: acceptedEditorSnapshot.rawLanguage,
      code: acceptedEditorSnapshot.code,
      pageUrl: acceptedEditorSnapshot.pageUrl,
      detectedAt: acceptedEditorSnapshot.detectedAt
    }
  };
}

export function extractProgrammersAcceptedEditorSnapshot(
  documentRef: Pick<Document, "querySelector" | "title">,
  route: ProgrammersRoute,
  pageUrl: string,
  detectedAt: string
): ProgrammersAcceptedEditorSnapshot {
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

function createAcceptedMessageForPage(
  documentRef: Pick<Document, "querySelector" | "title">,
  page: Exclude<ContentPageContext, { platform: "unsupported" }>,
  pageUrl: string,
  detectedAt: string
): AcceptedDetectedMessage {
  if (page.platform === "leetcode") {
    return createAcceptedDetectedMessage(page.titleSlug, pageUrl, detectedAt);
  }

  return createProgrammersAcceptedDetectedMessage(
    extractProgrammersAcceptedEditorSnapshot(documentRef, page, pageUrl, detectedAt)
  );
}

function routeKeyForUrl(pageUrl: string): string {
  return createContentRouteKey(resolveContentPageSafely(pageUrl));
}

function resolveContentPageSafely(pageUrl: string): ContentPageContext {
  try {
    return resolveContentPage(new URL(pageUrl));
  } catch {
    return { platform: "unsupported" };
  }
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
