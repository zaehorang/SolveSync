import { afterEach, describe, expect, it, vi } from "vitest";

import { startAcceptedEventController } from "./acceptedEventController";
import { createPlatformAdapters } from "./platforms";
import {
  acceptedChildListMutation,
  attributeMutation,
  childListMutation,
  mutationElement,
  mutationTextNode,
  createFakeObserver,
  element,
  makeDetectionDocument,
  programmersCharacterDataMutation,
  programmersModal,
  type FakeElement,
  type FakeProgrammersModal
} from "./__fixtures__/dom";

describe("Accepted event controller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delivers the first Programmers snapshot at once and ignores the rest of the window", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "accepted code\n",
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(harness.observer.observe).toHaveBeenCalledWith(harness.documentRef.body, {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    // timer를 전혀 돌리지 않아도 이미 전달되어 있어야 한다.
    expect(harness.sentMessages).toHaveLength(1);

    harness.codeEditor.value = "edited but not accepted\n";
    vi.advanceTimersByTime(500);
    harness.observer.emit([acceptedChildListMutation("정답입니다!")]);
    vi.advanceTimersByTime(200);

    // 창 안의 후속 signal은 두 번째 event를 만들지 않는다.
    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        lessonId: "120804",
        code: "accepted code\n",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    });
  });

  it("detects a reused hidden Programmers modal when it becomes visible exactly once", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first accepted code\n",
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(harness.observer.observe).toHaveBeenCalledWith(harness.modal, {
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "class", "style"]
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.codeEditor.value = "edited after Accepted\n";
    harness.observer.emit([attributeMutation(harness.modal, "class")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        code: "first accepted code\n"
      }
    });
  });

  it("coalesces text and visibility signals for one Programmers presentation episode", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness();

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([
      acceptedChildListMutation("정답입니다!"),
      attributeMutation(harness.modal, "aria-hidden")
    ]);
    vi.advanceTimersByTime(700);

    harness.observer.emit([acceptedChildListMutation("정답입니다!")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(1);
  });

  it("re-arms after close and ignores a visible Wrong Answer before a second Accepted", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first accepted code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    harness.modal.setAttribute("aria-hidden", "true");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.modal.setTitle("오답입니다!");
    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);
    expect(harness.sentMessages).toHaveLength(1);

    harness.modal.setAttribute("aria-hidden", "true");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.modal.setTitle("정답입니다!");
    harness.codeEditor.value = "second accepted code\n";
    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(2);
    expect(harness.sentMessages[1]).toMatchObject({
      payload: {
        code: "second accepted code\n"
      }
    });
  });

  it("re-arms when a visible Accepted title becomes non-Accepted", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness();

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    harness.modal.setTitle("오답입니다!");
    harness.observer.emit([
      programmersCharacterDataMutation(
        harness.modal,
        "오답입니다!",
        "정답입니다!"
      )
    ]);
    harness.modal.setTitle("정답입니다!");
    harness.observer.emit([
      programmersCharacterDataMutation(
        harness.modal,
        "정답입니다!",
        "오답입니다!"
      )
    ]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(2);
  });

  it("delivers Programmers events for both routes across an SPA move", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first route code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.setPageUrl(
      "https://school.programmers.co.kr/learn/courses/30/lessons/120820"
    );
    harness.codeEditor.value = "second route code\n";
    harness.observer.emit([acceptedChildListMutation("정답입니다!")]);
    vi.advanceTimersByTime(700);

    // 앞 route에서 관찰한 Accepted도 그 route의 snapshot으로 전달된다. 미뤘다가
    // 버리면 사용자가 푼 문제가 조용히 사라진다.
    expect(harness.sentMessages).toHaveLength(2);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        lessonId: "120804",
        code: "first route code\n"
      }
    });
    expect(harness.sentMessages[1]).toMatchObject({
      payload: {
        lessonId: "120820",
        pageUrl: harness.pageUrl(),
        code: "second route code\n"
      }
    });
  });

  it("detects an attribute-only Accepted on a new Programmers route using the same modal root", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "first route code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.modal.setAttribute("aria-hidden", "true");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);

    harness.setPageUrl(
      "https://school.programmers.co.kr/learn/courses/30/lessons/120820"
    );
    harness.codeEditor.value = "second route code\n";
    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(2);
    expect(harness.sentMessages[1]).toMatchObject({
      payload: {
        lessonId: "120820",
        pageUrl: harness.pageUrl(),
        code: "second route code\n"
      }
    });
  });

  it("keeps a stale visible Accepted as the new route baseline without a fresh signal", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness({
      code: "old route code\n"
    });

    harness.modal.removeAttribute("aria-hidden");
    harness.observer.emit([attributeMutation(harness.modal, "aria-hidden")]);
    harness.setPageUrl(
      "https://school.programmers.co.kr/learn/courses/30/lessons/120820"
    );
    harness.observer.emit([
      childListMutation(mutationElement([]), [mutationTextNode("새 문제")])
    ]);
    harness.observer.emit([attributeMutation(harness.modal, "class")]);
    vi.advanceTimersByTime(700);

    // 새 route에서는 fresh 신호가 없었다. 앞 route의 event 하나만 남는다.
    expect(harness.sentMessages).toHaveLength(1);
    expect(harness.sentMessages[0]).toMatchObject({
      payload: {
        lessonId: "120804",
        code: "old route code\n"
      }
    });
  });

  it("rebinds a replacement modal root and treats its current state as baseline", () => {
    vi.useFakeTimers();
    const harness = createProgrammersControllerHarness();
    const oldRoot = harness.modal;
    const replacementRoot = programmersModal("정답입니다!");

    harness.replaceModal(replacementRoot);
    harness.observer.emit([
      childListMutation(mutationElement([]), [mutationElement([])])
    ]);
    harness.observer.emit([attributeMutation(oldRoot, "aria-hidden")]);
    vi.advanceTimersByTime(700);

    expect(harness.sentMessages).toHaveLength(0);
    expect(harness.observer.disconnect).toHaveBeenCalledTimes(2);
    expect(harness.observer.observe).toHaveBeenCalledWith(replacementRoot, {
      attributes: true,
      attributeFilter: ["aria-hidden", "hidden", "class", "style"]
    });
  });

  it("emits one event per real Accepted window and ignores later non-Accepted UI changes", () => {
    vi.useFakeTimers();
    const documentRef = makeDetectionDocument({});
    const sentMessages: unknown[] = [];
    const observer = createFakeObserver();

    startAcceptedEventController({
      documentRef,
      getCurrentUrl: () => "https://leetcode.com/problems/two-sum/",
      sendAcceptedMessage: (message) => sentMessages.push(message),
      createObserver: observer.factory,
      now: () => "2026-01-01T00:00:00.000Z"
    });

    observer.emit([acceptedChildListMutation("Accepted")]);
    vi.advanceTimersByTime(700);
    observer.emit([
      childListMutation(
        mutationElement([mutationTextNode("Accepted")]),
        [mutationTextNode("Wrong Answer")]
      )
    ]);
    vi.advanceTimersByTime(700);
    expect(sentMessages).toHaveLength(1);

    observer.emit([acceptedChildListMutation("Accepted")]);
    vi.advanceTimersByTime(700);
    expect(sentMessages).toHaveLength(2);
  });

  it("delivers one event per route across an SPA move", () => {
    vi.useFakeTimers();
    let pageUrl = "https://leetcode.com/problems/two-sum/";
    const documentRef = makeDetectionDocument({});
    const sentMessages: unknown[] = [];
    const observer = createFakeObserver();

    startAcceptedEventController({
      documentRef,
      getCurrentUrl: () => pageUrl,
      sendAcceptedMessage: (message) => sentMessages.push(message),
      createObserver: observer.factory,
      now: () => "2026-01-01T00:00:00.000Z"
    });

    observer.emit([acceptedChildListMutation("Accepted")]);
    pageUrl = "https://leetcode.com/problems/valid-parentheses/";
    observer.emit([acceptedChildListMutation("Accepted")]);
    vi.advanceTimersByTime(700);
    expect(sentMessages).toEqual([
      {
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "leetcode",
          titleSlug: "two-sum",
          pageUrl: "https://leetcode.com/problems/two-sum/",
          detectedAt: "2026-01-01T00:00:00.000Z"
        }
      },
      {
        type: "content:accepted_detected",
        payload: {
          codingPlatform: "leetcode",
          titleSlug: "valid-parentheses",
          pageUrl,
          detectedAt: "2026-01-01T00:00:00.000Z"
        }
      }
    ]);
  });

  it("keeps an event captured before the user leaves the route", () => {
    vi.useFakeTimers();
    let pageUrl = "https://leetcode.com/problems/two-sum/";
    const observer = createFakeObserver();
    const sendAcceptedMessage = vi.fn();

    startAcceptedEventController({
      documentRef: makeDetectionDocument({}),
      getCurrentUrl: () => pageUrl,
      sendAcceptedMessage,
      createObserver: observer.factory
    });

    observer.emit([acceptedChildListMutation("Accepted")]);
    pageUrl = "https://leetcode.com/problems/valid-parentheses/";
    vi.advanceTimersByTime(700);

    // 감지 시점에 전달했으므로 사용자가 곧바로 이동해도 남는다.
    expect(sendAcceptedMessage).toHaveBeenCalledTimes(1);
    expect(sendAcceptedMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ titleSlug: "two-sum" })
      })
    );
  });
});

