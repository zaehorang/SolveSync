# Issue #4 구현 단순화 Follow-up

> **작성 기준일**: 2026-08-04
>
> **대상 PR**: https://github.com/zaehorang/SolveSync/pull/5
>
> **상태**: 구현 후 독립 리뷰에서 확인한 후속 개선 후보. 제품 계약의 source of truth가 아니다.

## 목적

Programmers Accepted visibility 수정의 핵심 correctness는 유지하면서, 두 observer 사이의 조율 때문에 늘어난 상태 API, 반복 테스트 setup과 일회성 문서를 줄인다.

이 문서는 리팩터링 실행을 위한 임시 계획이다. 리팩터링이 끝나면 이 문서와 `ISSUE_4_PROGRAMMERS_ACCEPTED_VISIBILITY_HANDOFF.md`를 저장소에서 제거하고, 최종 계약은 다음 문서에만 남긴다.

- `docs/ARCHITECTURE.md`
- `docs/adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md`
- `docs/adr/0034-fresh-accepted-transition-and-immutable-event.md`
- `docs/platforms/PROGRAMMERS.md`
- `docs/MANUAL_VALIDATION.md`

## 반드시 유지할 동작

- `inactive → acceptedVisible`에서만 Accepted event를 만든다.
- 같은 visible Accepted episode의 후속 mutation은 event를 추가하지 않는다.
- Modal close와 non-Accepted presentation은 event 없이 다음 Accepted를 re-arm한다.
- Fresh Accepted 확정 즉시 route, title, language와 code snapshot을 고정한다.
- 700ms fixed window는 첫 event를 보존하며 timer를 연장하거나 DOM을 다시 읽지 않는다.
- Route가 바뀌면 이전 pending event와 presentation state를 폐기한다.
- Root replacement는 새 root의 현재 상태를 baseline으로 저장한다.
- LeetCode detection 동작은 바꾸지 않는다.
- Body/document 전체의 attribute mutation을 관찰하지 않는다.

## 확인된 correctness gap

현재 controller는 presentation attribute callback에서 route 변경을 발견하면 tracker를 현재 DOM으로 먼저 reset한다. 새 route의 첫 신호가 같은 `#modal-dialog` root의 attribute-only hidden → visible Accepted라면, visible 상태가 baseline으로 흡수되어 event를 놓칠 수 있다.

리팩터링에는 다음 red test를 먼저 추가한다.

```text
old route: hidden or pending presentation
→ SPA route 변경
→ 같은 modal root가 attribute-only로 visible Accepted 전환
→ old pending event 0회
→ 새 lesson route/snapshot event 정확히 1회
```

Route reset과 현재 mutation 판정을 분리해, route가 바뀐 callback의 fresh attribute transition을 새 route event로 처리해야 한다. Startup 시 이미 visible인 Accepted baseline은 계속 emit하지 않는다.

## 권장 controller 구조

### 하나의 MutationObserver, 두 target

하나의 observer 인스턴스를 서로 다른 옵션으로 두 target에 등록한다.

```ts
observer.observe(documentRoot, {
  childList: true,
  characterData: true,
  characterDataOldValue: true,
  subtree: true
});

observer.observe(presentationRoot, {
  attributes: true,
  attributeFilter: ["aria-hidden", "hidden", "class", "style"]
});
```

`attributes: true`를 document subtree에 적용하지 않는다. Root가 바뀌면 observer를 disconnect한 뒤 document root와 새 presentation root를 다시 등록한다.

한 callback에서 text와 attribute records의 최종 DOM 상태를 함께 처리하면 다음 코드가 필요 없어져야 한다.

- 두 callback에서 반복하는 URL/page/route key parsing
- 별도 `presentationObserver`
- 두 observer callback 순서를 맞추기 위한 상태 승격/재무장 API
- `observedProgrammersPresentationRoot`와 tracker root의 이중 bookkeeping
- callback-order 전용 회귀 방어 로직

## 권장 tracker 경계

Tracker는 presentation state와 root identity를 소유하고 controller는 그 내부 상태를 조립하지 않는다.

목표 public shape는 다음 책임만 표현한다.

```ts
interface ProgrammersAcceptedPresentationTracker {
  reset(documentRef: Pick<Document, "querySelector">): Element | null;
  reconcile(
    documentRef: Pick<Document, "querySelector">,
    mutations: readonly MutationRecord[],
    context: {
      freshAcceptedText: boolean;
      routeChanged: boolean;
    }
  ): {
    root: Element | null;
    rootChanged: boolean;
    becameAcceptedVisible: boolean;
  };
}
```

정확한 이름과 반환 shape는 구현 중 더 작게 만들 수 있다. 다음 surface는 제거 후보로 본다.

- 사용되지 않는 `AcceptedDetectionControllerOptions.programmersPresentationTracker`
- 외부에서 사용하지 않는 exported state/transition type
- caller가 사용하지 않는 `becameInactive` 반환
- `getState`, `synchronizeCurrentState`, `rearmIfInactive`, `mutationsTouchPresentation` 조합
- 사용하지 않는 `attributeOldValue: true`

`rearmIfInactive`의 비대칭 의미는 반드시 tracker 내부에 보존한다. Non-Accepted content mutation은 `acceptedVisible → inactive`만 허용해야 하며, presentation attribute callback보다 먼저 실행됐다는 이유로 `inactive → acceptedVisible`을 선반영하면 안 된다.

## DOM 판정 범위 단순화

