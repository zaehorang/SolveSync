import { describe, expect, it, vi } from "vitest";

import {
  createContentRouteKey,
  extractSweaProblemTitle,
  extractSweaRawLanguage,
  resolveContentPage,
  startAcceptedDetectionController
} from "./acceptedDetectionController";
import { isSweaAcceptedResultText, mutationListHasAccepted } from "./detector";
import { requestSweaEditorCode } from "./sweaBridgeClient";
import { readSweaEditorCode } from "./sweaEditorBridge";
import {
  SWEA_BRIDGE_REQUEST_SOURCE,
  SWEA_BRIDGE_RESPONSE_SOURCE
} from "./sweaBridgeProtocol";

const SOLVING_URL = "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do";
const ACCEPTED_TEXT = "축하합니다. Pass입니다.";
const FAILED_TEXT = "채점용 input 파일로 채점한 결과 fail 입니다.";

describe("SWEA Accepted text", () => {
  it("Pass 문구만 Accepted로 판정한다", () => {
    expect(isSweaAcceptedResultText(ACCEPTED_TEXT)).toBe(true);
    expect(isSweaAcceptedResultText(`  ${ACCEPTED_TEXT}  `)).toBe(true);
    expect(isSweaAcceptedResultText(`${ACCEPTED_TEXT} 실행 시간 0.1초`)).toBe(true);
  });

  it("실패 문구와 부분 일치를 Accepted로 판정하지 않는다", () => {
    // 실패 계열 문구가 Accepted 접두사와 겹치면 잘못된 commit이 생긴다.
    expect(isSweaAcceptedResultText(FAILED_TEXT)).toBe(false);
    expect(isSweaAcceptedResultText(`${FAILED_TEXT} 제한시간 초과`)).toBe(false);
    expect(isSweaAcceptedResultText("축하합니다")).toBe(false);
    expect(isSweaAcceptedResultText("Pass입니다.")).toBe(false);
    expect(isSweaAcceptedResultText("")).toBe(false);
  });

  it("새로 추가된 alert layer node에서 Accepted를 감지한다", () => {
    const layer = elementNode(
      [elementNode([textNode(ACCEPTED_TEXT)], { tagName: "p" })],
      { tagName: "div" }
    );

    expect(
      mutationListHasAccepted([childListMutation([layer])], "swea")
    ).toBe(true);
    expect(
      mutationListHasAccepted(
        [childListMutation([elementNode([textNode(FAILED_TEXT)])])],
        "swea"
      )
    ).toBe(false);
  });
});

describe("SWEA page identity", () => {
  it("route key를 URL이 아니라 #contestProbId에서 확정한다", () => {
    const page = resolveContentPage(new URL(SOLVING_URL), sweaDocument());

    expect(page).toEqual({ platform: "swea", contestProbId: "AV13zZ7KAAACFAYh" });
    expect(createContentRouteKey(page)).toBe("swea:AV13zZ7KAAACFAYh");
  });

  it("#contestProbId가 없으면 unsupported page다", () => {
    // 어떤 문제인지 모르는 상태에서는 event를 만들지 않는다.
    expect(
      resolveContentPage(new URL(SOLVING_URL), sweaDocument({ contestProbId: "" }))
    ).toEqual({ platform: "unsupported" });
    expect(
      resolveContentPage(new URL(SOLVING_URL), { querySelector: () => null })
    ).toEqual({ platform: "unsupported" });
  });

  it("풀이 페이지가 아닌 SWEA 경로는 unsupported다", () => {
    expect(
      resolveContentPage(
        new URL("https://swexpertacademy.com/main/talk/talkList.do"),
        sweaDocument()
      )
    ).toEqual({ platform: "unsupported" });
  });
});

