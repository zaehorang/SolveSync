# DOM 감지와 Coding Platform별 source 조회 결합

결정: DOM 관찰로 Accepted 이벤트를 감지하고, 실제 sync source는 Coding Platform별 adapter에서 확정한다. LeetCode는 GraphQL 우선 API client로 submission 상세를 가져오고, Programmers는 Accepted 직후 현재 문제 페이지의 Accepted Editor Snapshot을 사용한다.
이유: DOM은 사용자가 보는 결과 이벤트 감지에 적합하다. LeetCode는 API로 정확한 code, language, submission id, problem metadata를 얻을 수 있다. Programmers는 공식 제출 상세 API를 전제로 하지 않고, 사용자가 Accepted를 받은 현재 editor 상태를 source로 삼는 편이 v1 local extension 범위에 맞다.
트레이드오프: LeetCode internal API와 Programmers DOM/editor 구조 모두 안정성이 보장되지 않는다. API client와 Accepted Editor Snapshot 추출 코드를 각각 격리하고 실제 브라우저 수동 검증으로 보완해야 한다.