현재 확인된 계약은 다음과 같다.

```text
div#modal-dialog
└─ h4.modal-title
```

따라서 다음 범위로 좁히는 것을 우선 검토한다.

- Root는 `#modal-dialog` 하나만 사용한다.
- Accepted title은 root 내부 `.modal-title` 하나의 정확한 `정답입니다!`로 판정한다.
- Heading 7종 scan, 최대 24개 cap과 root 전체 `textContent` fallback은 제거한다.
- Visibility는 우선 root 자체의 `hidden`, `aria-hidden`, computed `display`와 `visibility`로 판정한다.

현재 구현은 모든 ancestor visibility를 판정하지만 observer는 root attribute만 관찰한다. 이 비대칭 지원은 제거한다. 실제 visibility owner가 ancestor로 확인되면 추측으로 ancestor scan만 추가하지 말고 해당 owner를 등록 observation target에 포함한다.

`hidden`, `aria-hidden`, `class`, `style` 중 어떤 signal을 줄일지는 실제 Chrome mutation sequence 확인 전에는 결정하지 않는다.

## 테스트 단순화

테스트 case의 핵심 의미는 유지하고 setup 중복을 줄인다.

### 유지할 tracker 테스트

- Hidden Accepted startup baseline은 event 0회
- Root hidden → visible Accepted는 event 1회
- 같은 callback final DOM 기준으로 visibility attributes를 1회 판정
- Visible → inactive → second Accepted re-arm
- Root replacement와 old-root record 제외

### 유지할 controller 테스트

- Hidden → visible에서 immutable snapshot 1회
- Text와 attribute signal 동시 발생도 message 1회
- Close, Wrong Answer와 second Accepted lifecycle
- Visible Accepted title의 non-Accepted → Accepted re-arm
- Root replacement와 SPA route reset
- 새 route의 attribute-only Accepted
- LeetCode 비회귀

### 축소할 테스트 중복

- Programmers controller 공통 setup은 `createProgrammersControllerHarness` 같은 local builder로 묶는다.
- Tracker의 `통과`, `채점 결과`, `합계` 전체 매트릭스는 detector 테스트가 소유한다. Tracker에는 대표 non-Accepted case 하나만 남긴다.
- Fake DOM helper는 한 테스트 파일 안의 반복부터 줄인다. 모든 detector/controller 테스트를 포괄하는 범용 fixture는 만들지 않는다.
- 단일 observer 구조로 바꾸면 두 observer callback 순서만을 위한 테스트는 제거한다.

## 문서 정리

- `ISSUE_4_PROGRAMMERS_ACCEPTED_VISIBILITY_HANDOFF.md`는 구현 전 repository/branch/cherry-pick 상태와 완료된 실행 계획을 포함하므로 최종 tree에서 제거한다.
- 이 follow-up 문서도 리팩터링 완료 후 제거한다.
- `docs/platforms/PROGRAMMERS.md`의 `handoff에서 확인` 표현은 날짜와 관찰 근거만 남기는 영구 계약 문구로 바꾼다.
- 플랫폼 문서 분리는 유지한다. Architecture와 manual validation에서 플랫폼 전용 계약을 이동한 경계는 유효하다.
- 플랫폼 문서의 자동 테스트 목록은 동작 계약을 반복하지 않도록 대표 test file과 검증 명령 중심으로 축약한다.
- `AGENTS.md` Git workflow 변경은 runtime fix와 독립적이므로 PR scope를 작게 유지하려면 별도 PR로 분리하는 것을 검토한다.

## 실행 순서

1. 새 route의 attribute-only Accepted red test를 추가한다.
2. Controller를 단일 observer/two-target 구조로 바꾼다.
3. Tracker를 reset/reconcile 중심 API로 축소한다.
4. `.modal-title`과 root visibility 계약으로 DOM 판정을 좁힌다.
5. Controller test harness를 도입하고 중복 case를 축소한다.
6. 일회성 handoff/follow-up 문서와 PR scope를 정리한다.
7. Source-of-truth 문서가 최종 구현과 일치하는지 확인한다.
8. 전체 자동 검증과 실제 Chrome 수동 검증을 실행한다.

## 검증 Gate

```bash
npm test -- src/content/detector.test.ts \
  src/content/programmersAcceptedPresentation.test.ts \
  src/content/index.test.ts
npm run typecheck
npm test
npm run build
```

실제 Chrome에서는 다음 순서를 확인한다.

1. 첫 Accepted
2. Modal close
3. Run
4. Wrong Answer
5. 두 번째 Accepted
6. SPA route 변경 후 attribute-only Accepted

각 단계에서 mutation sequence, visibility owner와 title 변경 순서만 기록한다. Solution code, token, cookie, session과 문제 설명 전문은 기록하지 않는다.

## 완료 조건

- 새 route의 attribute-only Accepted가 현재 route snapshot으로 정확히 한 번 전달된다.
- 기존 stale Accepted, Run, Wrong Answer, second Accepted와 LeetCode 테스트가 유지된다.
- Controller에서 observer callback 간 조정 상태가 제거된다.
- Tracker public API와 speculative DOM fallback이 축소된다.
- 테스트 setup 반복이 줄고 핵심 lifecycle case는 남는다.
- 일회성 plan 문서가 최종 source of truth와 중복되지 않는다.
- `npm run typecheck`, `npm test`, `npm run build`가 모두 성공한다.
- 실제 Chrome 검증 결과와 구현 가정이 일치한다.
