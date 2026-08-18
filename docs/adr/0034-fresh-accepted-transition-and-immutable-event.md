# Fresh Accepted transition은 route-bound immutable event로 캡처한다

> Coalescing window의 의미와 route 변경 시 pending event 폐기 규칙은 [ADR 0037](0037-immediate-accepted-delivery-with-suppression-window.md)에서 바뀌었다. 나머지는 유효하다.

결정: Content script는 현재 DOM에 Accepted 상태가 존재한다는 사실이 아니라, Coding Platform adapter가 이번 mutation에서 fresh visible Accepted transition을 확정한 경우에만 `content:accepted_detected` 후보를 만든다. Text와 presentation mutation을 제한하는 구체적인 observation 규칙은 ADR 0022를 따른다.

Fresh Accepted signal이 확인되면 controller는 route key를 다시 확정한다. Route key의 출처는 adapter이며([ADR 0036](0036-adapter-resolved-content-route-key.md)) URL로 식별 가능한 플랫폼의 adapter는 URL을 parsing한다. Route, detection time과 platform source data는 이 시점에 하나의 immutable Accepted event로 캡처한다. DOM-backed source가 필요한 경우에도 fresh signal 직후 한 번만 snapshot하고 지연 callback에서 DOM을 다시 읽지 않는다. SWEA처럼 source가 비동기로 도착하는 경우에도 요청은 fresh signal 시점에 보내고, 그 사이 route가 바뀌면 도착한 값을 버린다.

동일 render burst는 first-event fixed-window coalescer로 최대 한 번만 전달한다. Window 안의 후속 signal은 first event와 snapshot을 교체하거나 timer를 연장하지 않는다. Route key가 바뀌면 이전 route의 pending event, coalescing state와 route-bound adapter state를 폐기하고 현재 mutation batch를 새 route 기준으로 판정한다. 전달 직전에도 route key를 다시 확인한다.

Content detection controller가 observer, route lifecycle, coalescing과 message emission을 소유한다. Content entry는 controller 시작과 toast wiring만 담당한다.

이유: Stale Accepted DOM을 현재 event로 오판하면 Run, Wrong Answer, modal close나 unrelated mutation이 불필요한 sync를 시작할 수 있다. Coalescing callback이 DOM을 다시 읽으면 signal 이후 수정된 source가 Accepted event에 섞일 수 있다. 최초 loading route를 계속 사용하면 SPA 이동 후 현재 page source와 이전 problem identifier가 결합될 수 있다.

플랫폼별 signal, source snapshot과 Accepted Source ID 계약은 [LeetCode 연동](../platforms/LEETCODE.md), [Programmers 연동](../platforms/PROGRAMMERS.md)과 [SWEA 연동](../platforms/SWEA.md)을 따른다.

트레이드오프: Content controller가 route와 짧은 coalescing state를 보유하고 관련 단위 테스트가 늘어난다. 이 state는 전송 전의 일시적인 UI event state이며 sync correctness나 장기 source of truth로 사용하지 않는다. 그 대신 stale event, 잘못된 source snapshot과 route 혼합을 content detection boundary에서 차단한다.
