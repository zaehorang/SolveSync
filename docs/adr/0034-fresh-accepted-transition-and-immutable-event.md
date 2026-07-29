# Fresh Accepted transition은 route-bound immutable event로 캡처한다

결정: Content script는 현재 DOM에 Accepted 문구가 존재한다는 사실이 아니라, 이번 mutation에서 visible Accepted 상태가 새로 나타난 경우에만 `content:accepted_detected` 후보를 만든다.

`childList` mutation은 동일 record의 `addedNodes`만 bounded traversal한다. `mutation.target` 전체 subtree와 `removedNodes`는 재탐색하지 않는다. `characterData` mutation은 `characterDataOldValue: true`로 받은 이전 text와 현재 target text를 비교해 non-Accepted에서 Accepted로 바뀐 경우만 인정한다. 여러 text node의 Accepted 문구 조합은 동일 mutation의 새 node 안에서만 허용한다. 후보 자신이나 조상이 `hidden` 또는 `aria-hidden="true"`이면 제외한다. ADR 0022의 traversal depth, text length와 candidate count 제한은 유지한다.

Fresh Accepted signal이 확인되면 현재 URL에서 route를 다시 확정한다. Programmers는 그 시점의 code, language와 title을 한 번 읽어 immutable Accepted Editor Snapshot을 만든다. 동일 render burst는 첫 event와 snapshot을 보존하는 fixed-window coalescer로 최대 한 번만 전달하며, 지연 callback은 DOM을 다시 읽지 않는다. Route key가 바뀌면 이전 route의 pending event와 coalescing state를 폐기하고 현재 mutation batch는 새 route 기준으로 판정한다. 전달 직전에도 route key를 다시 확인한다.

Content detection controller가 observer, route lifecycle, coalescing과 message emission을 소유한다. Content entry는 controller 시작과 toast wiring만 담당한다.

이유: `childList`의 target subtree를 다시 탐색하면 이전 Accepted DOM이 남은 상태에서 Run, Wrong Answer, modal close나 unrelated mutation이 발생했을 때 stale Accepted를 fresh event로 오판한다. Programmers에서 debounce callback이 editor를 다시 읽으면 그 사이 수정된 미채점 code가 Accepted Editor Snapshot에 들어갈 수 있다. 최초 로딩 route를 계속 사용하면 SPA 이동 후 현재 page source와 이전 problem identifier가 섞일 수 있다.

유지하는 계약: LeetCode GraphQL source resolution과 Programmers의 `programmers:{lessonId}:{language}:{codeHash}` Accepted Source ID는 변경하지 않는다. 문제/언어 단위로 dedup 범위를 넓히지 않는다. 실제 두 번째 Accepted revision은 정상적으로 새 commit을 만들어야 한다.

트레이드오프: Content controller가 route와 짧은 coalescing state를 보유하고 관련 단위 테스트가 늘어난다. 이 state는 전송 전의 일시적인 UI event state이며, sync correctness나 장기 source of truth로 사용하지 않는다. 그 대신 미채점 code commit과 불필요한 LeetCode source 조회를 content detection boundary에서 차단한다.