function createProgrammersControllerHarness(
  options: {
    code?: string;
    now?: () => string;
    pageUrl?: string;
  } = {}
) {
  let pageUrl =
    options.pageUrl ??
    "https://school.programmers.co.kr/learn/courses/30/lessons/120804";
  const codeEditor = element({ value: options.code ?? "accepted code\n" });
  const modal = programmersModal("정답입니다!", { "aria-hidden": "true" });
  const nodes: Record<string, FakeElement | null> = {
    "#modal-dialog": modal,
    "textarea#code": codeEditor,
    'meta[property="og:title"]': element({
      content: "코딩테스트 연습 - 두 수의 곱 구하기 | 프로그래머스"
    }),
    'select[name="language"]': element({
      value: "swift",
      selectedOption: element({ textContent: "Swift" })
    })
  };
  const documentRef = makeDetectionDocument(nodes);
  const sentMessages: unknown[] = [];
  const observer = createFakeObserver();

  startAcceptedEventController({
    documentRef,
    getCurrentUrl: () => pageUrl,
    sendAcceptedMessage: (message) => sentMessages.push(message),
    createObserver: observer.factory,
    now: options.now
  });

  return {
    codeEditor,
    documentRef,
    modal,
    observer,
    sentMessages,
    pageUrl: () => pageUrl,
    replaceModal(nextModal: FakeProgrammersModal) {
      nodes["#modal-dialog"] = nextModal;
    },
    setPageUrl(nextPageUrl: string) {
      pageUrl = nextPageUrl;
    }
  };
}
