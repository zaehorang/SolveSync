/** Programmers Coding Platform Adapter.
 *
 * 전이 판정만 셋 중 유일하게 유상태다. Programmers가 같은 result modal node를
 * 재사용하므로 두 번째 Accepted에서 새 node 추가가 없을 수 있고, mutation
 * 기반 판정은 그 순간을 통째로 놓친다. 그래서 등록한 presentation root의
 * 상태를 기억하고 `inactive → acceptedVisible` 전이에서만 signal을 만든다.
 *
 * presentation state를 adapter 수명에 두는 이유가 있다. 같은 플랫폼 안에서
 * lesson을 옮길 때 state가 유지돼야 현재 동작과 같다. observation은 route마다
 * 새로 만들어지지만 tracker는 그것을 넘어 산다.
 */
import type { AcceptedDetectedMessage } from "../../shared";
import {
  MAX_RESULT_TEXT_LENGTH,
  mutationListMatchesText,
  normalizeCandidateText,
  type TextCandidate
} from "../mutationText";
import type {
  AcceptedSignal,
  DetectContext,
  ObserveTarget,
  PlatformAdapter,
  PlatformObservation,
  PlatformObservationDocument,
  PlatformPageDocument,
  ResolvedRoute,
  RouteTransition
} from "./types";

const HOSTNAME = "school.programmers.co.kr";
const ACCEPTED_TEXT = "정답입니다!";
const PRESENTATION_ROOT_SELECTOR = "#modal-dialog";
const PRESENTATION_TITLE_SELECTOR = ".modal-title";

/** ADR 0022에 따라 page 전체가 아니라 등록한 root의 visibility attribute만
 * 관찰한다. */
const PRESENTATION_ATTRIBUTE_FILTER = [
  "aria-hidden",
  "hidden",
  "class",
  "style"
] as const;

type PresentationState = "inactive" | "acceptedVisible";

interface PresentationStyle {
  display: string;
  visibility: string;
}

export interface ProgrammersRoute {
  courseId: string;
  lessonId: string;
}

export interface ProgrammersAdapterOptions {
  findPresentationRoot?(documentRef: PlatformPageDocument): Element | null;
  readComputedStyle?(element: Element): PresentationStyle;
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

export function isProgrammersAcceptedResultText(text: string): boolean {
  const normalized = normalizeCandidateText(text);

  return (
    normalized.length > 0 &&
    normalized.length <= MAX_RESULT_TEXT_LENGTH &&
    normalized === ACCEPTED_TEXT
  );
}

export function isProgrammersAcceptedCandidate(candidate: TextCandidate): boolean {
  return isProgrammersAcceptedResultText(candidate.text);
}

export function extractProgrammersEditorCode(
  documentRef: PlatformPageDocument
): string | null {
  const textarea = documentRef.querySelector<HTMLTextAreaElement>("textarea#code");

  if (textarea === null || textarea.value.trim().length === 0) {
    return null;
  }

  return textarea.value;
}

export function extractProgrammersProblemTitle(
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
    const title = cleanTitle(candidate ?? "");

    if (title.length > 0) {
      return title;
    }
  }

  return fallback;
}

