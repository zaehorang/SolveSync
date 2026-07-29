# SolveSync 문제 해결

이 문서는 GitHub Public Preview Release ZIP을 `Load unpacked`로 설치한 사용자가 secret을 노출하지 않고 흔한 문제를 확인하는 절차다.

## 먼저 확인할 것

1. `chrome://extensions`에서 SolveSync가 enabled 상태이고 extension error가 없는지 확인한다.
2. 설치 폴더 바로 아래에 `manifest.json`이 있는지 확인한다.
3. 새 release로 업데이트했다면 기존 설치 폴더의 내용을 교체한 뒤 `Reload`했는지 확인한다.
4. Options에서 GitHub 로그인, Sync Repository, Sync Branch, Auto Sync 설정을 확인한다.
5. Connection test를 실행한다. 이 검사는 repository와 branch의 read access만 확인하며 commit을 만들지 않는다.

## Extension을 로드할 수 없음

- ZIP 자체가 아니라 압축을 푼 폴더를 선택한다.
- 선택한 폴더 바로 아래에 `manifest.json`이 있어야 한다.
- 압축을 푼 폴더를 이동하거나 삭제했다면 원래 위치로 복원하거나 새 위치에서 다시 Load unpacked한다.
- 새 위치에서 다시 로드하면 별도 extension instance가 될 수 있다. 중복 instance를 동시에 활성화하지 않는다.

## GitHub 로그인이 끝나지 않음

- Options에 표시된 verification URL을 열고 현재 연결하려는 GitHub 계정으로 로그인했는지 확인한다.
- 일회용 code가 만료되거나 승인이 거부되었다면 `Sign in with GitHub`를 다시 실행한다.
- GitHub 승인 화면, Issue, screenshot에 device code나 token을 공유하지 않는다.
- 반복 실패하면 GitHub 서비스 상태와 네트워크 차단 여부를 확인한다.

## GitHub App을 설치했지만 repository가 보이지 않음

- repository가 로그인한 GitHub 개인 계정의 소유인지 확인한다. Organization 및 collaborator repository는 현재 지원하지 않는다.
- GitHub `Settings → Applications → Installed GitHub Apps`에서 SolveSync가 해당 repository에 접근하도록 선택되어 있는지 확인한다.
- Options에서 `Load Sync Repositories`를 다시 실행한다.
- 다른 GitHub 계정에 App을 설치했다면 현재 연결을 해제하고 올바른 계정으로 다시 로그인한다.

## Branch가 없거나 만들 수 없음

- Empty repository에는 default branch HEAD가 없으므로 SolveSync가 branch를 만들 수 없다. GitHub에서 README 같은 initial commit을 먼저 만든다.
- Branch는 자동 생성되지 않는다. Options의 `Create Sync Branch`를 사용자가 명시적으로 실행해야 한다.
- 같은 이름의 branch가 이미 있으면 branch 목록을 다시 불러와 기존 branch를 선택한다.

## Connection test는 통과하지만 sync commit이 실패함

Connection test는 read-only 검사다. 다음 write 조건은 실제 sync 때 별도로 실패할 수 있다.

- GitHub App의 `Contents: Read and write` permission이 빠짐
- 선택한 branch의 protection rule 또는 ruleset이 직접 ref update를 막음
- repository나 App 설치 범위가 로그인 후 변경됨
- GitHub API rate limit 또는 일시적 네트워크 장애

GitHub App permission과 설치 repository를 확인하고, 직접 commit이 허용된 별도 Sync Branch를 선택한 뒤 다시 시도한다. SolveSync는 branch protection을 우회하지 않는다.

## Accepted 뒤 toast 또는 commit이 없음

- Auto Sync가 켜져 있는지 확인한다.
- 지원 URL인지 확인한다.
  - `https://leetcode.com/problems/*`
  - `https://school.programmers.co.kr/learn/courses/*/lessons/*`
