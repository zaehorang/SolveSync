# Programmers SPA 복귀 후 Accepted 동기화 누락 조사 메모

> **상태**: 실제 Chrome에서 재현되지 않은 저우선순위 조사 후보
>
> **용도**: 사용자가 “제출 후 다른 화면에 갔다가 돌아오니 Accepted가 동기화되지 않았다”고 제보할 때 먼저 확인한다. 제품 계약, 확정된 Known Issue 또는 troubleshooting 절차가 아니다.

## 찾기 위한 증상 표현

- Programmers에서 `정답입니다!`를 확인했지만 SolveSync toast가 없다.
- Sync History와 GitHub commit이 생성되지 않았다.
- 문제를 제출한 뒤 새로고침 없이 다른 화면으로 이동했다가 문제 화면으로 돌아왔다.
- 문제 화면으로 돌아오는 순간 제출 결과 modal도 함께 나타났다.
- Accepted sync가 간헐적으로 누락되며 일반적인 제출 흐름에서는 재현되지 않는다.

## 의심하는 경계 상황

다음 조건이 모두 맞을 때 Accepted event가 누락될 가능성을 조사 후보로 둔다.

```text
Programmers 문제 route에서 content observer가 시작됨
→ 새로고침 없는 SPA 이동으로 지원하지 않는 route/context에 진입
→ 같은 document에서 Programmers 문제 route로 복귀
→ 복귀를 알리는 mutation batch에 fresh `정답입니다!` text도 함께 포함
→ controller가 presentation tracker를 baseline reset한 뒤 현재 batch를 판정하지 않음
→ 이미 visible인 Accepted가 startup baseline처럼 흡수되어 sync event 누락
```

현재 의심 지점은 다른 Coding Platform에서 Programmers route로 진입할 때다. 그 batch는 presentation root만 잡고 판정하지 않는다. Coding Platform Adapter 도입 후에는 `RouteTransition`의 `otherPlatform`이 이 동작을 담고 있으며, `src/content/platforms/types.ts`에 그 이유가 적혀 있다. 리팩터링에서 동작을 바꾸지 않았다.

## 이 상황과 구분할 것

- 문제 페이지에서 기다리는 동안 결과 modal이 나타나는 일반 제출 흐름은 이 후보가 아니다.
- 브라우저 전체 navigation이나 새로고침으로 content script가 종료된 경우는 같은 SPA 경계가 아니다. 복귀 시 이미 visible인 결과를 startup baseline으로 취급하는 것은 중복 sync 방지를 위한 현재 계약이다.
- Modal close, Run, Wrong Answer 또는 stale Accepted modal의 unrelated `class`/`style` mutation은 별도 lifecycle 문제다.
- Toast만 보이지 않고 Sync History나 commit은 존재한다면 Accepted detection 누락이 아니라 toast/rendering 문제일 가능성이 높다.

## 재현 시 확인할 사항

1. 화면 이동 중 document reload가 있었는지, 같은 content script가 계속 실행됐는지 확인한다.
2. 이동 전후 URL과 `lessonId`, presentation root가 같은 DOM node로 재사용됐는지 기록한다.
3. 복귀 callback에 route 변경 신호와 fresh `정답입니다!` text mutation이 함께 들어왔는지 확인한다.
4. `#modal-dialog`의 `hidden`, `aria-hidden`, computed `display`/`visibility`와 `.modal-title`의 최종 text만 기록한다.
5. Toast, Sync History와 GitHub commit이 모두 없었는지 확인한다.

Solution code, token, cookie, session 값과 문제 설명 전문은 log, screenshot 또는 fixture에 남기지 않는다.

## 재현되면 검토할 변경

- non-Programmers → Programmers route 진입에서도 tracker root를 준비한 뒤 현재 mutation batch의 fresh text/attribute signal을 판정한다.
- Content script startup에 이미 visible인 Accepted는 계속 non-emitting baseline으로 유지한다.
- 다음 controller 회귀 테스트를 먼저 추가한다.

```text
observer가 살아 있는 unsupported route
→ Programmers lesson route 진입
→ 같은 callback에 fresh Accepted text와 visible modal
→ 현재 lesson snapshot event 정확히 1회
```

함께 확인할 테스트 사각지대:

- SPA route reset이 `inactive tracker + visible Accepted DOM + fresh signal 없음`을 실제 baseline으로 저장하는지
- Presentation root replacement 후 document text target과 새 root attribute target을 모두 다시 등록하는지
- `inactive` 상태에서 unrelated content mutation이 visible Accepted 상태를 미리 소비하지 않는지

## 관련 source of truth와 코드

- `docs/ARCHITECTURE.md`
- `docs/adr/0022-bounded-mutation-text-traversal-for-accepted-detection.md`
- `docs/adr/0034-fresh-accepted-transition-and-immutable-event.md`
- `docs/platforms/PROGRAMMERS.md`
- `src/content/acceptedEventController.ts`
- `src/content/platforms/programmers.ts`
- `src/content/index.test.ts`
- `src/content/platforms/programmers.test.ts`
