# Programmers 연동 계약

> **Description**: Programmers 전용 route, Accepted presentation, Accepted Editor Snapshot, 오류와 검증 계약을 정의한다. 공통 계약은 [Coding Platform 연동 계약](README.md)을 따른다.

이 문서는 **무엇을 어떻게 구현했는지**를 정의한다. 같은 연동을 그 기술을 모르는 사람이 검수할 수 있도록 사용자 관점 동작으로만 다시 쓴 것은 [동작 명세](../specs/README.md#programmers)에 있다. 둘이 어긋나면 구현이 무엇을 하는지는 이 문서가 맞고, 그것이 옳은 동작인지는 동작 명세의 열린 질문으로 올린다.

## Route와 Accepted presentation

- 지원 route는 `/learn/courses/{courseId}/lessons/{lessonId}`다. Accepted 후보마다 현재 URL에서 `courseId`와 `lessonId`를 다시 추출한다.
- Problem ID와 frontend ID는 `lessonId`를 사용한다. Difficulty는 제공되지 않는다. Difficulty가 없으면 Catalog에는
  `-`로 저장하되 Solution README에서는 의미 없는 Difficulty column을 표시하지 않는다.
- 정확한 `정답입니다!`를 Accepted text 신호로 사용한다.
- `통과`, `채점 결과`, `합계: 100.0 / 100.0`은 보조 결과 text일 뿐이며 단독 Accepted trigger로 사용하지 않는다.
- Programmers가 같은 result modal을 재사용하므로 새 child node만으로 lifecycle을 판단하지 않는다. 등록된 presentation root의 hidden 또는 non-Accepted 상태가 visible Accepted로 전환될 때 fresh Accepted event를 만든다.
- **[post-state 관찰 2026-08-04]** visibility owner는 `div#modal-dialog.modal.fade`이며 내부 `h4.modal-title`이 `정답입니다!`를 표시한다. Content adapter는 `#modal-dialog`만 presentation root로 등록하고, root 자체의 visibility와 내부 `.modal-title`의 정확한 Accepted title만 확인한다.
- **[실증 2026-08-25]** 나타나는 **과정**을 실제 제출 캡처로 확인했다. 결과 내용과 visibility는 **서로 다른 mutation batch로 온다.** 구현이 두 경로를 모두 열어 둔 것이 옳았다 — 자세한 내용은 [실증된 presentation lifecycle](#실증된-presentation-lifecycle)에 있다.
- **[실증 2026-08-25]** 실패 제출도 같은 presentation root를 사용하며 title만 다르다. 오답 캡처에서 동일한 `#modal-dialog`가 같은 순서로 전이했고 title만 `틀렸습니다!`였다. 구현이 의존하던 가정이 확인됐다.
- `inactive → acceptedVisible`은 event 1회, `acceptedVisible → acceptedVisible`은 event 0회다. `acceptedVisible → inactive`는 event를 만들지 않고 다음 Accepted를 위해 re-arm한다.
- Modal을 닫은 뒤 실제 두 번째 `inactive → acceptedVisible` 전환은 새 event다.
- Attribute 관찰은 [ADR 0022](../adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md)에 따라 adapter가 등록한 presentation root와 visibility 관련 attribute로 제한한다. Page 전체의 `class`나 `style` mutation을 관찰하거나 stale title을 포함한 큰 subtree를 다시 검색하지 않는다.
- Observer callback은 같은 batch가 끝난 현재 DOM state를 즉시 판정한다. 700ms fixed window는 first event coalescing 전용이며 title confirmation이나 delayed DOM reread에 사용하지 않는다. Accepted, close, Wrong Answer와 second Accepted의 실제 mutation 순서는 수동 검증에서 계속 확인한다.

### 실증된 presentation lifecycle

2026-08-25 기준 문제로 정답·오답을 각각 실제 제출해 캡처했다. 근거는 [`e2e/fixtures/programmers/`](../../e2e/fixtures/programmers/)의 `accepted.json`·`rejected.json`이고, 각 batch의 `watchedBefore`/`watchedAfter`에 root 상태가 함께 들어 있다.

**결과 내용과 visibility는 서로 다른 batch로 온다.** 정답·오답 모두 같은 순서였다.

| batch | 무엇이 일어나는가 | root 상태 |
| --- | --- | --- |
| 제출~28 | 채점 진행. root는 대기 상태 그대로 | `class="modal fade"`, `display: none`, `aria-hidden="true"` |
| 29 | 결과 내용이 **node 추가**로 들어온다. `.modal-title`이 이때 `정답입니다!`가 된다 | 아직 `display: none`. 즉 **title은 보이지 않는 상태에서 먼저 채워진다** |
| 30 | visibility만 바뀐다. `class`에 `show` 추가, `style="display: block;"`, `aria-hidden` 제거, `aria-modal="true"` 추가 | `display: block`, title은 이미 채워져 있음 |

이것이 앞선 다섯 질문에 대한 답이다.

1. `#modal-dialog`는 **이미 존재하던 node**다. 캡처 첫 batch부터 `present: true`이고 `display: none`으로 대기한다. 새로 만들어지지 않는다.
2. `정답입니다!`는 **node 추가**로 온다. 기존 text 교체가 아니라 결과 내용 `div`가 통째로 modal 안에 추가된다.
3. **아직 미확인.** 이번 캡처는 정답·오답 각 1회씩이라 닫은 뒤 두 번째 Accepted를 보지 못했다. 남은 질문이다.
4. **같은 root를 쓴다.** 오답도 동일한 `#modal-dialog`가 같은 두 batch 구조로 전이하고 title만 `틀렸습니다!`다.
5. **갈라진다.** 위 표대로 batch 29와 30으로 나뉜다.

5번이 갈라지는데도 판정이 성립하는 이유는 구현이 `state`를 batch 사이에 들고 가기 때문이다. batch 29에서는 title이 채워져도 root가 아직 `display: none`이라 `readState()`가 `inactive`이므로 event가 나가지 않고, batch 30의 visibility attribute 변경이 다시 `readState()`를 부를 때 비로소 `inactive → acceptedVisible` 전이가 잡힌다. **한 batch 안에서 title과 visibility를 함께 보려 하면 이 경로는 깨진다.** `PRESENTATION_ATTRIBUTE_FILTER`에서 `class`나 `style`을 빼도 batch 30이 관찰되지 않아 같은 결과가 된다.

## 검증 기준 문제

`https://school.programmers.co.kr/learn/courses/30/lessons/120804` (두 수의 곱 구하기, 코딩테스트 입문).

풀이가 한 줄이라 캡처에 잡히는 noise가 적다. `acceptedSourceId`에 code hash가 들어가므로 **반복 제출할 때는 code를 매번 다르게 만들어야 한다.** 같으면 중복으로 걸러져 commit이 생기지 않고, 그 통과는 거짓이다.

바꾸면 이전 캡처와의 비교가 끊기므로 [`e2e/capture/baseProblems.ts`](../../e2e/capture/baseProblems.ts)와 함께 고친다.

## Accepted Editor Snapshot

Fresh Accepted를 확정한 즉시 다음 값을 한 번 읽어 immutable `ProgrammersAcceptedEditorSnapshot`으로 만든다.

- `courseId`, `lessonId`
- Problem title
- 선택된 language
- Editor code
- `pageUrl`, `detectedAt`

동일 render burst의 후속 signal은 억제되며, 그 사이 editor가 바뀌어도 이미 전달한 first snapshot에 섞이지 않는다.

**[post-state 관찰 2026-05-27]** editor는 CodeMirror 계열로 렌더링되며 code source는 `textarea#code.value`다. SWEA에서 `textarea#textSource`가 존재하지만 editor 변경을 반영하지 않는 사례가 확인됐으므로, **이 textarea가 editor 변경 후에도 갱신되는지는 별도로 실측해야 한다.** 존재 확인만으로는 부족하다.

**[실증 2026-08-25]** 갱신된다. 캡처가 editor 내용을 기본 template에서 검증용 풀이로 통째로 바꾼 직후 `textarea#code.value`를 쟀더니 CodeMirror instance의 `getValue()`와 정확히 같았고(6줄 / 91자), 넣으려던 코드와도 일치했다. 정답·오답 캡처 양쪽에서 같은 값이 나왔다 — [`e2e/fixtures/programmers/`](../../e2e/fixtures/programmers/)의 `codeSource` 필드가 근거다. SWEA `textarea#textSource`에서 확인된 stale 문제는 Programmers에는 없다.

다만 이 측정은 6줄짜리 짧은 풀이로 한 것이다. 화면 밖으로 스크롤될 만큼 긴 풀이에서 잘리지 않는지는 아직 보지 못했다. 가상 스크롤의 영향을 받는 것은 rendered line DOM이지 textarea가 아니므로 잘릴 이유는 없지만, 실측하지 않은 것은 실측하지 않은 것이다. `.cm-line` 같은 rendered line DOM은 화면에 보이는 줄만 반영할 수 있으므로 source of truth로 사용하지 않는다. `textarea#code`가 없거나 `value`가 비어 있으면 extraction failure다.

Title은 page metadata/title/heading 후보에서 추출하고, language는 현재 선택된 language control에서 추출한다. Content script isolated world에서 editor source 접근이 막힐 때만 page-world bridge를 사용한다. Bridge는 code string만 전달하고 token, cookie와 session 값은 다루지 않는다.

`content:accepted_detected` payload는 `codingPlatform: "programmers"`, `courseId`, `lessonId`, `problemTitle`, `language`, `code`, `pageUrl`, `detectedAt`을 포함한다. 모든 field는 같은 route-bound fresh Accepted event에서 확정한다.

## Accepted Source ID와 trust boundary

- Programmers는 공식 Accepted Source ID가 없으므로 `acceptedSourceId`를 `programmers:{lessonId}:{language}:{codeHash}` 형식의 deterministic value로 만든다.
- Accepted Editor Snapshot은 v1의 DOM-trusted source다. Programmers origin DOM/script가 compromise되면 committed solution source integrity가 영향을 받을 수 있는 residual risk를 [ADR 0028](../adr/0028-programmers-dom-snapshot-risk-acceptance.md)에 따라 수용한다.

## 오류 계약

Missing lesson, title 또는 language와 empty code는 commit하지 않고 `programmers_extract_failed`로 normalize한다. Retry Bundle이 만들어지지 않으므로 UI는 retry action을 제공하지 않는다.

## 자동 검증

- `src/content/platforms/programmers.test.ts`: route와 Accepted text 판정, modal baseline, visibility lifecycle, root replacement, payload 조립
- `src/content/platforms/contract.test.ts`: 세 Coding Platform Adapter가 공통으로 지키는 계약
- `src/content/acceptedEventController.test.ts`: 억제 창, immutable snapshot, second Accepted와 SPA route reset
- Background/shared 관련 Vitest: Accepted Source ID, extraction failure, multi-language Solution Catalog/README projection

- `e2e/sealed.spec.ts` + `e2e/drivers/programmers.ts`: 프로덕션 빌드 산출물을 실제 Chrome에 로드해 캡처에서 온 `.modal-title` text가 Sync History까지 도달하는지 본다. **visibility 판정이 computed style에 의존해 Vitest로는 원리상 덮이지 않는 구간이다.** 재생은 캡처대로 두 batch로 나눈다 — 합쳐도 통과하지만 그 통과는 state를 batch 사이에 들고 가지 않는 구현도 함께 통과시킨다.

- `e2e/contract.spec.ts` + `e2e/drivers/programmers.ts`: 실제 page에 `#modal-dialog`가 아직 있고 **제출 전에는 숨어 있으며 속이 비어 있다**(2026-08-26 실측: `innerHTML.length`가 0이고 `.modal-title`은 결과가 올 때 함께 만들어진다). `textarea#code`가 값을 들고 있고, 언어는 adapter의 후보 목록 중 여섯 번째인 `[data-language].active`에서 온다.
- `e2e/full-cycle.spec.ts`: 실제 제출 → 실제 commit (2026-08-26 실증).

대표 검증은 `npm test -- src/content/platforms src/content/acceptedEventController.test.ts`로 실행한다. Sealed E2E는 `npm run build && npx playwright test e2e/sealed.spec.ts`다.

## 수동 검증

[공통 수동 검증 골격](README.md#검증-공통-계약)을 먼저 실행하고 다음을 추가로 확인한다. Programmers는 같은 modal을 재사용하므로 골격의 2~4번이 실제로 구분되는지가 핵심이다.

1. Accepted 표시 직후 editor를 바꿔도 첫 commit이 first Accepted snapshot의 code를 유지하는지 확인한다.
2. Modal을 닫은 뒤 두 번째 Accepted를 만든다. `inactive → acceptedVisible` 전환이 다시 일어나 새 event가 생기는지 확인한다.
3. SPA로 다른 문제에 이동해 **같은 modal root가 재사용되는지**와 Accepted의 text/visibility mutation 순서를 기록한다. Attribute-only hidden → visible 전환인 경우에도 현재 `lessonId`, title, language와 path로 sync가 정확히 한 번 생성되는지 확인한다.
4. 같은 문제에서 실제로 선택 가능한 두 번째 지원 언어로 Accepted를 만든다. 기본 검증 조합은 Swift와 Python3다.
5. 두 solution file이 존재하고 `programmers/README.md`에 Difficulty column 없이 같은 문제 한 행과 단일 `Languages` cell에 두 link가 표시되는지 확인한다.
6. `programmers/.programmers-sync/index.json`이 v5이며 두 language entry를 보존하고, 각 언어의 첫 commit message가 `(rev 1)`을 포함하는지 확인한다.

## Investigation notes (비계약)

- 제출 후 SPA로 다른 화면에 갔다가 돌아온 경우에만 Accepted sync가 누락됐다는 제보가 있으면 [SPA 복귀 후 Accepted 동기화 누락 조사 메모](../investigations/PROGRAMMERS_ACCEPTED_SYNC_MISS_AFTER_SPA_RETURN.md)를 확인한다.
