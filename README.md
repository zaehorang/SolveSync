# SolveSync

<p>
  <img src="assets/brand/solvesync-icon.svg" alt="SolveSync logo" width="96" height="96">
</p>

SolveSync는 LeetCode와 Programmers에서 Accepted 된 풀이를 사용자가 선택한 GitHub 저장소로 자동 동기화하는 local unpacked Chrome extension입니다.

문제를 푼 뒤 코드를 복사하고, 파일명을 정하고, GitHub에 commit하고, README 진행표를 갱신하는 반복 작업을 줄이기 위한 도구입니다. Accepted 결과가 감지되면 SolveSync가 Solution File, Solution README, Solution Catalog를 한 번의 GitHub commit으로 반영합니다.

<p>
  <img src="assets/readme/public-preview-flow.svg" alt="정답 결과가 선택한 GitHub 저장소로 자동 동기화되는 흐름" width="100%">
</p>

현재 상태는 GitHub Public Preview입니다. Chrome Web Store 배포판은 아니지만, [GitHub Releases](https://github.com/zaehorang/SolveSync/releases)에서 설치용 ZIP을 받을 수 있습니다.

## 다른 사람도 사용할 수 있나요?

네. 별도의 GitHub App을 만들거나 source를 직접 build할 필요 없이 공개 preview를 사용할 수 있습니다.

- 공개 Release ZIP에는 `.env` 파일이 아니라 SolveSync가 운영하는 public GitHub App의 공개 client ID와 slug가 반영된 build 결과만 포함됩니다. client secret은 포함되지 않습니다.
- 각 사용자는 GitHub 로그인 후 [SolveSync Preview GitHub App](https://github.com/apps/solvesync-preview/installations/new)을 본인이 소유한 repository에 직접 설치합니다.
- 아직 Chrome Web Store 배포판이 아니므로 Chrome의 Developer mode와 `Load unpacked`가 필요합니다.

사용 방식에 따른 build 설정 차이는 다음과 같습니다.

| 사용 방식 | `.env.local` | GitHub App 등록 |
| --- | --- | --- |
| 공개 Release ZIP 설치 | 필요 없음 | 필요 없음 |
| 기존 GitHub App 설정으로 source build | 필요 | 필요 없음. 사용할 App의 공개 client ID와 slug가 필요함 |
| 별도 App을 사용하는 fork/custom build | 필요 | build maintainer가 별도 public GitHub App을 등록해야 함 |

## 지원 범위

- LeetCode/Programmers Accepted solution sync
- 지원 언어: Swift, Python3, Java, C++, JavaScript, TypeScript, Kotlin, Go, Rust
- GitHub App Device Flow 로그인과 App 설치 repository 기반 Sync Repository/Sync Branch 선택
- Auto Sync, Sync History, Retry Bundle
- 별도 backend server 없음

지원하지 않는 범위:

- App이 설치되지 않은 repository와 organization/team workflow
- LeetCode/Programmers 문제 설명 전문 저장
- 일반 수동 sync. Retry는 retry 가능한 실패 항목에만 제공됩니다.

## 호환성과 제약

| 항목 | 현재 Public Preview 범위 |
| --- | --- |
| 브라우저 | Chrome 102 이상 desktop 버전. 최신 stable Chrome 사용을 권장합니다. Chrome for Android/iOS, Edge, Brave 등 Chromium 계열 브라우저는 검증 범위가 아닙니다. |
| 설치 방식 | GitHub Release ZIP을 Chrome Developer mode에서 `Load unpacked`로 로드합니다. Chrome Web Store 자동 업데이트는 제공하지 않습니다. |
| Coding Platform | `https://leetcode.com/problems/*`, `https://school.programmers.co.kr/learn/courses/*/lessons/*` 문제 페이지 |
| GitHub repository | 로그인한 개인 계정이 소유하고 SolveSync GitHub App을 설치한 repository. Organization 및 collaborator repository는 지원하지 않습니다. |
| GitHub branch | 기존 branch 또는 사용자가 Options에서 명시적으로 생성한 branch. Empty repository는 먼저 GitHub에서 initial commit과 default branch를 만들어야 합니다. |
| Branch protection | Connection test는 read-only 검사이므로 통과하더라도 branch protection이나 write rule이 실제 sync commit을 막을 수 있습니다. |

사이트 DOM이나 비공개 API가 바뀌면 Accepted 감지가 일시적으로 동작하지 않을 수 있습니다. 특히 Programmers는 Accepted 직후 현재 editor의 code snapshot을 사용합니다. 알려진 문제와 복구 방법은 [문제 해결 가이드](docs/TROUBLESHOOTING.md)를 확인하세요.

## 권한

SolveSync는 다음 Chrome extension 권한만 요청합니다.

| 권한 | 사용 목적 |
| --- | --- |
| `alarms` | 만료된 Retry Bundle을 하루에 한 번 정리하고 Chrome/extension 시작 시 cleanup 상태 복구 |
| `storage` | GitHub auth session, Sync Repository/Sync Branch 설정, Sync History, Retry Bundle, 중복 방지 상태를 extension local/session storage에 저장 |
| `https://leetcode.com/*` | 로그인된 LeetCode 세션으로 Accepted Submission metadata와 solution code 조회 |
| `https://school.programmers.co.kr/*` | Programmers 문제 페이지에서 Accepted 상태와 현재 editor snapshot 감지 |
| `https://github.com/*` | GitHub Device Flow 로그인과 GitHub App 설치/설정 페이지 연결 |
| `https://api.github.com/*` | repository/branch 조회와 사용자가 선택한 Sync Repository/Sync Branch에 sync commit 생성 |

Content script는 GitHub API를 직접 호출하지 않으며, GitHub write 대상은 Options에서 선택한 repository와 branch로 제한됩니다.

## Preview 설치

필요한 환경:

- Chrome 102 이상 최신 stable desktop Chrome
- 로그인된 LeetCode 또는 Programmers 계정
- initial commit과 default branch가 있는 본인 소유 GitHub repository

1. [GitHub Releases](https://github.com/zaehorang/SolveSync/releases)에서 최신 preview의 `solvesync-*.zip`을 내려받아 압축을 풉니다.
2. Chrome에서 `chrome://extensions`를 열고 Developer mode를 켭니다.
3. `Load unpacked`를 누르고 압축을 푼 폴더를 선택합니다. 폴더 바로 아래에 `manifest.json`이 있어야 합니다.
4. SolveSync Options에서 `Sign in with GitHub`를 누르고 GitHub에 표시된 일회용 code를 승인합니다.
5. `Install or configure GitHub App`을 눌러 동기화할 본인 소유 repository만 선택합니다.
6. Options로 돌아와 Sync Repository와 Sync Branch를 선택하고 connection test를 실행합니다. Connection test는 commit을 만들지 않습니다.

Chrome에서 확장 폴더를 삭제하면 로드할 수 없으므로, 압축을 푼 폴더는 계속 보관하세요.

## Preview 업데이트

Unpacked extension에는 자동 업데이트가 없습니다. 기존 local storage와 extension identity를 유지하려면 새 release를 다른 경로에서 다시 `Load unpacked`하지 말고 기존 폴더의 내용을 교체합니다.

1. `chrome://extensions`의 SolveSync 카드에서 현재 version과 설치 폴더를 확인합니다.
2. Auto Sync를 잠시 끄고 기존 확장 폴더를 rollback용으로 별도 보관합니다. 이 복사본에 token이나 private solution code가 포함된 것은 아니지만 외부에 공유하지 마세요.
3. 새 Release ZIP을 내려받아 별도 임시 폴더에 풉니다.
4. 기존 SolveSync 설치 폴더의 build 파일을 새 ZIP 내용으로 교체합니다. 폴더의 절대 경로는 바꾸지 않습니다.
5. `chrome://extensions`에서 SolveSync의 `Reload`를 누릅니다.
6. Options에서 기존 설정이 유지되는지 확인하고 read-only connection test를 다시 실행합니다.

새 경로에서 `Load unpacked`하면 Chrome이 별도 extension instance로 인식할 수 있습니다. 중복 instance가 동시에 Accepted를 감지하지 않도록 하나만 활성화하세요.

## Rollback

1. Auto Sync를 끕니다.
2. 같은 설치 폴더에 보관해 둔 이전 release 파일을 복원합니다.
3. `chrome://extensions`에서 `Reload`를 누르고 Options와 Popup 상태를 확인합니다.
4. rollback 뒤 설정을 읽지 못하거나 오류가 계속되면 이전 버전을 반복 실행하지 말고 최신 release로 돌아온 뒤 [GitHub Issue](https://github.com/zaehorang/SolveSync/issues)를 작성하세요.

Extension 파일 rollback은 이미 migration된 local storage나 GitHub commit을 되돌리지 않습니다. Preview 사이의 storage backward compatibility는 항상 보장되지 않으므로, 오래된 release로 rollback하기 전에 release note의 migration 안내를 확인하세요.

## 데이터 삭제와 연결 해제

- `Disconnect GitHub`는 local access/refresh token과 진행 중 Device Flow만 삭제합니다. Sync Repository/Sync Branch 설정, Sync History, Retry Bundle과 GitHub App 설치는 유지됩니다.
- Options의 `Delete Retry Data`는 Retry Bundle만 삭제합니다. Sync History는 유지되지만 해당 항목의 retry action은 제거됩니다.
- Options의 `Delete all local data`는 GitHub token, 진행 중 로그인, 설정, Sync History, Retry Bundle, lock과 처리 완료 기록을 이 Chrome profile에서 삭제합니다.
- Extension 자체도 제거하려면 `chrome://extensions`에서 SolveSync를 `Remove`합니다. 제거 또는 전체 삭제 전에 필요한 Sync History 정보가 있으면 secret과 private solution code를 제외하고 따로 기록하세요.
- GitHub 권한까지 회수하려면 GitHub `Settings → Applications`에서 SolveSync authorization을 revoke하고 `Installed GitHub Apps`에서 repository access를 제거하거나 App을 uninstall합니다.
- Extension 제거와 GitHub App uninstall은 이미 생성된 GitHub commit이나 solution file을 삭제하지 않습니다. 필요한 경우 사용자가 GitHub에서 직접 revert 또는 삭제해야 합니다.

세부 보관 기간과 삭제 범위는 [PRIVACY.md](PRIVACY.md)를 확인하세요.

## 개발자 빌드

source에서 직접 build하려면 Node.js `22.12.0`과 npm `10.9.0`이 필요합니다. 다른 버전은 현재 release build 검증 범위가 아닙니다.

```bash
git clone https://github.com/zaehorang/SolveSync.git
cd SolveSync
npm ci
cp .env.example .env.local
```

`.env.example`에는 동작하는 공식 App 설정값이 아니라 placeholder만 들어 있습니다. `.env.local`의 `VITE_GITHUB_APP_CLIENT_ID`, `VITE_GITHUB_APP_SLUG`를 이 build가 사용할 GitHub App의 공개 값으로 바꿔야 합니다.

- 공식 Release maintainer는 기존 SolveSync public GitHub App 값을 사용합니다.
- fork/custom build maintainer는 자신의 public GitHub App을 등록하고 그 값을 사용합니다.
- client secret은 필요하지 않으며 source나 환경변수에 입력하면 안 됩니다.

등록과 build 설정 절차는 [GitHub App 설정 가이드](docs/GITHUB_APP_SETUP.md)를 따릅니다.

```bash
npm run build
```

Chrome에서 `chrome://extensions`를 열고 Developer mode를 켠 뒤, `Load unpacked`로 생성된 `dist`를 선택합니다.

## GitHub App 설정

Release ZIP 사용자는 GitHub App을 새로 등록할 필요가 없습니다. 별도 App으로 배포용 build를 만드는 maintainer만 public GitHub App을 등록합니다.

- Device Flow 활성화
- Expiring user access token 활성화
- Repository permission: `Contents: Read and write`
- Repository permission: `Metadata: Read`
- 다른 사람이 설치할 수 있도록 `Where can this GitHub App be installed?`를 `Any account`로 설정
- 각 사용자는 실제로 동기화할 본인 소유 repository만 App 설치 대상으로 선택

확장을 로드한 사용자는 Options에서 `Sign in with GitHub`를 누르고 일회용 code를 승인한 뒤, `Install or configure GitHub App`으로 동기화할 repository를 선택합니다.

GitHub App 등록과 Device Flow 공식 설명은 [GitHub의 user access token 문서](https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)를 따르세요.

등록 값, 권한, tester onboarding 절차는 [docs/GITHUB_APP_SETUP.md](docs/GITHUB_APP_SETUP.md)에 정리되어 있습니다.

## 보안과 프라이버시 요약

- GitHub access token과 refresh token은 Chrome extension local storage에 저장됩니다. Device Flow의 pending device code는 session storage에만 저장됩니다.
- 실패 Retry Bundle은 Accepted solution code를 Chrome extension local storage에 임시 저장할 수 있습니다.
- Solution code는 사용자가 선택한 Sync Repository/Sync Branch로 GitHub sync commit을 만들 때만 전송됩니다.
- LeetCode/Programmers 문제 설명 전문은 저장하지 않습니다.
- SolveSync는 별도 backend server를 운영하지 않습니다.

자세한 내용은 [PRIVACY.md](PRIVACY.md)와 [SECURITY.md](SECURITY.md)를 확인하세요.

## 지원과 보안 제보

먼저 [문제 해결 가이드](docs/TROUBLESHOOTING.md)를 확인한 뒤 아래 form을 사용하세요.

- 재현 가능한 일반 bug: [Bug report](https://github.com/zaehorang/SolveSync/issues/new?template=bug_report.yml)
- 설치·설정 질문 또는 공개 문서 오류: [Docs or support question](https://github.com/zaehorang/SolveSync/issues/new?template=docs_support.yml)

보안 취약점은 공개 Issue 대신 [GitHub Private Vulnerability Reporting](https://github.com/zaehorang/SolveSync/security/advisories/new)을 사용합니다. 자세한 제보 범위와 처리 원칙은 [SECURITY.md](SECURITY.md)를 따릅니다.

지원하지 않는 내용:

- 개인 GitHub 계정 설정 대행
- GitHub token 값 검토
- private repository, LeetCode session, Programmers session 문제의 대리 디버깅
- issue, screenshot, logs에 포함된 secret 분석

Issue를 작성할 때 access token, refresh token, device code, cookie, session 값, private solution code를 포함하지 마세요.

## License

MIT License. See [LICENSE](LICENSE).
