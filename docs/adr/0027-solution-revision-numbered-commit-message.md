# Solution Revision Number를 commit message에 포함한다

결정: 같은 Coding Platform, problem, supported language의 Solution File이 Sync Branch에 실제 반영될 때마다 Solution Revision Number를 증가시키고, commit message 끝에 `#n` suffix로 포함한다. Solution Catalog는 v3 schema로 올려 language entry에 `solutionRevisionNumber`를 저장한다. Solution File은 계속 같은 path를 overwrite하고, Popup, Toast, Solution README에는 Solution Revision Number를 표시하지 않는다.

이유: 같은 문제/언어의 Solution File은 최신 풀이로 overwrite하므로 파일 경로만 보면 몇 번째 반영인지 알 수 없다. commit message에 revision 번호를 두면 Git commit history에서 최신 풀이 갱신 흐름을 간단히 추적할 수 있고, README와 Popup UI는 기존처럼 현재 상태에 집중할 수 있다. Solution Catalog에 language별 번호를 저장하면 다음 commit message를 결정적으로 계산할 수 있다.

트레이드오프: Solution Catalog schema migration과 compatibility parser가 한 단계 더 필요하다. 같은 Accepted 재감지는 중복 commit이 아니므로 번호가 증가하지 않으며, GitHub commit 실패나 Retry Bundle 생성도 Sync Branch에 반영되지 않았으므로 번호를 소비하지 않는다. 번호는 제출 시도 횟수나 retry 횟수가 아니라 성공적으로 반영된 Solution File revision만 나타낸다.

Migration: 별도 migration commit은 만들지 않는다. 다음 성공 sync에서 기존 v1/v2 Solution Catalog를 읽고 v3로 반영한다. 기존 language entry에 `solutionRevisionNumber`가 없으면 해당 문제/언어의 다음 성공 sync를 `#1`로 계산한다. ref conflict retry와 Retry Bundle retry는 최신 Sync Branch의 Solution Catalog를 다시 읽어 files와 commit message를 함께 재계산한다.
