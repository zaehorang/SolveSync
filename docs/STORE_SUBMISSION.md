# Chrome Web Store 제출 문안

> **Description**: Chrome Web Store Dashboard에 입력할 문구와 근거를 한곳에 둔다. 제출 전 실제 ZIP, UI, Privacy Policy와 대조한다.

상태: 초안. 프로젝트 소유자가 문구와 Dashboard 답변을 확인한 뒤 사용한다.

## Store Listing

| 항목 | 입력값 |
| --- | --- |
| 표시 이름 | `solve-sync` |
| Manifest 기본 locale | `en` (`manifest.json`의 `default_locale`) |
| 카테고리 | Developer Tools 후보. Dashboard의 실제 선택지에서 확인한다. |
| 기본 언어 | English (`default_locale`) |
| 추가 언어 | 한국어 (`_locales/ko`) |
| 공개 범위 | Public, 모든 지역, 무료. Dashboard에서 프로젝트 소유자가 확정한다. |
| 홈페이지 | `https://github.com/zaehorang/solve-sync` |
| 지원 | `https://github.com/zaehorang/solve-sync/issues` |
| 개인정보처리방침 | `https://github.com/zaehorang/solve-sync/blob/main/PRIVACY.md` |

짧은 설명은 Dashboard에 따로 입력하지 않는다. Chrome Web Store Listing은 패키지의 `manifest.json` description을 사용하며, 해당 값은 `_locales/<code>/messages.json`의 `extensionDescription`에서 온다. `default_locale`이 `en`이므로 Chrome 화면 언어가 `ko`이면 한국어, `en`이면 영어, 그 밖에는 영어가 표시된다. 한국어 Chrome 사용자는 한국어 Listing을 본다.

한국어 짧은 설명(`_locales/ko/messages.json`):

> LeetCode, Programmers, SWEA에서 Accepted 된 풀이를 선택한 GitHub 저장소에 자동 동기화합니다.

한국어 자세한 설명:

> solve-sync는 지원 Coding Platform에서 Accepted 된 풀이를 사용자가 고른 GitHub Sync Repository와 Sync Branch에 저장하는 Chrome 확장 프로그램입니다. LeetCode, Programmers, SWEA를 지원합니다. 동기화할 때 Solution File과 Solution Catalog를 갱신하고 Solution README에 진행 상황을 표시합니다.
>
> 사용자는 GitHub App Device Flow로 로그인하고, App을 설치한 본인 소유 저장소와 branch를 직접 선택합니다. Auto Sync를 끄거나 다시 켤 수 있으며 Popup에서 최근 Sync History와 실패 상세를 확인하고 retry 가능한 실패를 다시 시도할 수 있습니다.
>
> 풀이 코드는 동기화를 위해 선택한 GitHub 저장소에 전송됩니다. 로그인 token, 설정, 최근 기록과 실패 시 임시 Retry Bundle은 확장 프로그램의 저장소에서 처리됩니다. 별도 개발자 서버, 광고, 데이터 판매는 없습니다. 지원 Coding Platform의 문제 설명 전문은 저장하지 않습니다.
>
> 지원 언어와 플랫폼별 차이, GitHub App 권한, 데이터 처리와 삭제 방법은 홈페이지와 개인정보처리방침을 확인하세요. 본인이 소유하고 GitHub App을 설치한 저장소만 Sync Repository로 선택할 수 있습니다. SWEA는 C++14, JAVA, Python 3 풀이를 지원합니다.

English short description (`_locales/en/messages.json`):

> Sync accepted LeetCode, Programmers, and SWEA solutions to a GitHub repository you choose.

English detailed description:

> solve-sync saves accepted solutions from supported Coding Platforms to a GitHub repository and branch you choose. It supports LeetCode, Programmers, and SWEA. Each sync updates the solution file, Solution Catalog, and Solution README.
>
> Sign in through GitHub App Device Flow, install the App on a repository you own, and choose the Sync Repository and Sync Branch. You can pause Auto Sync, review recent Sync History in the popup, and retry eligible failures.
>
> Solution code is sent to the selected GitHub repository for sync. The extension handles authentication tokens, settings, recent history, and temporary Retry Bundles in extension storage. It has no developer-operated backend, advertising, or sale of user data. It does not store full Coding Platform problem statements.
>
> See the homepage and privacy policy for supported languages, GitHub App permissions, data handling, and deletion. Only repositories you own and have installed the GitHub App on can be selected. SWEA supports C++14, JAVA, and Python 3.

