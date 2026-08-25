/** 제출 순간의 DOM 변화를 page 안에서 기록한다.
 *
 * **제출 전에 무장해야 한다.** 제출 후에 걸면 Accepted 순간의 mutation을
 * 놓치고, 그 mutation이 "새 node 추가인가 속성 변경인가"를 판정하는 유일한
 * 근거다.
 *
 * `alert`와 `confirm`도 함께 가로챈다. page 쪽 override는 dialog 문구를
 * 기록만 하고 실제 native dialog를 그대로 띄운다. 그 native dialog는
 * Playwright가 CDP로 가로채는데, **핸들러를 등록하지 않으면 Playwright
 * 기본값은 자동 취소(cancel)다.** `confirm()`이 false를 받으면 "제출하시겠
 * 습니까?" 류의 흐름이 아무 mutation도 없이 조용히 멈춘다 — Programmers
 * 캡처가 실제로 여기서 5분을 버리고 timeout났다. 그래서 `page.on("dialog")`로
 * 항상 accept한다.
 */
import type { Page } from "@playwright/test";

export interface RecordedNode {
  readonly kind: "text" | "element" | "other";
  readonly name?: string;
  readonly html?: string;
  readonly text?: string;
}

export interface RecordedMutation {
  readonly type: string;
  readonly attributeName?: string | null;
  readonly oldValue?: string | null;
  readonly target: RecordedNode;
  readonly addedNodes: RecordedNode[];
  readonly removedNodes: RecordedNode[];
}

/** 관찰 대상 element의 batch 전후 상태.
 *
 * Programmers는 mutation record만 찍으면 `class` 하나 바뀐 것만 남아 재생이
 * 불가능하다. 상태를 함께 남겨야 fixture가 쓸모 있다. */
export interface WatchedState {
  readonly present: boolean;
  readonly attributes: Record<string, string>;
  readonly display: string;
  readonly visibility: string;
  readonly titleText: string | null;
}

export interface RecordedBatch {
  readonly index: number;
  readonly at: number;
  readonly mutations: RecordedMutation[];
  readonly watchedBefore: WatchedState | null;
  readonly watchedAfter: WatchedState | null;
}

export interface RecordedDialog {
  readonly kind: "alert" | "confirm";
  readonly message: string;
  readonly at: number;
}

export interface Recording {
  readonly batches: RecordedBatch[];
  readonly dialogs: RecordedDialog[];
}

export interface ArmOptions {
  /** 상태를 함께 남길 element. Programmers presentation root가 여기 해당한다. */
  readonly watchSelector?: string;
  /** 관찰 대상 안에서 제목으로 읽을 element. */
  readonly watchTitleSelector?: string;
  /** 한 node에서 남길 HTML 길이 상한. fixture가 무한정 커지는 것을 막는다. */
  readonly maxHtmlLength?: number;
}

const GLOBAL_KEY = "__solveSyncCapture";