export function extractProgrammersRawLanguage(
  documentRef: PlatformPageDocument
): string {
  const selectors = [
    'select[name="language"]',
    "select#language",
    'select[name="language_id"]',
    'input[name="language"]',
    '[data-language][aria-selected="true"]',
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

export function createProgrammersAdapter(
  options: ProgrammersAdapterOptions = {}
): PlatformAdapter {
  const findPresentationRoot = options.findPresentationRoot ?? findDefaultRoot;
  const readComputedStyle = options.readComputedStyle ?? readDefaultComputedStyle;

  // route를 넘어 사는 상태다. 같은 플랫폼 안 lesson 이동에서 유지돼야 한다.
  let root: Element | null = null;
  let state: PresentationState = "inactive";

  const readState = (): PresentationState =>
    root !== null && hasExactAcceptedTitle(root) && isVisible(root, readComputedStyle)
      ? "acceptedVisible"
      : "inactive";

  const reset = (doc: PlatformPageDocument): void => {
    root = findPresentationRoot(doc);
    state = readState();
  };

  function createObservation(
    doc: PlatformObservationDocument,
    route: ProgrammersRoute,
    transition: RouteTransition
  ): PlatformObservation {
    if (transition !== "samePlatform") {
      reset(doc);
    }

    // 다른 플랫폼에서 진입한 batch는 판정하지 않는다. root만 잡고 다음
    // batch부터 본다. 현재 동작이며 investigation note의 SPA 복귀 누락
    // 후보가 여기에 닿아 있다.
    let skipBatch = transition === "otherPlatform";
    let routeChanged = transition === "samePlatform";
    let targetsCache = buildTargets(doc, root);

    const refreshTargets = (): void => {
      targetsCache = buildTargets(doc, root);
    };

    return {
      targets: () => targetsCache,
      detect(records, context: DetectContext) {
        const isRouteChangeBatch = routeChanged;
        routeChanged = false;

        if (skipBatch) {
          skipBatch = false;
          return null;
        }

        const nextRoot = findPresentationRoot(doc);

        if (nextRoot !== root) {
          root = nextRoot;
          state = readState();
          refreshTargets();
          return null;
        }

        if (root === null) {
          return null;
        }

        const currentRoot = root;
        const freshAcceptedText = mutationListMatchesText(
          records,
          isProgrammersAcceptedCandidate
        );
        const hasPresentationAttributeMutation = records.some(
          (record) =>
            record.type === "attributes" &&
            record.target === currentRoot &&
            isPresentationAttribute(record.attributeName)
        );

        if (
          isRouteChangeBatch &&
          !freshAcceptedText &&
          !hasPresentationAttributeMutation
        ) {
          state = readState();
          return null;
        }

        if (isRouteChangeBatch && freshAcceptedText) {
          state = "inactive";
        }

        if (freshAcceptedText || hasPresentationAttributeMutation) {
          const previousState = state;
          state = readState();

          return previousState === "inactive" && state === "acceptedVisible"
            ? createSignal(doc, route, context)
            : null;
        }

        if (
          records.some((record) => isNodeWithinRoot(record.target, currentRoot)) &&
          readState() === "inactive"
        ) {
          state = "inactive";
        }

        return null;
      }
    };
  }

  return {
    platform: "programmers",
    resolveRoute(url: URL, _doc: PlatformPageDocument): ResolvedRoute | null {
      if (url.hostname !== HOSTNAME) {
        return null;
      }

      const route = extractProgrammersRouteFromPathname(url.pathname);

      if (route === null) {
        return null;
      }

      return {
        platform: "programmers",
        key: `programmers:${route.courseId}:${route.lessonId}`,
        observe: (doc, transition) => createObservation(doc, route, transition)
      };
    }
  };
}

function createSignal(
  doc: PlatformObservationDocument,
  route: ProgrammersRoute,
  context: DetectContext
): AcceptedSignal {
  // fresh 시점에 한 번 읽는다. 조립에서 DOM을 다시 읽지 않는다 (ADR 0034).
  const detectedAt = context.now();
  const payload = {
    codingPlatform: "programmers" as const,
    courseId: route.courseId,
    lessonId: route.lessonId,
    problemTitle: extractProgrammersProblemTitle(doc, route.lessonId),
    language: extractProgrammersRawLanguage(doc),
    code: extractProgrammersEditorCode(doc) ?? "",
    pageUrl: context.pageUrl,
    detectedAt
  };

  return {
    detectedAt,
    toMessage: (): AcceptedDetectedMessage => ({
      type: "content:accepted_detected",
      payload
    })
  };
}

function buildTargets(
  doc: PlatformObservationDocument,
  root: Element | null
): readonly ObserveTarget[] {
  const documentRoot = doc.body ?? doc.documentElement;
  const targets: ObserveTarget[] = [
    {
      node: documentRoot,
      init: {
        childList: true,
        characterData: true,
        characterDataOldValue: true,
        subtree: true
      }
    }
  ];

  if (root !== null) {
    targets.push({
      node: root,
      init: {
        attributes: true,
        attributeFilter: [...PRESENTATION_ATTRIBUTE_FILTER]
      }
    });
  }

  return targets;
}

function findDefaultRoot(documentRef: PlatformPageDocument): Element | null {
  return documentRef.querySelector(PRESENTATION_ROOT_SELECTOR);
}

function hasExactAcceptedTitle(root: Element): boolean {
  const title = root.querySelector(PRESENTATION_TITLE_SELECTOR);

  return title !== null && isProgrammersAcceptedResultText(title.textContent ?? "");
}

function isVisible(
  root: Element,
  readComputedStyle: (element: Element) => PresentationStyle
): boolean {
  if (
    root.hasAttribute("hidden") ||
    normalizeCandidateText(root.getAttribute("aria-hidden") ?? "").toLowerCase() ===
      "true"
  ) {
    return false;
  }

  const style = readComputedStyle(root);

  return (
    normalizeCandidateText(style.display).toLowerCase() !== "none" &&
    normalizeCandidateText(style.visibility).toLowerCase() !== "hidden"
  );
}

function readDefaultComputedStyle(element: Element): PresentationStyle {
  const view = element.ownerDocument?.defaultView;

  if (view === null || view === undefined) {
    return { display: "", visibility: "" };
  }

  const style = view.getComputedStyle(element);

  return { display: style.display, visibility: style.visibility };
}

function isPresentationAttribute(attributeName: string | null): boolean {
  return (
    attributeName !== null &&
    PRESENTATION_ATTRIBUTE_FILTER.includes(
      attributeName as (typeof PRESENTATION_ATTRIBUTE_FILTER)[number]
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

function cleanTitle(raw: string): string {
  const title = normalizeCandidateText(raw)
    .replace(/\s*\|\s*프로그래머스.*$/i, "")
    .replace(/^코딩테스트\s*연습\s*-\s*/, "")
    .trim();

  return /^(코딩테스트\s*연습|프로그래머스|programmers)$/i.test(title) ? "" : title;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizeCandidateText(value ?? "");

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}
