# Accepted 감지는 mutation 범위의 bounded text traversal을 사용한다

결정: Content script는 Coding Platform DOM class selector나 page 전체 text scan 대신, `MutationObserver`가 전달한 변경 node 범위 안에서 제한된 leaf text 후보를 검사해 Accepted event를 감지한다.

`childList` mutation은 같은 record의 `addedNodes`만 bounded traversal하고 `mutation.target` 전체 subtree와 `removedNodes`를 재탐색하지 않는다. `characterData` mutation은 `characterDataOldValue: true`로 받은 이전 text와 현재 target text를 비교해 non-Accepted → Accepted 전환만 인정한다. 여러 text node의 조합은 같은 mutation에서 추가된 node 안으로 제한한다. Candidate 자신이나 조상이 `hidden` 또는 `aria-hidden="true"`이면 제외하며 traversal depth, text length, candidate count와 joined leaf count cap을 유지한다.

Attribute 기반 presentation 감지가 필요한 Coding Platform은 하나의 `MutationObserver`에 document text target과 adapter가 발견한 presentation root를 서로 다른 option으로 등록한다. Presentation target의 관찰 attribute는 visibility 판정에 필요한 `aria-hidden`, `hidden`, `class`, `style`로 제한하며, page 전체 attribute mutation을 수집하지 않는다. 같은 callback은 등록된 root의 이전/현재 presentation state를 비교할 뿐 `mutation.target`이나 document의 큰 subtree text를 다시 scan하지 않는다. Presentation root가 교체되면 observer를 disconnect한 뒤 document target과 새 root를 다시 등록한다.

이유: Coding Platform 결과 UI는 성공 상태, runtime, memory, code, link와 추천 문제 text를 큰 container 안에 함께 render할 수 있다. 큰 container의 전체 `textContent`를 판정하면 generic text나 stale Accepted state 때문에 오탐할 수 있다. 반대로 이미 DOM에 존재하는 modal이 attribute만 바꿔 표시되는 경우에는 `addedNodes` text 감지만으로 fresh transition을 놓칠 수 있다. Bounded text traversal과 등록된 presentation root의 state observation을 분리하면 두 경우를 좁은 mutation boundary 안에서 처리할 수 있다.

플랫폼별 Accepted pattern과 presentation state 계약은 [LeetCode 연동](../platforms/LEETCODE.md), [Programmers 연동](../platforms/PROGRAMMERS.md)과 [SWEA 연동](../platforms/SWEA.md)을 따른다.

트레이드오프: DOM text와 visibility attribute 변화에는 여전히 영향을 받으며 adapter가 presentation root lifecycle을 관리해야 한다. 대신 detector 단위 테스트와 실제 browser 수동 검증으로 변경을 조기에 확인하고, document 전체 attribute observation과 stale subtree 재탐색으로 인한 성능 비용과 오탐을 피한다.
