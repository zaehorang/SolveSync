import type { AcceptedDetectedMessage } from "../shared";
import {
  defaultTimeoutScheduler,
  extractProgrammersRouteFromPathname,
  extractTitleSlugFromPathname,
  isSweaSolvingPathname,
  mutationListHasAccepted,
  type ProgrammersRoute,
  type TimeoutScheduler
} from "./detector";
import {
  createProgrammersAcceptedPresentationTracker,
  PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER
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
      platform: "swea";
      contestProbId: string;
    }
  | {
      platform: "unsupported";
    };

/** route key를 확정하는 데 필요한 최소 document 표면 (ADR 0036).
 *
 * SWEA는 모든 문제가 같은 URL을 쓰므로 URL만으로는 route를 알 수 없다. */
export type ContentPageDocument = Pick<Document, "querySelector">;

export interface ProgrammersAcceptedEditorSnapshot extends ProgrammersRoute {
  problemTitle: string;
  rawLanguage: string;
  code: string;
  pageUrl: string;
  detectedAt: string;
}

/** SWEA는 code가 MAIN world bridge에서 비동기로 오므로 나머지 값만 먼저
 * 확정한다. 이 값들은 fresh Accepted 시점에 한 번 읽고 바뀌지 않는다. */
export interface SweaAcceptedEditorSnapshotMetadata {
  contestProbId: string;
  problemNumber: string;
  problemTitle: string;
  rawLanguage: string;
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
  /** SWEA editor code를 MAIN world bridge에서 읽어온다. 주입되지 않았거나
   * 응답이 없으면 empty code가 되어 background가 실패로 기록한다. */
  requestSweaEditorCode?(): Promise<string | null>;
}

export function startAcceptedDetectionController(
  options: AcceptedDetectionControllerOptions
): () => void {
  const scheduler = options.scheduler ?? defaultTimeoutScheduler;
  const coalescingWindowMs =
    options.coalescingWindowMs ?? ACCEPTED_COALESCING_WINDOW_MS;
  const resolvePage = (pageUrl: string): ContentPageContext =>
    resolveContentPageSafely(pageUrl, options.documentRef);
  const routeKeyForUrl = (pageUrl: string): string =>
    createContentRouteKey(resolvePage(pageUrl));
  let currentPage = resolvePage(options.getCurrentUrl());
  let currentRouteKey = createContentRouteKey(currentPage);
  const documentRoot = options.documentRef.body ?? options.documentRef.documentElement;
  const programmersPresentationTracker =
    createProgrammersAcceptedPresentationTracker();
  let pendingEvent: {
    routeKey: string;
    /** 값이 이미 확정된 경우. SWEA처럼 bridge 응답을 기다리면 null이다. */
    message: AcceptedDetectedMessage | null;
    messagePromise: Promise<AcceptedDetectedMessage> | null;
  } | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const clearPendingEvent = (): void => {
    if (pendingTimer !== null) {
      scheduler.clearTimeout(pendingTimer);
    }

    pendingEvent = null;
    pendingTimer = null;
  };

  const deliver = (message: AcceptedDetectedMessage, routeKey: string): void => {
    if (routeKeyForUrl(options.getCurrentUrl()) !== routeKey) {
      return;
    }

    options.sendAcceptedMessage(message);
  };

  const flushPendingEvent = (): void => {
    const event = pendingEvent;
    pendingEvent = null;
    pendingTimer = null;

    if (event === null) {
      return;
    }

    if (event.message !== null) {
      deliver(event.message, event.routeKey);
      return;
    }

    // route는 전달 직전에 다시 확인한다 (ADR 0034). bridge 응답을 기다리는
    // 동안 route가 바뀌었으면 이 event는 버린다.
    void event.messagePromise?.then((message) => {
      deliver(message, event.routeKey);
    });
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

    if (page.platform === "swea") {
      // metadata는 지금 읽고 code 요청도 지금 보낸다. 지연 callback에서 DOM을
      // 다시 읽지 않는다 (ADR 0034).
      const snapshot = extractSweaAcceptedEditorSnapshotMetadata(
        options.documentRef,
        page,
        pageUrl,
        detectedAt
      );
      // bridge 실패는 전부 empty code로 수렴해야 한다. 여기서 reject를 흘리면
      // event가 조용히 사라져 사용자가 실패를 보지 못한다.
      const codePromise = (
        options.requestSweaEditorCode?.() ?? Promise.resolve(null)
      ).catch(() => null);

      pendingEvent = {
        routeKey,
        message: null,
        messagePromise: codePromise.then((code) =>
          createSweaAcceptedDetectedMessage(snapshot, code ?? "")
        )
      };
      pendingTimer = scheduler.setTimeout(flushPendingEvent, coalescingWindowMs);

      return;
    }

    pendingEvent = {
      routeKey,
      message: createAcceptedMessageForPage(
        options.documentRef,
        page,
        pageUrl,
        detectedAt
      ),
      messagePromise: null
    };
    pendingTimer = scheduler.setTimeout(flushPendingEvent, coalescingWindowMs);
  };

  const observeTargets = (presentationRoot: Element | null): void => {
    observer.disconnect();
    observer.observe(documentRoot, {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true
    });

    if (presentationRoot !== null) {
      observer.observe(presentationRoot, {
        attributes: true,
        attributeFilter: [...PROGRAMMERS_PRESENTATION_ATTRIBUTE_FILTER]
      });
    }
  };

  const observer = options.createObserver((mutations) => {
    const pageUrl = options.getCurrentUrl();
    const page = resolvePage(pageUrl);
    const nextRouteKey = createContentRouteKey(page);
    const previousPage = currentPage;
    const routeChanged = nextRouteKey !== currentRouteKey;

    if (routeChanged) {
      currentPage = page;
      currentRouteKey = nextRouteKey;
      clearPendingEvent();
    }

    if (page.platform === "unsupported") {
      if (routeChanged && previousPage.platform === "programmers") {
        observeTargets(null);
      }

      return;
    }

    if (page.platform === "leetcode" || page.platform === "swea") {
      if (routeChanged && previousPage.platform === "programmers") {
        observeTargets(null);
      }

      if (mutationListHasAccepted(mutations, page.platform)) {
        queueAcceptedEvent(page, pageUrl, nextRouteKey);
      }

      return;
    }

    if (routeChanged && previousPage.platform !== "programmers") {
      observeTargets(programmersPresentationTracker.reset(options.documentRef));
      return;
    }

    const reconciliation = programmersPresentationTracker.reconcile(
      options.documentRef,
      mutations,
      {
        freshAcceptedText: mutationListHasAccepted(mutations, page.platform),
        routeChanged
      }
    );

    if (reconciliation.rootChanged) {
      observeTargets(reconciliation.root);
    }

    if (reconciliation.becameAcceptedVisible) {
      queueAcceptedEvent(page, pageUrl, nextRouteKey);
    }
  });

  observeTargets(
    currentPage.platform === "programmers"
      ? programmersPresentationTracker.reset(options.documentRef)
      : null
  );

  return () => {
    clearPendingEvent();
    observer.disconnect();
  };
}