/** 다음 navigation부터 page script보다 먼저 실행된다. */
export async function armRecorder(page: Page, options: ArmOptions = {}): Promise<void> {
  // page 쪽 override가 기록한 뒤 real native dialog로 넘긴다. 여기서
  // accept하지 않으면 Playwright 기본값(자동 취소)이 confirm을 false로
  // 만들어 제출 흐름을 조용히 끊는다.
  page.on("dialog", (dialog) => {
    dialog.accept().catch(() => undefined);
  });

  await page.addInitScript(
    ({ key, watchSelector, watchTitleSelector, maxHtmlLength }) => {
      const limit = maxHtmlLength ?? 4000;
      const store = { batches: [] as unknown[], dialogs: [] as unknown[] };
      (window as unknown as Record<string, unknown>)[key] = store;

      const describe = (node: Node, htmlLimit = limit): unknown => {
        if (node.nodeType === Node.TEXT_NODE) {
          return { kind: "text", text: node.textContent ?? "" };
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          return {
            kind: "element",
            name: element.tagName.toLowerCase(),
            html: element.outerHTML.slice(0, htmlLimit),
            text: (element.textContent ?? "").slice(0, htmlLimit)
          };
        }

        return { kind: "other" };
      };

      /** attribute mutation의 target은 짧게만 남긴다.
       *
       * 무엇이 바뀌었는지는 `attributeName`과 `oldValue`가 이미 말한다.
       * target에서 필요한 것은 "어느 element인가" 하나뿐이라 여는 tag면
       * 충분하다. 전체를 남기면 비용이 크다 — LeetCode 정답 캡처는 attribute
       * mutation이 5842건이었고, 건당 1000자를 담아 fixture가 5.4MB로 불었다.
       * 그중 판정에 쓰이는 정보는 없었다. */
      const ATTRIBUTE_TARGET_HTML_LIMIT = 200;

      const readWatched = (): unknown => {
        if (watchSelector === undefined) {
          return null;
        }

        const element = document.querySelector(watchSelector);

        if (element === null) {
          return {
            present: false,
            attributes: {},
            display: "",
            visibility: "",
            titleText: null
          };
        }

        const style = window.getComputedStyle(element);
        const attributes: Record<string, string> = {};

        for (const attribute of Array.from(element.attributes)) {
          attributes[attribute.name] = attribute.value;
        }

        return {
          present: true,
          attributes,
          display: style.display,
          visibility: style.visibility,
          titleText:
            watchTitleSelector === undefined
              ? null
              : (element.querySelector(watchTitleSelector)?.textContent ?? null)
        };
      };

      let watchedBefore = readWatched();

      // <head>는 제출 결과를 담지 않는다. LeetCode는 idle 상태에서도
      // <head>에 style tag를 계속 삽입해(실측 약 30개/초) 이 mutation이
      // 잡음의 대부분을 차지한다. 결과와 무관한 이 mutation만 걸러낸다.
      const isInHead = (node: Node): boolean =>
        document.head !== null && document.head.contains(node);

      new MutationObserver((mutations) => {
        const relevant = mutations.filter((mutation) => !isInHead(mutation.target));

        if (relevant.length === 0) {
          return;
        }

        const watchedAfter = readWatched();

        store.batches.push({
          index: store.batches.length,
          at: Date.now(),
          watchedBefore,
          watchedAfter,
          mutations: relevant.map((mutation) => ({
            type: mutation.type,
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue,
            target: describe(
              mutation.target,
              mutation.type === "attributes" ? ATTRIBUTE_TARGET_HTML_LIMIT : limit
            ),
            addedNodes: Array.from(mutation.addedNodes, describe),
            removedNodes: Array.from(mutation.removedNodes, describe)
          }))
        });

        watchedBefore = watchedAfter;
      }).observe(document, {
        // `document.documentElement`는 이 시점에 아직 없을 수 있다.
        // addInitScript는 CDP `Page.addScriptToEvaluateOnNewDocument`로
        // 실행되는데, 실측 결과 `<html>`이 파싱되기 전에 실행돼
        // `document.documentElement`가 `null`이었다. `.observe(null, ...)`은
        // TypeError를 던지고, addInitScript 안의 예외는 페이지 흐름을 막지
        // 않고 조용히 `pageerror`로만 나가 관찰자가 아예 안 붙은 채로
        // 나머지 script가 계속 실행된다 — recorder가 batch를 하나도 못
        // 남기면서도 겉으로는 정상 동작처럼 보였다. `document`는 이 시점에
        // 항상 있고 `<html>` 삽입 자체도 subtree로 잡히므로 이걸 관찰
        // 대상으로 쓴다.
        childList: true,
        characterData: true,
        characterDataOldValue: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true
      });

      // 기록만 하고 통과시킨다. 막으면 page 흐름이 달라져 관찰이 왜곡된다.
      const nativeAlert = window.alert.bind(window);
      const nativeConfirm = window.confirm.bind(window);

      window.alert = (message?: unknown) => {
        store.dialogs.push({ kind: "alert", message: String(message ?? ""), at: Date.now() });
        return nativeAlert(message as string);
      };

      window.confirm = (message?: unknown) => {
        store.dialogs.push({ kind: "confirm", message: String(message ?? ""), at: Date.now() });
        return nativeConfirm(message as string);
      };
    },
    {
      key: GLOBAL_KEY,
      watchSelector: options.watchSelector,
      watchTitleSelector: options.watchTitleSelector,
      maxHtmlLength: options.maxHtmlLength
    }
  );
}

