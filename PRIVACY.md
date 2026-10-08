# solve-sync Privacy Policy / 개인정보처리방침

solve-sync는 LeetCode, Programmers, SWEA에서 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소와 branch에 동기화하는 Chrome 확장 프로그램입니다. 이 방침은 확장 프로그램이 처리하는 데이터와 보관·전송·삭제 방법을 설명합니다.

## 처리하는 데이터와 목적

- GitHub App 로그인에 필요한 access token, refresh token, 만료 시각, 최소 계정 정보와 진행 중인 Device Flow 상태
- 사용자가 선택한 Sync Repository와 Sync Branch, Auto Sync와 언어 설정, 연결 상태
- 지원 Coding Platform의 Accepted 결과, 문제 식별 정보와 URL, 언어, solution code
- Sync History, 중복 처리 상태, 실패한 동기화를 다시 시도하기 위한 Retry Bundle

이 데이터는 Accepted 풀이의 동기화, 연결 확인, 중복 방지, 상태 표시와 실패 복구에만 사용합니다. 지원 Coding Platform의 문제 설명 전문은 저장하지 않습니다.

## 저장과 보관

GitHub access token과 refresh token, 설정, Sync History, 중복 처리 상태와 Retry Bundle은 Chrome 확장 프로그램의 local storage에 저장됩니다. Chrome 확장 프로그램 저장소는 디스크 암호화 저장소가 아니므로 공유 컴퓨터와 Chrome 프로필 접근에 주의하세요. Device Flow 진행 중의 device code는 extension session storage에만 저장하며 완료, 거부, 만료 또는 연결 해제 시 삭제합니다.

Retry Bundle에는 Accepted solution code가 임시로 들어갈 수 있습니다. Retry Bundle은 최대 20개, 최대 7일 보관하며 성공적으로 재시도하면 삭제합니다. Sync History는 최근 20개를 보관합니다. 중복 처리 기록은 최대 100개, 최대 7일 보관합니다.

## 전송과 공유

GitHub App 로그인과 token 갱신, 사용자가 고른 저장소와 branch 조회, Solution File·Solution Catalog·Solution README commit에는 GitHub의 HTTPS endpoint를 사용합니다. LeetCode의 Accepted 제출 정보와 code 조회에도 HTTPS를 사용합니다. Programmers와 SWEA의 Accepted Editor Snapshot은 사용자가 열어 둔 문제 페이지에서 읽습니다. SWEA editor bridge는 code string만 전달하며 token, cookie 또는 session 값은 전달하지 않습니다.

Solution code와 문제 식별 정보 및 URL은 동기화를 위해 사용자가 선택한 GitHub 저장소로 전송됩니다. 저장소의 공개 범위에 따라 해당 commit을 다른 사람이 볼 수 있습니다. solve-sync 개발자는 별도 backend를 운영하지 않으며 사용자 token, solution code 또는 Sync History를 개발자 서버로 수집하지 않습니다. 사용자 데이터를 판매하거나 광고, 프로파일링에 사용하지 않습니다.

## 삭제

Options에서 GitHub 연결을 해제하면 저장된 GitHub access token과 refresh token, 진행 중인 Device Flow 정보가 삭제됩니다. 확장 프로그램을 제거하면 설정, Sync History, 중복 처리 상태와 Retry Bundle을 포함한 나머지 로컬 데이터 전체가 삭제됩니다. GitHub 저장소에 이미 commit한 풀이와 Coding Platform 계정의 제출 기록은 확장 프로그램 제거로 지워지지 않으며 해당 서비스에서 직접 관리해야 합니다.

## Chrome Web Store Limited Use

solve-sync는 [Chrome Web Store User Data Policy의 Limited Use 요건](https://developer.chrome.com/docs/webstore/program-policies/limited-use/)을 따릅니다. 사용자 데이터는 이 확장 프로그램의 공개된 풀이 동기화 기능을 제공·유지·보호하는 데 필요한 범위에서만 사용하고, 그 기능에 필요한 GitHub·Coding Platform 통신 외에 전송하지 않습니다. 개인화·리타기팅·관심 기반 광고에 사용하지 않습니다. 개발자가 사용자 데이터를 열람하지 않으며, 사용자가 특정 지원 요청을 위해 동의하거나 법적·보안상 필요한 경우 등 정책이 허용하는 예외만 적용합니다.

## 문의

문제와 개인정보 관련 문의는 [GitHub Issues](https://github.com/zaehorang/solve-sync/issues)로 접수할 수 있습니다. 공개 issue에는 token, cookie, device code 또는 비공개 solution code를 넣지 마세요.

---

# English

solve-sync is a Chrome extension that syncs accepted LeetCode, Programmers, and SWEA solutions to a GitHub repository and branch selected by the user.

## Data and purposes

The extension processes GitHub App access and refresh tokens, expiry times, minimal account details, and pending Device Flow state; the selected repository and branch, extension settings and connection status; accepted result metadata, problem identifiers and URLs, languages, and solution code; and Sync History, deduplication state, and Retry Bundles. It uses this data only to sync accepted solutions, check the connection, avoid duplicate processing, show status, and recover eligible failures. It does not store full problem statements.

## Storage and retention

GitHub tokens, settings, Sync History, deduplication state, and Retry Bundles are stored in Chrome extension local storage. Extension storage is not an encrypted vault; take care with shared computers and access to your Chrome profile. A pending Device Flow device code is stored only in extension session storage and removed on completion, denial, expiry, or disconnect.

A Retry Bundle may temporarily contain accepted solution code. Up to 20 bundles are retained for at most 7 days, and a bundle is removed after a successful retry. Sync History retains the latest 20 entries. Deduplication records retain up to 100 entries for at most 7 days.

## Transfers and sharing

The extension uses GitHub HTTPS endpoints for GitHub App sign-in and token refresh, repository and branch lookup, and commits of Solution Files, the Solution Catalog, and the Solution README. It uses HTTPS to retrieve accepted submission data and code from LeetCode. Programmers and SWEA Accepted Editor Snapshots are read from the problem page open in the user's browser. The SWEA editor bridge transfers only the code string, never tokens, cookies, or session values.

Solution code, problem identifiers, and URLs are sent to the selected GitHub repository for syncing. Other people may see those commits depending on the repository's visibility. The developer operates no separate backend and does not collect user tokens, solution code, or Sync History on a developer server. User data is not sold or used for advertising or profiling.

## Deletion

Disconnecting GitHub in Options deletes the stored GitHub access token and refresh token, plus any pending Device Flow state. Removing the extension deletes all remaining local data, including settings, Sync History, deduplication state, and Retry Bundles. These actions do not delete commits already made in a GitHub repository or submissions recorded by a Coding Platform; manage those records with the corresponding service.

## Chrome Web Store Limited Use

solve-sync complies with the [Chrome Web Store User Data Policy Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/limited-use/). User data is used only as needed to provide, maintain, and secure its disclosed solution sync function and is transferred only for the necessary GitHub and Coding Platform interactions. It is never used for personalized, retargeted, or interest-based advertising. The developer does not read user data except in cases allowed by the policy, such as consent for a specific support request or legal or security needs.

## Contact

Contact the developer through [GitHub Issues](https://github.com/zaehorang/solve-sync/issues). Do not post tokens, cookies, device codes, or private solution code in a public issue.
