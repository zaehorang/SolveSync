# Programmers 연동 계약

> **Description**: Programmers 전용 route, Accepted presentation, Accepted Editor Snapshot, 오류와 검증 계약을 정의한다. 공통 계약은 [Coding Platform 연동 계약](README.md)을 따른다.

## Route와 Accepted presentation

- 지원 route는 `/learn/courses/{courseId}/lessons/{lessonId}`다. Accepted 후보마다 현재 URL에서 `courseId`와 `lessonId`를 다시 추출한다.
- Problem ID와 frontend ID는 `lessonId`를 사용한다. Difficulty는 제공되지 않는다. Difficulty가 없으면 Catalog에는
  `-`로 저장하되 Solution README에서는 의미 없는 Difficulty column을 표시하지 않는다.
- 정확한 `정답입니다!`를 Accepted text 신호로 사용한다.
- `통과`, `채점 결과`, `합계: 100.0 / 100.0`은 보조 결과 text일 뿐이며 단독 Accepted trigger로 사용하지 않는다.
- Programmers가 같은 result modal을 재사용하므로 새 child node만으로 lifecycle을 판단하지 않는다. 등록된 presentation root의 hidden 또는 non-Accepted 상태가 visible Accepted로 전환될 때 fresh Accepted event를 만든다.
- **[post-state 관찰 2026-08-04]** visibility owner는 `div#modal-dialog.modal.fade`이며 내부 `h4.modal-title`이 `정답입니다!`를 표시한다. Content adapter는 `#modal-dialog`만 presentation root로 등록하고, root 자체의 visibility와 내부 `.modal-title`의 정확한 Accepted title만 확인한다.
- **이 관찰이 말하지 않는 것.** post-state 관찰은 결과가 나타난 뒤의 DOM만 본 것이다. 나타나는 **과정**은 확인된 적이 없다. 그래서 구현은 fresh Accepted text와 root의 visibility attribute 변경 중 **어느 쪽이 와도** 상태를 다시 읽도록 두 경로를 모두 열어 두었다. 두 경로를 다 대비한다는 사실 자체가 어느 쪽인지 모른다는 뜻이다.
- **[가정]** 실패 제출도 같은 presentation root를 사용하며 title만 다르다. 구현은 title이 정확히 `정답입니다!`가 아니면 `inactive`로 읽어 이 가정에 의존한다. 별도 root를 쓴다면 실패 modal이 등록되지 않아 다음 Accepted의 전이 판정이 어긋날 수 있다.
- `inactive → acceptedVisible`은 event 1회, `acceptedVisible → acceptedVisible`은 event 0회다. `acceptedVisible → inactive`는 event를 만들지 않고 다음 Accepted를 위해 re-arm한다.
- Modal을 닫은 뒤 실제 두 번째 `inactive → acceptedVisible` 전환은 새 event다.
- Attribute 관찰은 [ADR 0022](../adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md)에 따라 adapter가 등록한 presentation root와 visibility 관련 attribute로 제한한다. Page 전체의 `class`나 `style` mutation을 관찰하거나 stale title을 포함한 큰 subtree를 다시 검색하지 않는다.
- Observer callback은 같은 batch가 끝난 현재 DOM state를 즉시 판정한다. 700ms fixed window는 first event coalescing 전용이며 title confirmation이나 delayed DOM reread에 사용하지 않는다. Accepted, close, Wrong Answer와 second Accepted의 실제 mutation 순서는 수동 검증에서 계속 확인한다.

### 실증으로 확정해야 할 것

아래는 현재 미확인이며 Live E2E 실제 제출로만 답할 수 있다. fixture를 만들 때 이 값들을 함께 기록한다.

1. 첫 Accepted에서 `#modal-dialog`가 새로 만들어지는가, 이미 있던 node가 보이게 되는가.
2. `정답입니다!`가 node 추가로 오는가, 기존 text 교체로 오는가.
3. 닫은 뒤 두 번째 Accepted에서 같은 node가 재사용되는가.
4. 실패 제출이 같은 root를 쓰는가.
5. title 변경과 visibility 변경이 같은 mutation batch인가, 갈라지는가.

5번이 가장 미묘하다. 갈라지는 경우 어느 순서든 결국 전이가 잡히도록 짜여 있으나 실측한 적은 없다.

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

**[post-state 관찰 2026-05-27]** editor는 CodeMirror 계열로 렌더링되며 code source는 `textarea#code.value`다. SWEA에서 `textarea#textSource`가 존재하지만 editor 변경을 반영하지 않는 사례가 확인됐으므로, **이 textarea가 editor 변경 후에도 갱신되는지는 별도로 실측해야 한다.** 존재 확인만으로는 부족하다. `.cm-line` 같은 rendered line DOM은 화면에 보이는 줄만 반영할 수 있으므로 source of truth로 사용하지 않는다. `textarea#code`가 없거나 `value`가 비어 있으면 extraction failure다.

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

대표 검증은 `npm test -- src/content/platforms src/content/acceptedEventController.test.ts`로 실행한다.

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
