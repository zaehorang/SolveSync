/** 세 Coding Platform Adapter가 모두 지켜야 하는 계약.
 *
 * `docs/platforms/README.md`의 "Accepted event 공통 계약"이 지금까지 산문으로만
 * 있었다. 산문은 플랫폼마다 어긋나도 아무도 모른다. 같은 테스트를 세 구현체에
 * 돌려 처음으로 대칭 검증한다.
 *
 * 플랫폼 고유 동작은 각 구현체 테스트가 맡는다. 여기에는 셋 모두에 해당하는
 * 것만 둔다.
 */
import { describe, expect, it } from "vitest";

import { elementNode, mutationRecord, textNode } from "../__fixtures__/mutation";
import { createLeetCodeAdapter } from "./leetcode";
import { createProgrammersAdapter } from "./programmers";
import { createSweaAdapter } from "./swea";
import type { PlatformAdapter, PlatformObservationDocument } from "./types";

interface FakeNode {
  [key: string]: unknown;
}

interface Scenario {
  readonly adapter: PlatformAdapter;
  readonly url: string;
  readonly unsupportedUrl: string;
  /** 이 플랫폼의 문제 page를 만든다. */
  createDocument(): { doc: PlatformObservationDocument; perturb(): void };
  /** fresh Accepted 전이를 만든다. */
  accept(state: unknown): readonly MutationRecord[];
  /** 실패 제출을 만든다. */
  reject(state: unknown): readonly MutationRecord[];
  /** Accepted와 무관한 변화. */
  unrelated(): readonly MutationRecord[];
}

const CONTEXT = { pageUrl: "https://example.test/", now: () => "2026-01-01T00:00:00.000Z" };

function textMutation(text: string): MutationRecord {
  return mutationRecord({
    target: elementNode([]),
    addedNodes: [elementNode([textNode(text)])]
  });
}

function fakeDocument(
  nodes: Record<string, FakeNode | null>,
  title = ""
): PlatformObservationDocument {
  const root = {} as HTMLElement;

  return {
    title,
    body: root,
    documentElement: root,
    querySelector: (selector: string) => (nodes[selector] ?? null) as Element | null
  } as unknown as PlatformObservationDocument;
}

function modalNode(title: string, hidden: boolean) {
  const attributes = new Map<string, string>(hidden ? [["aria-hidden", "true"]] : []);
  const titleNode = { textContent: title };

  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    querySelector: (selector: string) =>
      selector === ".modal-title" ? (titleNode as Element) : null,
    setTitle: (next: string) => {
      titleNode.textContent = next;
    },
    ownerDocument: null
  };
}

const scenarios: Record<string, Scenario> = {
  leetcode: {
    adapter: createLeetCodeAdapter(),
    url: "https://leetcode.com/problems/two-sum/",
    unsupportedUrl: "https://leetcode.com/contest/weekly-400/",
    createDocument: () => ({ doc: fakeDocument({}), perturb: () => undefined }),
    accept: () => [textMutation("Accepted")],
    reject: () => [textMutation("Wrong Answer")],
    unrelated: () => [textMutation("Acceptance Rate 53.2%")]
  },
  swea: {
    adapter: createSweaAdapter(),
    url: "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do",
    unsupportedUrl: "https://swexpertacademy.com/main/talk/talkList.do",
    createDocument: () => {
      const title = { textContent: "1234. 숫자 카드" };
      const nodes = {
        "input#contestProbId": { value: "AV13zZ7KAAACFAYh" },
        "h3.problem_title": title,
        "select#sel_lang": { value: "Y" }
      };

      return {
        doc: fakeDocument(nodes),
        perturb: () => {
          title.textContent = "9999. 다른 문제";
        }
      };
    },
    accept: () => [textMutation("축하합니다.  Pass입니다.")],
    reject: () => [textMutation("채점용 input 파일로 채점한 결과 fail 입니다.")],
    unrelated: () => [textMutation("제출 이력")]
  },
  programmers: {
    adapter: createProgrammersAdapter({
      readComputedStyle: () => ({ display: "block", visibility: "visible" })
    }),
    url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
    unsupportedUrl: "https://school.programmers.co.kr/learn/courses/30",
    createDocument: () => {
      const modal = modalNode("정답입니다!", true);
      const meta = { content: "코딩테스트 연습 - 두 수의 곱 구하기 | 프로그래머스" };

      return {
        doc: Object.assign(
          fakeDocument({
            "#modal-dialog": modal,
            'meta[property="og:title"]': meta,
            "textarea#code": { value: "solution\n" }
          }),
          { __modal: modal }
        ),
        perturb: () => {
          meta.content = "코딩테스트 연습 - 다른 문제 | 프로그래머스";
        }
      };
    },
    accept: (state) => {
      const modal = (state as { __modal: ReturnType<typeof modalNode> }).__modal;
      modal.removeAttribute("aria-hidden");

      return [attributeRecord(modal)];
    },
    reject: (state) => {
      const modal = (state as { __modal: ReturnType<typeof modalNode> }).__modal;
      modal.setTitle("오답입니다!");
      modal.removeAttribute("aria-hidden");

      return [attributeRecord(modal)];
    },
    unrelated: () => [textMutation("채점 결과")]
  }
};

