# Content route key는 adapter가 확정한다

결정: Content detection controller는 route key를 URL에서 직접 parsing하지 않고 Coding Platform adapter에게 현재 page identity를 물어 확정한다. URL로 식별 가능한 플랫폼의 adapter는 계속 URL을 parsing해 같은 값을 돌려주므로 LeetCode와 Programmers의 동작은 바뀌지 않는다.

이유: SWEA 풀이 페이지는 `https://swexpertacademy.com/main/solvingProblem/solvingProblem.do`이고 **모든 문제가 같은 URL을 쓰며 query string이 없다.** URL만으로는 어떤 문제인지 알 수 없고, 문제 식별자는 DOM의 `input#contestProbId`에만 있다. Route key를 URL에서 뽑는 구조에서는 SWEA의 모든 문제가 같은 key를 갖게 되어 ADR 0034의 route 경계가 무의미해진다.

ADR 0034의 나머지 계약은 그대로 유지한다(coalescing window의 의미와 pending event 폐기 규칙은 이후 [ADR 0037](0037-immediate-accepted-delivery-with-suppression-window.md)에서 바뀌었다). Fresh signal 시점에 route key를 확정하고, 전달 직전에 다시 확인하며, route key가 바뀌면 pending event와 coalescing state, route-bound adapter state를 폐기한다. 바뀌는 것은 route key의 출처뿐이다.

Route key를 확정할 수 없는 경우는 unsupported page로 처리하고 event를 만들지 않는다. SWEA에서 `#contestProbId`를 읽지 못하는 순간이 여기에 해당한다.

트레이드오프: route key가 DOM에 의존하게 되어 URL만 보고 판정할 때보다 취약해진다. 대신 같은 URL을 재사용하는 플랫폼에서 서로 다른 문제의 source가 섞이는 것을 막는다. Route key를 못 읽는 방향은 sync가 생기지 않는 실패이므로 잘못된 문제로 commit되는 실패보다 안전하다.