describe("SWEA 문제 metadata 추출", () => {
  it("`{번호}. {제목}`을 번호와 제목으로 나눈다", () => {
    expect(extractSweaProblemTitle(sweaDocument())).toEqual({
      problemNumber: "1234",
      problemTitle: "숫자 카드"
    });
  });

  it("번호가 없는 제목은 전체를 제목으로 둔다", () => {
    expect(
      extractSweaProblemTitle(sweaDocument({ problemTitle: "숫자 카드" }))
    ).toEqual({ problemNumber: "", problemTitle: "숫자 카드" });
  });

  it("language는 option value code를 쓴다", () => {
    expect(extractSweaRawLanguage(sweaDocument())).toBe("Y");
  });

  it("value가 없으면 option text에서 compiler version을 떼어낸다", () => {
    // `Python 3 (PyPy 7.3.9)`를 그대로 쓰면 SWEA가 runtime을 올릴 때 깨진다.
    expect(
      extractSweaRawLanguage(
        sweaDocument({ languageValue: "", languageText: "Python 3 (PyPy 7.3.9)" })
      )
    ).toBe("Python 3");
  });

  it("language control이 없으면 빈 문자열이다", () => {
    expect(extractSweaRawLanguage({ querySelector: () => null })).toBe("");
  });
});

describe("SWEA editor bridge", () => {
  it("CodeMirror instance의 전체 code를 읽는다", () => {
    // 가상 스크롤 때문에 rendered line DOM은 일부만 갖는다. getValue()는 전체다.
    const code = ["line 1", "line 2", "line 3"].join("\n");

    expect(readSweaEditorCode(codeMirrorDocument(code))).toBe(code);
  });

  it("instance가 없거나 비어 있으면 null이다", () => {
    expect(readSweaEditorCode(codeMirrorDocument(""))).toBeNull();
    expect(readSweaEditorCode({ querySelectorAll: () => [] as never })).toBeNull();
  });

  it("요청한 nonce의 응답만 사용한다", async () => {
    const bridge = fakeBridgeWindow();
    const pending = requestSweaEditorCode({
      windowRef: bridge.windowRef,
      createNonce: () => "nonce-1"
    });

    bridge.respond({ nonce: "other-nonce", code: "wrong code" });
    bridge.respond({ nonce: "nonce-1", code: "right code" });

    await expect(pending).resolves.toBe("right code");
  });

  it("다른 origin이나 다른 source의 message를 무시한다", async () => {
    const bridge = fakeBridgeWindow();
    const pending = requestSweaEditorCode({
      windowRef: bridge.windowRef,
      createNonce: () => "nonce-1",
      timeoutMs: 5
    });

    bridge.respond({ nonce: "nonce-1", code: "evil", origin: "https://evil.example" });
    bridge.respond({ nonce: "nonce-1", code: "evil", source: "other-extension" });
    bridge.respond({ nonce: "nonce-1", code: "evil", eventSource: {} });

    await expect(pending).resolves.toBeNull();
  });

  it("응답이 없으면 timeout 후 null이다", async () => {
    const bridge = fakeBridgeWindow();

    await expect(
      requestSweaEditorCode({
        windowRef: bridge.windowRef,
        createNonce: () => "nonce-1",
        timeoutMs: 5
      })
    ).resolves.toBeNull();
    expect(bridge.posted).toHaveLength(1);
    expect(bridge.posted[0]).toEqual({
      source: SWEA_BRIDGE_REQUEST_SOURCE,
      nonce: "nonce-1"
    });
  });
});