function attributeRecord(target: unknown): MutationRecord {
  return {
    type: "attributes",
    target: target as Node,
    attributeName: "aria-hidden",
    oldValue: null
  } as MutationRecord;
}

describe.each(Object.entries(scenarios))("Adapter 공통 계약: %s", (_name, scenario) => {
  function start() {
    const { doc, perturb } = scenario.createDocument();
    const route = scenario.adapter.resolveRoute(new URL(scenario.url), doc);

    if (route === null) {
      throw new Error("route를 확정하지 못했다.");
    }

    return { doc, perturb, route, observation: route.observe(doc, "startup") };
  }

  it("지원하지 않는 route에서는 route를 확정하지 않는다", () => {
    const { doc } = scenario.createDocument();

    expect(
      scenario.adapter.resolveRoute(new URL(scenario.unsupportedUrl), doc)
    ).toBeNull();
    expect(
      scenario.adapter.resolveRoute(new URL("https://example.com/problems/x/"), doc)
    ).toBeNull();
  });

  it("route key가 플랫폼 이름으로 시작한다", () => {
    expect(start().route.key.startsWith(`${scenario.adapter.platform}:`)).toBe(true);
  });

  it("Accepted와 무관한 mutation에서는 signal이 없다", () => {
    const { observation } = start();

    expect(observation.detect(scenario.unrelated(), CONTEXT)).toBeNull();
  });

  it("실패 제출에서는 signal이 없다", () => {
    const { doc, observation } = start();

    expect(observation.detect(scenario.reject(doc), CONTEXT)).toBeNull();
  });

  it("fresh Accepted 전이에서 signal을 정확히 한 번 만든다", () => {
    const { doc, observation } = start();

    expect(observation.detect(scenario.accept(doc), CONTEXT)).not.toBeNull();
    // 같은 상태가 유지되는 후속 mutation은 새 signal이 아니다.
    expect(observation.detect(scenario.unrelated(), CONTEXT)).toBeNull();
  });

  it("조립이 DOM을 다시 읽지 않는다", async () => {
    const { doc, perturb, observation } = start();
    const signal = observation.detect(scenario.accept(doc), CONTEXT);

    expect(signal).not.toBeNull();

    // signal 확정 이후 page가 바뀌어도 payload는 그 시점의 것이어야 한다
    // (ADR 0034).
    const before = JSON.stringify(await Promise.resolve(signal?.toMessage()));
    perturb();
    const after = JSON.stringify(await Promise.resolve(signal?.toMessage()));

    expect(after).toBe(before);
  });

  it("payload의 codingPlatform이 adapter와 일치한다", async () => {
    const { doc, observation } = start();
    const signal = observation.detect(scenario.accept(doc), CONTEXT);
    const message = await Promise.resolve(signal?.toMessage());

    expect(message?.payload.codingPlatform).toBe(scenario.adapter.platform);
    expect(message?.type).toBe("content:accepted_detected");
  });

  it("관찰 대상이 최소 하나 있고 document root를 포함한다", () => {
    const { doc, observation } = start();

    expect(observation.targets().length).toBeGreaterThan(0);
    expect(observation.targets()[0]?.node).toBe(doc.body);
  });
});
