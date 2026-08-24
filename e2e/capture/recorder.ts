/** 제출 순간의 DOM 변화를 page 안에서 기록한다.
 *
 * **제출 전에 무장해야 한다.** 제출 후에 걸면 Accepted 순간의 mutation을
 * 놓치고, 그 mutation이 "새 node 추가인가 속성 변경인가"를 판정하는 유일한
 * 근거다.
 *
 * `alert`와 `confirm`도 함께 가로챈다. 네이티브 dialog가 뜨면 브라우저
 * 자동화 세션이 통째로 멈춘다. 기록만 하고 그대로 통과시킨다.
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
  await page.addInitScript(
    ({ key, watchSelector, watchTitleSelector, maxHtmlLength }) => {
      const limit = maxHtmlLength ?? 4000;
      const store = { batches: [] as unknown[], dialogs: [] as unknown[] };
      (window as unknown as Record<string, unknown>)[key] = store;

      const describe = (node: Node): unknown => {
        if (node.nodeType === Node.TEXT_NODE) {
          return { kind: "text", text: node.textContent ?? "" };
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          return {
            kind: "element",
            name: element.tagName.toLowerCase(),
            html: element.outerHTML.slice(0, limit),
            text: (element.textContent ?? "").slice(0, limit)
          };
        }

        return { kind: "other" };
      };

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

      new MutationObserver((mutations) => {
        const watchedAfter = readWatched();

        store.batches.push({
          index: store.batches.length,
          at: Date.now(),
          watchedBefore,
          watchedAfter,
          mutations: mutations.map((mutation) => ({
            type: mutation.type,
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue,
            target: describe(mutation.target),
            addedNodes: Array.from(mutation.addedNodes, describe),
            removedNodes: Array.from(mutation.removedNodes, describe)
          }))
        });

        watchedBefore = watchedAfter;
      }).observe(document.documentElement, {
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

export async function readRecording(page: Page): Promise<Recording> {
  return (await page.evaluate((key) => {
    const store = (window as unknown as Record<string, unknown>)[key] as
      | { batches: unknown[]; dialogs: unknown[] }
      | undefined;

    return { batches: store?.batches ?? [], dialogs: store?.dialogs ?? [] };
  }, GLOBAL_KEY)) as Recording;
}

/** 변화가 멎을 때까지 기다린다.
 *
 * 제출 결과는 채점 시간만큼 늦게 오고 언제 끝나는지 page가 알려주지 않는다.
 * batch가 한동안 늘지 않으면 끝난 것으로 본다. */
export async function waitForQuiet(
  page: Page,
  options: { minBatches?: number; quietMs?: number; timeoutMs?: number } = {}
): Promise<Recording> {
  const minBatches = options.minBatches ?? 1;
  const quietMs = options.quietMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const startedAt = Date.now();
  let lastCount = -1;
  let lastChangeAt = Date.now();

  for (;;) {
    const recording = await readRecording(page);

    if (recording.batches.length !== lastCount) {
      lastCount = recording.batches.length;
      lastChangeAt = Date.now();
    }

    if (lastCount >= minBatches && Date.now() - lastChangeAt >= quietMs) {
      return recording;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `변화가 멎지 않았다. ${timeoutMs}ms 동안 batch ${lastCount}개를 봤다.`
      );
    }

    await page.waitForTimeout(250);
  }
}