describe("SWEA detection controller", () => {
  it("Accepted 직후 metadata를 읽고 bridge code로 event를 만든다", async () => {
    const harness = createSweaControllerHarness({ code: "print(1)\n" });

    harness.observer.emit([childListMutation([elementNode([textNode(ACCEPTED_TEXT)])])]);
    // metadata는 신호 시점에 확정된다. 이후 DOM이 바뀌어도 event에 섞이지 않는다.
    harness.setProblemTitle("9999. 다른 문제");
    await harness.flush();

    expect(harness.sentMessages).toEqual([
      {
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "swea",
          contestProbId: "AV13zZ7KAAACFAYh",
          problemNumber: "1234",
          problemTitle: "숫자 카드",
          language: "Y",
          code: "print(1)\n",
          pageUrl: SOLVING_URL,
          detectedAt: "2026-01-02T00:00:00.000Z"
        }
      }
    ]);
  });

  it("coalescing 창이 닫히기 전에 전달한다", async () => {
    // Accepted layer의 `확인`을 누르면 page가 사라진다. 창이 닫힐 때까지
    // 들고 있으면 event가 통째로 사라져 sync가 시작조차 하지 못한다.
    const harness = createSweaControllerHarness({ code: "print(1)\n" });

    harness.observer.emit([childListMutation([elementNode([textNode(ACCEPTED_TEXT)])])]);
    await harness.settleBridge();

    expect(harness.sentMessages).toHaveLength(1);
    // 창은 여전히 열려 있다. 전달이 창을 기다리지 않았다는 뜻이다.
    expect(harness.pendingTimerCount()).toBe(1);
  });

  it("bridge 응답이 없으면 empty code로 보내 background가 실패로 기록하게 한다", async () => {
    const harness = createSweaControllerHarness({ code: null });

    harness.observer.emit([childListMutation([elementNode([textNode(ACCEPTED_TEXT)])])]);
    await harness.flush();

    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: { code: "" }
    });
  });

  it("bridge 요청이 reject해도 empty code event를 만든다", async () => {
    const harness = createSweaControllerHarness({ rejectBridge: true });

    harness.observer.emit([childListMutation([elementNode([textNode(ACCEPTED_TEXT)])])]);
    await harness.flush();

    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({ payload: { code: "" } });
  });

  it("실패 제출과 무관한 mutation은 event를 만들지 않는다", async () => {
    const harness = createSweaControllerHarness();

    harness.observer.emit([childListMutation([elementNode([textNode(FAILED_TEXT)])])]);
    harness.observer.emit([childListMutation([elementNode([textNode("임시 저장되었습니다.")])])]);
    await harness.flush();

    expect(harness.sentMessages).toEqual([]);
  });

  it("같은 burst의 여러 Accepted 신호를 event 하나로 합친다", async () => {
    const harness = createSweaControllerHarness();

    harness.observer.emit([childListMutation([elementNode([textNode(ACCEPTED_TEXT)])])]);
    harness.observer.emit([childListMutation([elementNode([textNode(ACCEPTED_TEXT)])])]);
    await harness.flush();

    expect(harness.sentMessages).toHaveLength(1);
  });

  it("bridge를 기다리는 동안 다른 문제로 바뀌면 event를 버린다", async () => {
    // URL이 같아도 contestProbId가 바뀌면 다른 route다 (ADR 0036).
    const harness = createSweaControllerHarness();

    harness.observer.emit([childListMutation([elementNode([textNode(ACCEPTED_TEXT)])])]);
    harness.setContestProbId("AV99999999999999");
    await harness.flush();

    expect(harness.sentMessages).toEqual([]);
  });
});

interface FakeNode {
  nodeType: number;
  textContent: string | null;
  childNodes?: FakeNode[];
  parentElement?: FakeNode | null;
  nodeName?: string;
  tagName?: string;
  getAttribute?(name: string): string | null;
}

function textNode(textContent: string): FakeNode {
  return { nodeType: 3, textContent, parentElement: null };
}

function elementNode(
  childNodes: FakeNode[],
  options: { tagName?: string } = {}
): FakeNode {
  const tagName = (options.tagName ?? "div").toUpperCase();
  const node: FakeNode = {
    nodeType: 1,
    textContent: childNodes.map((child) => child.textContent ?? "").join(""),
    childNodes,
    parentElement: null,
    nodeName: tagName,
    tagName,
    getAttribute: () => null
  };

  for (const child of childNodes) {
    child.parentElement = node;
  }

  return node;
}

function childListMutation(addedNodes: FakeNode[]): MutationRecord {
  return {
    type: "childList",
    target: elementNode([]) as unknown as Node,
    addedNodes: addedNodes as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    oldValue: null
  } as unknown as MutationRecord;
}

function sweaDocument(
  overrides: {
    contestProbId?: string;
    problemTitle?: string;
    languageValue?: string;
    languageText?: string;
  } = {}
): Pick<Document, "querySelector"> {
  const nodes: Record<string, unknown> = {
    "input#contestProbId": {
      value: overrides.contestProbId ?? "AV13zZ7KAAACFAYh"
    },
    "h3.problem_title": {
      textContent: overrides.problemTitle ?? "1234. 숫자 카드"
    },
    "select#sel_lang": {
      value: overrides.languageValue ?? "Y",
      selectedOptions: [{ textContent: overrides.languageText ?? "Python 3 (PyPy 7.3.9)" }]
    }
  };

  return {
    querySelector: (selector: string) => (nodes[selector] ?? null) as Element | null
  } as Pick<Document, "querySelector">;
}

