# 개인정보 처리 안내

- 시행일: 2026-07-29
- 최종 업데이트: 2026-07-29

이 문서는 GitHub Public Preview 상태의 SolveSync local unpacked Chrome extension이 처리하는 데이터, 전송 대상, 보관 기간과 삭제 방법을 설명합니다.

## 처리하는 데이터

SolveSync는 Accepted solution sync를 위해 다음 데이터를 처리할 수 있습니다.

- GitHub App access token, refresh token, token 만료 시각, 최소 account summary
- Device Flow 진행 중의 device code, user code, verification URL, 만료 시각
- Sync Repository와 Sync Branch 설정
- Auto Sync, language preference, connection status 같은 extension 설정
- LeetCode Accepted Submission metadata와 solution code
- Programmers Accepted Editor Snapshot의 problem metadata, language, solution code
- LeetCode/Programmers problem page URL
- Sync History
- Retry Bundle
- Sync Deduplication Key와 in-flight lock 같은 중복 방지 상태

SolveSync는 LeetCode/Programmers 문제 설명 전문을 저장하지 않습니다.

## 처리 목적

이 데이터는 다음 목적에만 사용합니다.

- GitHub Device Flow 로그인과 token refresh
- 사용자가 허용한 GitHub App 설치 repository 조회
- 사용자가 선택한 Sync Repository/Sync Branch로 Solution File, Solution README, Solution Catalog commit 생성
- 중복 sync 방지, 최근 sync 결과 표시와 retry 가능한 실패 복구
- 사용자가 선택한 Auto Sync 및 UI 설정 유지

## 저장 위치와 전송 대상

SolveSync는 extension 동작에 필요한 상태를 Chrome extension local storage에 저장합니다. Device Flow pending state는 Chrome extension session storage에 저장합니다. 이 storage는 일반 LeetCode/Programmers 페이지의 `localStorage`와 분리된 extension 전용 영역입니다.

SolveSync는 HTTPS를 통해 다음 대상과 통신합니다.

- GitHub web/API endpoints: Device Flow 로그인, token refresh, GitHub App 설치, repository/branch 조회, 사용자가 선택한 Sync Repository/Sync Branch의 sync commit
- LeetCode GraphQL endpoint: 로그인된 브라우저 세션에서 Accepted Submission metadata와 solution code 조회
- Programmers page: Accepted 직후 현재 editor의 Accepted Editor Snapshot 읽기

Solution code는 사용자가 선택한 Sync Repository/Sync Branch로 GitHub sync commit을 만들기 위해서만 GitHub로 전송됩니다.

SolveSync는 별도 backend server를 운영하지 않으며, maintainer가 사용자의 GitHub token이나 solution code를 별도 서버로 수집하지 않습니다.

## 보관 기간

- Device Flow pending state: 승인 완료, 거부, 만료 또는 `Disconnect GitHub` 실행 시 삭제합니다.
- GitHub auth session: 사용자가 `Disconnect GitHub`를 실행하거나 refresh 실패·만료를 extension이 확인해 재로그인이 필요해질 때 삭제합니다. GitHub가 부여한 token 만료 이후에는 해당 token을 인증에 사용할 수 없습니다.
- Sync History: 최신 20개 항목만 보관하며 새 항목이 추가되면 오래된 항목부터 제거합니다.
- Retry Bundle: 최대 20개이며 생성 후 7일에 만료합니다. retry 성공 시 즉시 삭제합니다. 만료 bundle은 새 sync/retry 조회 시와 `retry-bundle-prune` cleanup alarm에서 정리되며, Chrome이 종료되어 있었다면 다음 Chrome 또는 extension 활성화 시 삭제될 수 있습니다.
- In-flight Sync Deduplication Key lock: 10분 후 stale 상태로 간주하고 다음 cleanup 기회에 제거합니다.
- 설정과 processed Sync Deduplication Key: 사용자가 local extension data를 삭제하거나 extension을 제거할 때까지 보관합니다. 이 상태에는 GitHub token이나 solution code가 포함되지 않습니다.

## 삭제와 GitHub 권한 회수

`Disconnect GitHub`는 GitHub auth session과 진행 중 Device Flow만 삭제합니다. Sync Repository/Sync Branch 설정, Sync History, Retry Bundle, 중복 방지 상태와 GitHub App 설치는 유지됩니다.

모든 SolveSync local data를 삭제하려면 다음 절차를 사용합니다.

1. SolveSync Options의 Data section에서 `Delete all local data`를 실행합니다. 이 작업은 GitHub token, 진행 중 로그인, 설정, Sync History, Retry Bundle, lock과 처리 완료 기록을 현재 Chrome profile에서 삭제합니다.
2. Retry Bundle의 solution code만 먼저 삭제하려면 `Delete Retry Data`를 사용할 수 있습니다. Sync History는 유지되지만 해당 retry action은 제거됩니다.
3. Extension 자체도 제거하려면 Chrome `chrome://extensions`에서 SolveSync 카드의 `Remove`를 선택합니다.
4. GitHub 권한도 회수하려면 GitHub `Settings → Applications`에서 SolveSync authorization을 revoke합니다.
5. GitHub `Settings → Applications → Installed GitHub Apps`에서 repository access를 제거하거나 SolveSync App을 uninstall합니다.

Extension 제거, authorization revoke 또는 GitHub App uninstall은 이미 생성된 GitHub commit, Solution File, Solution README, Solution Catalog를 삭제하지 않습니다. 해당 데이터는 사용자의 GitHub repository에 남으며 필요한 경우 사용자가 직접 revert 또는 삭제해야 합니다.

## 공유와 판매

SolveSync는 사용자 데이터를 판매하거나 광고 목적으로 사용하지 않습니다.

SolveSync는 sync 기능 수행에 필요한 GitHub, LeetCode, Programmers 통신 외에 사용자 GitHub token, solution code, Sync History를 제3자에게 공유하지 않습니다.

## 문의

개인정보 안내의 오류, 삭제 절차 또는 일반 문의는 [GitHub Issues](https://github.com/zaehorang/SolveSync/issues)로 접수할 수 있습니다. Issue, screenshot, logs에는 access token, refresh token, device code, cookie, session 값, private repository URL, private solution code를 포함하지 마세요.

보안 취약점이나 공개하기 곤란한 내용은 공개 Issue 대신 [GitHub Private Vulnerability Reporting](https://github.com/zaehorang/SolveSync/security/advisories/new)을 사용하세요.