## Privacy 탭

Single purpose:

> Syncs solutions the user got Accepted on LeetCode, Programmers, and SWEA to the GitHub repository and branch the user selects, and shows sync status and retry in the popup.

Permission justification:

| Permission | Justification |
| --- | --- |
| `storage` | Stores GitHub connection state, user settings, Sync History, deduplication state, and expiring Retry Bundles. |
| `https://leetcode.com/*` | Reads the signed-in user's Accepted result and submission code. |
| `https://school.programmers.co.kr/*` | Reads Accepted transitions and the Accepted Editor Snapshot on problem pages. |
| `https://swexpertacademy.com/*` | Reads Accepted alerts and editor code on problem pages, and communicates with the MAIN world bridge. |
| `https://github.com/*` | Sends GitHub App Device Flow requests to `/login/device/code` and `/login/oauth/access_token` to obtain and refresh tokens. Chrome ignores paths in host permissions, so this permission authorizes both request paths. |
| `https://api.github.com/*` | Reads the selected repository and branch, then commits the Solution File, Solution Catalog, and Solution README. |

User data categories: Authentication information(GitHub App token, Device Flow state), Website content(solution code, problem metadata, and Accepted Editor Snapshot), Web history(synced problem page URLs). `User-generated content`는 Dashboard 항목이 아니므로 선택하지 않는다. Personally identifiable information도 선택하지 않는다. GitHub login은 표시용으로만 저장하며 이메일이나 실명은 저장하지 않는다.

데이터 전송: GitHub Device Flow와 GitHub API, LeetCode의 Accepted 제출 조회에 HTTPS를 사용한다. 선택한 Sync Repository로 solution code, 문제 metadata, 문제 URL이 포함된 Solution Catalog와 README를 commit한다. Programmers와 SWEA의 Accepted Editor Snapshot은 현재 문제 페이지에서 읽는다. 개발자 서버, 광고 플랫폼, 데이터 브로커로 전송하지 않는다.

Data usage certification: 사용자 데이터는 위 단일 목적과 그 보안·신뢰성 유지에 필요한 범위에서만 사용한다. 광고, 프로파일링, 판매에 사용하지 않는다. [Chrome Web Store Limited Use 정책](https://developer.chrome.com/docs/webstore/program-policies/limited-use/)을 준수한다. 실제 Dashboard의 certification 문구를 프로젝트 소유자가 검토한다.

Remote code: 사용하지 않는다. extension의 실행 코드는 제출 ZIP 안에 포함한다. 외부 서비스와 데이터 교환은 실행 코드 다운로드가 아니다.

## Reviewer test instructions

1. Open the extension's Options page and select `Sign in with GitHub`. Approve the one-time code on the GitHub Device Flow page. Reviewers may use their own GitHub account.
2. Select `Install or configure GitHub App`, then install the `solve-sync` App on a test repository you own. The App requires Metadata read and Contents read/write permissions.
3. Return to Options, select `Load Sync Repositories`, and choose that repository. Select an existing test branch, or explicitly select `Create Sync Branch` to create one. `Test connection` does not create a commit.
4. On a supported problem page while signed in to LeetCode, Programmers, or SWEA, submit an Accepted solution in a supported language. In the popup's Sync History, confirm the successful result and GitHub commit link.
5. Submit the same problem in another supported language and confirm that a language-specific Solution File is created while Solution README shows one problem row. Disconnect and reconnect GitHub; the selected repository and branch settings remain.
6. A real Coding Platform submission requires an account for that platform. If a reviewer test account is needed, the project owner provides it only in the Dashboard's private reviewer field. Do not put credentials in the repository, public description, or screenshots.

## 제출 전 대조

- Listing, `PRIVACY.md`, Options Security disclosure와 실제 ZIP이 같은 데이터 흐름을 설명한다.
- Privacy Policy URL을 로그아웃 상태에서 열 수 있다.
- 필요한 자산, 지역·가격·publisher 정보와 reviewer instructions를 Dashboard에서 확인한다.
- Live E2E와 `docs/MANUAL_VALIDATION.md`의 release smoke 결과를 확인한다.