function codeMirrorDocument(code: string): Pick<Document, "querySelectorAll"> {
  const host = { CodeMirror: { getValue: () => code } };

  return {
    querySelectorAll: () => [host] as unknown as NodeListOf<Element>
  } as Pick<Document, "querySelectorAll">;
}

function fakeBridgeWindow(): {
  windowRef: Parameters<typeof requestSweaEditorCode>[0]["windowRef"];
  posted: unknown[];
  respond(input: {
    nonce: string;
    code: string | null;
    origin?: string;
    source?: string;
    eventSource?: unknown;
  }): void;
} {
  const origin = "https://swexpertacademy.com";
  const listeners: Array<(event: MessageEvent) => void> = [];
  const posted: unknown[] = [];
  const windowRef = {
    location: { origin },
    postMessage(message: unknown) {
      posted.push(message);
    },
    addEventListener(_type: "message", listener: (event: MessageEvent) => void) {
      listeners.push(listener);
    },
    removeEventListener(_type: "message", listener: (event: MessageEvent) => void) {
      const index = listeners.indexOf(listener);

      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  };

  return {
    windowRef,
    posted,
    respond(input) {
      const event = {
        source: "eventSource" in input ? input.eventSource : windowRef,
        origin: input.origin ?? origin,
        data: {
          source: input.source ?? SWEA_BRIDGE_RESPONSE_SOURCE,
          nonce: input.nonce,
          code: input.code
        }
      } as unknown as MessageEvent;

      for (const listener of [...listeners]) {
        listener(event);
      }
    }
  };
}

function createSweaControllerHarness(
  options: { code?: string | null; rejectBridge?: boolean } = {}
): {
  observer: { emit(mutations: MutationRecord[]): void };
  sentMessages: unknown[];
  setContestProbId(value: string): void;
  setProblemTitle(value: string): void;
  flush(): Promise<void>;
  settleBridge(): Promise<void>;
  pendingTimerCount(): number;
} {
  const state = {
    contestProbId: "AV13zZ7KAAACFAYh",
    problemTitle: "1234. 숫자 카드"
  };
  const root = elementNode([]) as unknown as HTMLElement;
  const documentRef = {
    title: "SW Expert Academy",
    body: root,
    documentElement: root,
    querySelector: (selector: string) =>
      sweaDocument({
        contestProbId: state.contestProbId,
        problemTitle: state.problemTitle
      }).querySelector(selector)
  } as unknown as Pick<
    Document,
    "body" | "documentElement" | "querySelector" | "title"
  >;
  const sentMessages: unknown[] = [];
  let callback: MutationCallback | null = null;
  const pendingFlushes: Array<() => void> = [];

  startAcceptedDetectionController({
    documentRef,
    getCurrentUrl: () => SOLVING_URL,
    sendAcceptedMessage: (message) => sentMessages.push(message),
    createObserver: (nextCallback) => {
      callback = nextCallback;

      return { observe: vi.fn(), disconnect: vi.fn() };
    },
    now: () => "2026-01-02T00:00:00.000Z",
    scheduler: {
      setTimeout(run) {
        pendingFlushes.push(run);

        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout() {
        pendingFlushes.length = 0;
      }
    },
    requestSweaEditorCode: () =>
      options.rejectBridge === true
        ? Promise.reject(new Error("bridge unavailable"))
        : Promise.resolve(options.code === undefined ? "code\n" : options.code)
  });

  return {
    observer: {
      emit(mutations) {
        if (callback === null) {
          throw new Error("Observer callback was not registered");
        }

        callback(mutations, {} as MutationObserver);
      }
    },
    sentMessages,
    setContestProbId(value) {
      state.contestProbId = value;
    },
    setProblemTitle(value) {
      state.problemTitle = value;
    },
    async flush() {
      for (const run of pendingFlushes.splice(0)) {
        run();
      }

      // bridge promise chain이 끝나기를 기다린다.
      await Promise.resolve();
      await Promise.resolve();
    },
    /** timer를 전혀 돌리지 않고 bridge 응답만 기다린다. page가 곧 사라지는
     * 상황을 흉내 낸다. */
    async settleBridge() {
      await Promise.resolve();
      await Promise.resolve();
    },
    pendingTimerCount() {
      return pendingFlushes.length;
    }
  };
}