- Extension을 설치하거나 Reload하기 전에 이미 열려 있던 문제 탭은 새로고침한다.
- 현재 제출 언어가 Swift, Python3, Java, C++, JavaScript, TypeScript, Kotlin, Go, Rust 중 하나인지 확인한다.
- LeetCode에서 로그아웃되었거나 Accepted Submission code 조회가 실패하면 다시 로그인한다.
- Programmers editor 또는 Accepted UI가 변경되면 snapshot 추출이 실패할 수 있다. 현재 code를 별도로 보존하고 민감 정보 없이 Issue로 보고한다.

## Retry 버튼이 없거나 사라짐

- Retry는 GitHub commit 단계까지 필요한 data가 준비된 retry 가능한 실패에만 제공된다.
- Retry Bundle은 최대 20개이며 생성 후 7일에 만료한다.
- 만료 bundle은 cleanup alarm 또는 다음 Chrome/extension 활성화 시 local storage에서 삭제될 수 있다.
- Bundle이 없거나 만료되면 Options를 확인한 뒤 Coding Platform에서 다시 Accepted 제출을 만든다. 일반 수동 sync는 제공하지 않는다.

## 매우 큰 solution에서 storage 오류가 발생함

Chrome extension local storage와 GitHub API에는 크기 제한이 있다. 매우 큰 solution 때문에 Retry Bundle 저장이나 GitHub blob 생성이 실패할 수 있다.

- 원본 solution을 Coding Platform editor 밖의 안전한 로컬 파일에 먼저 보존한다.
- 같은 제출을 반복해 local storage를 채우지 않는다.
- Popup에 Retry가 없다면 solution을 사용자가 직접 GitHub에 반영한다.
- Issue에는 실제 solution 대신 재현에 필요한 대략적인 문자 수, 사용 언어, 표시된 normalized error code와 민감 정보가 제거된 메시지만 포함한다.

## 업데이트 뒤 extension이 두 개 보임

새 ZIP을 다른 경로에서 `Load unpacked`하면 별도 instance가 생길 수 있다.

1. 두 SolveSync instance의 `Details`에서 설치 경로와 version을 확인한다.
2. 유지할 instance 하나만 enabled 상태로 둔다.
3. 제거할 instance의 local Sync History나 Retry 상태가 필요하지 않은지 확인한다.
4. 불필요한 instance를 `Remove`한다. 제거한 instance의 extension local data는 복구되지 않는다.

다음 업데이트부터는 유지할 instance의 같은 설치 폴더 내용을 교체하고 `Reload`한다.

## GitHub 연결과 local data 삭제

- `Disconnect GitHub`: local auth session과 pending Device Flow만 삭제한다.
- `Delete Retry Data`: Retry Bundle을 삭제하고 Sync History의 retry action을 제거한다.
- `Delete all local data`: Options의 Data section에서 GitHub token, pending Device Flow, 설정, Sync History, Retry Bundle, lock과 처리 완료 기록을 삭제한다.
- Extension 제거: `chrome://extensions`에서 SolveSync를 `Remove`한다.
- GitHub authorization revoke 및 App uninstall: GitHub `Settings → Applications`에서 별도로 수행한다.
- 이미 생성된 GitHub commit은 자동 삭제되지 않는다.

자세한 범위는 [PRIVACY.md](../PRIVACY.md)를 확인한다.

## Issue 작성 전 안전한 진단 정보

[Bug report form](https://github.com/zaehorang/SolveSync/issues/new?template=bug_report.yml)에 다음 정보만 포함한다.

- SolveSync release version
- Chrome version과 OS
- LeetCode 또는 Programmers 중 영향을 받은 Coding Platform
- public/private 여부를 제외한 재현 단계
- Popup/Options에 표시된 normalized error code와 민감 정보가 제거된 메시지
- 예상 동작과 실제 동작

다음 값은 포함하지 않는다.

- GitHub access/refresh token
- Device Flow device code
- cookie 또는 session 값
- private repository URL
- private solution code

설치·설정 질문이나 공개 문서 오류는 [Docs or support question form](https://github.com/zaehorang/SolveSync/issues/new?template=docs_support.yml)을 사용한다.

보안 취약점은 공개 Issue 대신 [GitHub Private Vulnerability Reporting](https://github.com/zaehorang/SolveSync/security/advisories/new)을 사용한다.