/** 지금까지 쌓인 기록을 버린다.
 *
 * page 로딩과 코드 입력도 mutation을 만든다. fixture에는 제출부터 결과까지만
 * 남아야 하므로 제출 직전에 한 번 비운다. */
export async function resetRecording(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const store = (window as unknown as Record<string, unknown>)[key] as
      | { batches: unknown[]; dialogs: unknown[] }
      | undefined;

    if (store !== undefined) {
      store.batches.length = 0;
      store.dialogs.length = 0;
    }
  }, GLOBAL_KEY);
}

export async function readRecording(page: Page): Promise<Recording> {
  return (await page.evaluate((key) => {
    const store = (window as unknown as Record<string, unknown>)[key] as
      | { batches: unknown[]; dialogs: unknown[] }
      | undefined;

    return { batches: store?.batches ?? [], dialogs: store?.dialogs ?? [] };
  }, GLOBAL_KEY)) as Recording;
}

export interface QuietResult {
  readonly recording: Recording;
  /** true면 진짜로 조용해져서 멈췄다. false면 시간 제한에 걸려 멈췄다 —
   * 그 자체가 실패는 아니다. LeetCode는 idle 상태에서도 `<head>`에 style
   * tag가 계속 삽입돼(실측 약 30개/초) 완전한 침묵이 오지 않는다. */
  readonly reachedQuiet: boolean;
}

/** 변화가 멎거나, 시간 제한에 닿을 때까지 기다린다.
 *
 * 제출 결과는 채점 시간만큼 늦게 오고 언제 끝나는지 page가 알려주지 않는다.
 * batch가 한동안 늘지 않으면 끝난 것으로 본다. 다만 이 침묵 기반 판정은
 * 배경 잡음이 있는 page에서는 영원히 성립하지 않을 수 있으므로, 시간
 * 제한을 판정 실패가 아니라 "그만큼 기다렸으니 있는 걸 저장한다"는
 * 정상 종료 경로로 둔다. */
export async function waitForQuiet(
  page: Page,
  options: {
    minBatches?: number;
    quietMs?: number;
    timeoutMs?: number;
    /** 결과 신호가 이미 도착했는지 본다. LeetCode처럼 배경 잡음이 있는
     * page에서는 침묵을 기다리는 대신, 신호가 뜬 뒤 `settleAfterSignalMs`
     * 만 더 기다리고 멈춘다. 채점 완료 시점이 실측상 300ms~4s로 들쭉날쭉해
     * 고정 시간 대기로는 너무 이르게 끊기거나 너무 오래 잡음을 담는다. */
    stopWhen?: (recording: Recording) => boolean;
    settleAfterSignalMs?: number;
  } = {}
): Promise<QuietResult> {
  const minBatches = options.minBatches ?? 1;
  const quietMs = options.quietMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const settleAfterSignalMs = options.settleAfterSignalMs ?? 2000;
  const startedAt = Date.now();
  let lastCount = -1;
  let lastChangeAt = Date.now();
  let signaledAt: number | null = null;

  for (;;) {
    const recording = await readRecording(page);

    if (recording.batches.length !== lastCount) {
      lastCount = recording.batches.length;
      lastChangeAt = Date.now();
    }

    if (lastCount >= minBatches && Date.now() - lastChangeAt >= quietMs) {
      return { recording, reachedQuiet: true };
    }

    if (signaledAt === null && options.stopWhen?.(recording) === true) {
      signaledAt = Date.now();
    }

    if (signaledAt !== null && Date.now() - signaledAt >= settleAfterSignalMs) {
      return { recording, reachedQuiet: true };
    }

    if (Date.now() - startedAt > timeoutMs) {
      return { recording, reachedQuiet: false };
    }

    await page.waitForTimeout(250);
  }
}
