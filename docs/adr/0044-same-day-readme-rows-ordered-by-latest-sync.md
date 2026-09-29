# 같은 날 푼 README 행은 최근 동기화한 것이 위에 오게 한다

상태: Accepted. 같은 날짜 안의 tiebreak를 문제 번호에서 최근 동기화 시각으로 바꾼다.

결정: Solution README 표는 1차 키를 problem-level first accepted date 내림차순으로 유지한다. 같은 날짜 안에서는 그 문제의 language entry들 중 가장 늦은 `lastSyncedAt`이 더 늦은 행을 위에 둔다. 그래도 같거나 `lastSyncedAt`이 없거나 파싱되지 않으면 문제 번호 오름차순으로 정한다. `lastSyncedAt`이 파싱되지 않는 entry는 가장 오래된 것으로 본다. Catalog parser는 이 필드가 문자열이기만 하면 통과시키고 누락은 malformed_index로 거부하므로, 누락 값은 이 정렬에 도달하지 않는다. 비교 함수의 누락 처리는 정책이 아니라 전순서를 유지하기 위한 방어다. Catalog와 storage schema는 바꾸지 않고 기존 필드만 쓴다. 정렬은 계속 README 렌더 시점에만 한다.

이유: 기존 tiebreak는 문제 번호라서, 방금 푼 문제의 번호가 크면 그날 묶음의 맨 아래로 갔다. 실제 저장소에서 42576, 42888, 157342 순으로 표시되고 방금 푼 157342가 맨 아래에 있었다. 1차 키를 first accepted date로 유지해야 Solved cell이 보여주는 날짜와 표 순서가 어긋나지 않는다. `lastSyncedAt`은 새 commit이 생길 때만 바뀌므로([ADR 0042](0042-skip-commit-for-accepted-already-in-solution-catalog.md)) 재렌더만으로 순서가 흔들려 의미 없는 commit이 생기지 않는다.

트레이드오프: 같은 날 먼저 푼 문제를 다시 제출해 새 commit이 생기면 그 문제가 그날 묶음의 맨 위로 올라온다. 표시된 Solved 날짜는 그대로다. 날짜가 다른 날끼리의 순서는 재제출로 바뀌지 않는다. 같은 날 안의 순서가 풀이 순서가 아니라 마지막 동기화 순서가 된다.