export function resolveContentPage(
  url: URL,
  documentRef: ContentPageDocument
): ContentPageContext {
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

  if (url.hostname === "swexpertacademy.com" && isSweaSolvingPathname(url.pathname)) {
    return resolveSweaPage(documentRef);
  }

  return { platform: "unsupported" };
}

/** SWEA route identity는 URL이 아니라 DOM에서 온다 (ADR 0036).
 *
 * `#contestProbId`를 읽지 못하면 어떤 문제인지 알 수 없으므로 unsupported로
 * 처리하고 event를 만들지 않는다. */
function resolveSweaPage(documentRef: ContentPageDocument): ContentPageContext {
  const contestProbId = normalizeText(
    documentRef.querySelector<HTMLInputElement>("input#contestProbId")?.value ?? ""
  );

  return contestProbId.length === 0
    ? { platform: "unsupported" }
    : { platform: "swea", contestProbId };
}

export function createContentRouteKey(page: ContentPageContext): string {
  if (page.platform === "leetcode") {
    return `leetcode:${page.titleSlug}`;
  }

  if (page.platform === "programmers") {
    return `programmers:${page.courseId}:${page.lessonId}`;
  }

  if (page.platform === "swea") {
    return `swea:${page.contestProbId}`;
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

export function createSweaAcceptedDetectedMessage(
  snapshot: SweaAcceptedEditorSnapshotMetadata,
  code: string
): AcceptedDetectedMessage {
  return {
    type: "content:accepted_detected",
    payload: {
      codingPlatform: "swea",
      contestProbId: snapshot.contestProbId,
      problemNumber: snapshot.problemNumber,
      problemTitle: snapshot.problemTitle,
      language: snapshot.rawLanguage,
      code,
      pageUrl: snapshot.pageUrl,
      detectedAt: snapshot.detectedAt
    }
  };
}

export function extractSweaAcceptedEditorSnapshotMetadata(
  documentRef: ContentPageDocument,
  page: { contestProbId: string },
  pageUrl: string,
  detectedAt: string
): SweaAcceptedEditorSnapshotMetadata {
  const problem = extractSweaProblemTitle(documentRef);

  return {
    contestProbId: page.contestProbId,
    problemNumber: problem.problemNumber,
    problemTitle: problem.problemTitle,
    rawLanguage: extractSweaRawLanguage(documentRef),
    pageUrl,
    detectedAt
  };
}

/** `h3.problem_title`은 `{문제 번호}. {제목}` 형식이다.
 *
 * 번호는 파일명에, 제목은 Solution Catalog에 쓴다. 형식이 어긋나면 번호 없이
 * 전체를 제목으로 둔다. 이 경우 background가 contestProbId를 번호 자리에 쓴다.
 */
export function extractSweaProblemTitle(documentRef: ContentPageDocument): {
  problemNumber: string;
  problemTitle: string;
} {
  const raw = normalizeText(
    documentRef.querySelector<HTMLElement>("h3.problem_title")?.textContent ?? ""
  );
  const match = raw.match(/^(\d+)\s*\.\s*(.+)$/);

  if (match === null) {
    return { problemNumber: "", problemTitle: raw };
  }

  return {
    problemNumber: match[1] ?? "",
    problemTitle: normalizeText(match[2] ?? "")
  };
}

/** SWEA 언어는 option value code(`P`/`J`/`Y`)를 우선 사용한다.
 *
 * option text에는 `gcc-10.5`, `PyPy 7.3.9` 같은 compiler version이 박혀 있어
 * SWEA가 runtime을 올리면 매핑이 깨진다. text로 되돌아갈 때는 괄호 부분을
 * 떼어낸다. */
export function extractSweaRawLanguage(documentRef: ContentPageDocument): string {
  const select = documentRef.querySelector<HTMLSelectElement>("select#sel_lang");

  if (select === null) {
    return "";
  }

  const value = normalizeText(select.value ?? "");

  if (value.length > 0) {
    return value;
  }

  const optionText = select.selectedOptions?.[0]?.textContent ?? "";

  return normalizeText(optionText.replace(/\([^)]*\)/g, ""));
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
  page: Extract<ContentPageContext, { platform: "leetcode" | "programmers" }>,
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

function resolveContentPageSafely(
  pageUrl: string,
  documentRef: ContentPageDocument
): ContentPageContext {
  try {
    return resolveContentPage(new URL(pageUrl), documentRef);
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
