# SolveSync

SolveSync는 LeetCode와 Programmers에서 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소로 동기화하는 개인용 Chrome extension이다. 이 컨텍스트는 문제 풀이 제출, 동기화 대상, GitHub 반영 결과를 다루는 언어를 정의한다.

## 언어

**Coding Platform**:
사용자가 문제를 풀고 제출하는 외부 코딩 문제 서비스. SolveSync v1의 Coding Platform은 LeetCode와 Programmers다.
_Avoid_: Problem platform, site, judge, provider

**Accepted Submission**:
Coding Platform에서 Accepted 판정을 받은 사용자의 제출. SolveSync에서는 GitHub 동기화 후보가 되는 제출을 뜻하며, 문제 자체를 푼 상태나 현재 editor 상태와는 구분한다.
_Avoid_: Solved problem, accepted problem, result

**Accepted Editor Snapshot**:
Programmers에서 Accepted 직후 현재 문제 페이지의 editor code와 화면 메타데이터에서 얻은 동기화 source. 제출 상세 기록이나 화면 캡처가 아니라 사용자가 Accepted를 받은 순간 SolveSync가 관찰한 editor 상태다.
_Avoid_: Accepted snapshot, submission detail, official submission, screenshot, cached code

**Sync Deduplication Key**:
같은 Accepted Submission 또는 Accepted Editor Snapshot을 중복 commit하지 않기 위해 사용하는 기준값. 같은 문제와 언어의 최신 풀이를 같은 파일로 덮어쓰는 기준과는 별개의 개념이다.
_Avoid_: Sync identity, submission identity, problem identity, file identity

**Sync Repository**:
사용자가 SolveSync Options에서 선택한 GitHub 저장소. SolveSync가 Solution File, Solution Catalog, Solution README를 반영하는 목적지다.
_Avoid_: Target repository, default repository, validation repository, local repository

**Sync Branch**:
Sync Repository 안에서 SolveSync가 commit을 반영하는 사용자가 선택한 branch. 존재하지 않는 branch는 자동 목적지가 아니다.
_Avoid_: Target branch, default branch, generated branch

**Solution File**:
Accepted Submission의 풀이 코드가 Sync Repository에 저장된 파일. 같은 문제와 언어의 새 Accepted Submission은 기존 Solution File을 최신 풀이로 갱신한다.
_Avoid_: Submission file, source file

**Solution Revision Number**:
같은 Coding Platform, problem, supported language의 Solution File이 Sync Branch에 실제 반영된 revision 번호. GitHub commit 성공으로 Sync Branch에 반영된 경우에만 증가한다.
_Avoid_: Attempt number, retry count, submission count

**Solution Catalog**:
Sync Repository 안에서 Coding Platform별로 동기화된 Solution File 목록과 풀이 진행 정보를 기록하는 기준 장부. Solution README는 이 장부에서 생성되며, 중복 처리, Sync History, Retry 상태의 기준 장부는 아니다.
_Avoid_: Platform solution catalog, README table, progress table, retry state

**Solution README**:
Coding Platform별 풀이 진행 상황을 보여주는 README. 사용자 작성 영역을 보존하면서 Solution Catalog에서 생성된 내용을 포함한다.
_Avoid_: Platform README, catalog, source of truth

**Sync History**:
Popup에 표시되는 최근 동기화 시도와 결과의 목록. GitHub에 반영된 정답 목록의 원천은 아니며, 사용자가 최근 상태를 이해하기 위한 기록이다.
_Avoid_: Sync record, platform catalog, processed submission

**Retry Bundle**:
GitHub commit 실패를 다시 시도하기 위해 로컬에 임시 보관되는 동기화 데이터 묶음. Retry 가능한 실패에만 존재하며 solution code가 포함될 수 있다.
_Avoid_: Retry payload, backup, sync history, permanent cache
