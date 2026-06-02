# Accepted 감지는 mutation 범위의 bounded text traversal을 사용한다

결정: Content script는 Coding Platform DOM class selector나 페이지 전체 텍스트 scan 대신, `MutationObserver`가 전달한 변경 node 범위 안에서 제한된 leaf text 후보를 검사해 Accepted 이벤트를 감지한다.
이유: LeetCode와 Programmers 결과 UI는 성공 상태, runtime, memory, code, 링크, 추천 문제 텍스트를 큰 container 안에 함께 렌더링할 수 있다. 큰 container의 전체 `textContent`를 판정하면 길이 제한이나 generic 문구 때문에 Accepted를 놓치거나 오탐할 수 있다. Class name과 layout도 안정적인 계약으로 보기 어렵다.
트레이드오프: DOM 텍스트 패턴 변화에는 여전히 영향을 받는다. 대신 LeetCode는 `Accepted n / n testcases passed`, Programmers는 `정답입니다!` 같은 짧은 결과 문구를 우선 감지하고, detector 단위 테스트와 실제 브라우저 수동 검증으로 보완한다.
