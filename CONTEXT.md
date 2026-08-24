# SolveSync

SolveSync는 LeetCode, Programmers와 SWEA에서 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소로 동기화하는 개인용 Chrome extension이다. 이 컨텍스트는 문제 풀이 제출, 동기화 대상, GitHub 반영 결과를 다루는 언어를 정의한다.

## 언어

**Coding Platform**:
사용자가 문제를 풀고 제출하는 외부 코딩 문제 서비스. SolveSync의 Coding Platform은 LeetCode, Programmers와 SW Expert Academy(SWEA)다.
_Avoid_: Problem platform, site, judge, provider

**Accepted Submission**:
Coding Platform에서 Accepted 판정을 받은 사용자의 제출. SolveSync에서는 GitHub 동기화 후보가 되는 제출을 뜻하며, 문제 자체를 푼 상태나 현재 editor 상태와는 구분한다.
_Avoid_: Solved problem, accepted problem, result

**Accepted Editor Snapshot**:
Programmers와 SWEA에서 Accepted 직후 현재 문제 페이지의 editor code와 화면 메타데이터에서 얻은 동기화 source. 제출 상세 기록이나 화면 캡처가 아니라 사용자가 Accepted를 받은 순간 SolveSync가 관찰한 editor 상태다.
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

**Coding Platform Adapter**:
한 Coding Platform의 관찰과 해석만 담당하는 구현체. Content에서는 route 확정, fresh Accepted 전이 판정과 Accepted event payload 조립을 담당하고, Background에서는 source 조회와 `acceptedSourceId` 생성을 담당한다. 공통 orchestration(억제 창, route lifecycle, GitHub commit)은 Adapter 밖에 있다.
_Avoid_: Platform handler, detector, plugin, strategy

**Accepted Signal**:
Coding Platform Adapter가 fresh Accepted 전이를 확정한 그 시점에 한 번 캡처한 불변 snapshot. Accepted event payload를 조립하는 유일한 입력이며, 조립 단계에서 DOM을 다시 읽지 않는다는 계약을 이 값이 대신한다.
_Avoid_: Detection result, accepted state, snapshot

**Sealed E2E**:
빌드된 확장을 실제 Chrome에 로드하되 Coding Platform 페이지 요청을 캡처 기반 로컬 fixture로 가로채 수행하는 자동 검증. 네트워크를 타지 않고 자격증명이 필요 없어 매 Pull Request에서 실행한다. 검증하는 것은 배선이지 플랫폼의 현재 DOM이 아니다.
_Avoid_: Mock e2e, offline test, integration test

**Live E2E**:
Verification Profile로 실제 Coding Platform 페이지를 열어 수행하는 검증. Contract Check와 실제 제출을 포함한 풀사이클이 여기 속한다. 자격증명이 필요하므로 CI에 배선하지 않는다.
_Avoid_: Real test, production test, smoke test

**Contract Check**:
제출하지 않고 실제 문제 페이지에서 Coding Platform Adapter가 의존하는 DOM 도달 가능성만 확인하는 Live E2E. 제출 상한과 계정 기록을 쓰지 않아 자주 실행할 수 있다. Accepted 결과 DOM은 제출이 있어야 나타나므로 이 검증의 범위 밖이다.
_Avoid_: Selector test, health check, monitoring

**Platform E2E Driver**:
검증 하네스 쪽의 플랫폼별 구현체. fixture, 기준 문제 URL, Contract Check 단언, 제출 조작을 제공한다. 제품 번들에 포함되지 않으며 제출 버튼처럼 제품이 쓰지 않는 selector는 여기에만 존재한다.
_Avoid_: Test adapter, platform helper, page object

**Verification Repository**:
검증이 commit을 만드는 전용 GitHub 저장소. 사용자의 Sync Repository와 분리된 별개 저장소이며 검증 외의 용도로 쓰지 않는다.
_Avoid_: Test repository, sync repository, sandbox

**Verification Profile**:
Live E2E가 사용하는 전용 Chrome user data directory. 사용자의 상시 프로필과 분리하며, SolveSync의 Sync Deduplication Key 상태가 확장 설치 단위로 저장되므로 이 분리가 실사용 동기화 오염을 막는 유일한 수단이다.
_Avoid_: Test profile, browser profile, headless profile
