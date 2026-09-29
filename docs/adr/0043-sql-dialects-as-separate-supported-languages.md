# SQL 방언을 방언별 별도 supported language로 추가한다

상태: Accepted. [ADR 0030](0030-central-language-registry-and-single-readme-languages-column.md)의 지원 언어 목록을 늘린다.

결정: Supported language에 SQL 방언 넷을 추가한다. SQL을 하나로 묶지 않고 방언마다 별도 key를 둔다. 순서는 기존 `rust` 뒤에 이 순서다. 확장자는 모두 `sql`이다.

| Key | Display | Folder | Extension | Programmers alias | LeetCode alias | SWEA |
| --- | --- | --- | --- | --- | --- | --- |
| `mysql` | MySQL | `mysql` | `.sql` | `mysql` | `mysql` | 없음 |
| `oracle` | Oracle | `oracle` | `.sql` | `oracle` | `oracle`, `oraclesql` | 없음 |
| `postgresql` | PostgreSQL | `postgresql` | `.sql` | 없음 | `postgresql` | 없음 |
| `mssql` | MS SQL Server | `mssql` | `.sql` | 없음 | `mssql`, `MS SQL Server` | 없음 |

- 범위는 Programmers와 LeetCode다. SWEA에는 SQL 문제가 없어 alias를 비운다.
- LeetCode의 Pandas(`pythondata`)는 지원하지 않는다. 계속 `unsupported_language`로 기록하고 commit하지 않는다.
- LeetCode alias `oraclesql`은 GraphQL `name`, `MS SQL Server`는 `verboseName`이다. client는 `verboseName`을 먼저 읽고 없으면 `name`을 읽으므로 두 표기를 모두 둔다. alias 정규화가 공백을 지우므로 `MS SQL Server`는 `mssqlserver`가 되어 `mssql`과 다른 alias로 남는다.
- Solution Catalog schema와 storage schema는 올리지 않는다. Catalog의 language map은 registry key 집합으로 검증하므로 새 key를 그대로 받는다.
- Solution README의 `Languages` cell은 기존 규칙대로 registry 순서로 표시한다. column은 늘리지 않는다.

이유: 방언마다 문법이 달라 한 방언의 풀이가 다른 방언에서 돌지 않는다. 같은 문제를 MySQL과 Oracle로 푼 것은 서로 다른 풀이이므로 둘 다 남아야 한다. 방언별 key를 두면 [ADR 0015](0015-overwrite-latest-solution-for-same-problem-language.md)의 같은 problem·language 덮어쓰기에 걸리지 않고, 기존 Catalog 구조와 path 규칙을 그대로 쓴다.

트레이드오프: 확장자가 겹치므로 registry 무결성 테스트가 확장자 유일성을 검사할 수 없고 folder 유일성만 검사한다. 경로 충돌은 folder가 막는다. LeetCode나 Programmers가 방언을 추가하거나 label을 바꾸면 registry와 테스트를 갱신해야 한다. 이전 버전 확장 프로그램은 새 key를 가진 Catalog를 읽으면 malformed로 본다. 새 버전에서 SQL을 sync한 저장소에 이전 버전을 다시 설치하면 그 저장소의 sync가 malformed Catalog 실패로 끝난다. 이전 버전이 storage에서 새 language key를 가진 Sync History나 Retry Bundle을 읽으면 malformed state로 보고 해당 key만 empty fallback으로 복구한다.

미확인: Programmers SQL 정답이 일반 문제와 같은 `정답입니다!` modal로 뜨는지, LeetCode Database 문제가 일반 문제와 같은 Accepted 감지와 제출 상세 흐름을 타는지는 실제 제출로 확인하지 않았다. 언어 선택 UI와 GraphQL 언어 목록만 실측했다. 근거는 [PROGRAMMERS.md](../platforms/PROGRAMMERS.md)와 [LEETCODE.md](../platforms/LEETCODE.md)에 있다.
