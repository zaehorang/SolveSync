# GitHub App Setup

SolveSync를 source에서 build하거나 Release ZIP으로 배포하기 전에 maintainer가 확인할 설정이다. Extension에는 공개 client ID와 App slug만 포함하며 client secret, private key, backend는 사용하지 않는다.

사용 방식별 요구사항:

| 사용 방식 | `.env.local` | GitHub App 등록 |
| --- | --- | --- |
| 공개 Release ZIP 설치 | 필요 없음 | 필요 없음 |
| 기존 GitHub App 설정으로 source build | 필요 | 필요 없음. 사용할 App의 공개 client ID와 slug가 필요함 |
| 별도 App을 사용하는 fork/custom build | 필요 | build maintainer가 등록 |

Release ZIP에는 `.env` 파일을 포함하지 않는다. Vite가 공개 client ID와 App slug를 compiled JavaScript에 반영하며, ZIP 사용자는 Options에서 GitHub 승인과 repository 설치만 수행한다.

## 1. Public GitHub App 등록

공식 Release maintainer가 기존 SolveSync App을 사용하는 경우에는 새 App을 등록하지 않는다. App을 교체하거나 fork/custom build에 별도 App을 사용하는 maintainer만 GitHub Settings의 Developer settings에서 새 GitHub App을 만든다.

- GitHub App name: 공식 App은 `SolveSync Preview`, fork/custom App은 구분 가능한 고유 이름
- Description: `Connect SolveSync to repositories you choose and sync accepted LeetCode and Programmers solutions from the Chrome extension.`
- Homepage URL: 공식 App은 `https://github.com/zaehorang/SolveSync`, fork/custom App은 해당 프로젝트 URL
- Callback URL: Device Flow에서는 사용하지 않음
- Webhook: 비활성화
- Expire user authorization tokens: 활성화
- Device Flow: 활성화
- Where can this GitHub App be installed?: Any account

Display information:

- Logo: `assets/github-app/solvesync-github-app-logo.png`
- Badge background color: `#F8FBFF`

GitHub App 이름을 변경하면 public slug가 바뀔 수 있다. 변경 후 General 화면의 public link를 확인하고 `.env.local`의 `VITE_GITHUB_APP_SLUG`를 새 slug로 갱신한 뒤 다시 build한다.

현재 preview App의 public slug는 `solvesync-preview`다.

Repository permissions:

- Contents: Read and write
- Metadata: Read-only
- 나머지 repository, organization, account permission: No access

Private key를 생성할 필요가 없다. Client secret도 extension 설정이나 source에 넣지 않는다.

공식 문서:

- [GitHub App 생성](https://docs.github.com/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
- [Device Flow user access token](https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [User access token refresh](https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)

## 2. Local build 설정

```bash
cp .env.example .env.local
```

`.env.example`에는 placeholder만 있으며 clone 직후 상태로는 GitHub 로그인을 사용할 수 없다. GitHub App General page에서 이 build가 사용할 App의 공개 값을 `.env.local`에 입력한다.

```dotenv
VITE_GITHUB_APP_CLIENT_ID=your-public-client-id
VITE_GITHUB_APP_SLUG=actual-app-slug
```

공식 Release maintainer는 기존 SolveSync App 값을 사용한다. fork/custom build maintainer는 1절에서 준비한 App 값을 사용한다. 두 값은 공개 식별자이지만 `.env.local`은 gitignored file이며 client secret은 어떤 환경변수에도 넣지 않는다.

값을 바꾼 뒤 extension을 다시 build하고 Chrome에서 reload한다.

```bash
npm run typecheck
npm test
npm run build
```

## 3. Release ZIP 생성

```bash
npm run package:chrome
```

패키징 script는 두 공개 환경변수가 설정되었는지, 해당 값이 build JavaScript에 포함되었는지 확인한다. 생성된 ZIP에는 `.env`, `.env.local`, source, docs를 포함하지 않는다.

## 4. Tester onboarding

1. Tester는 GitHub Releases에서 최신 `solvesync-*.zip`을 내려받고 압축을 푼다.
2. Chrome의 Developer mode에서 `Load unpacked`로 압축을 푼 폴더를 로드한다.
3. Options에서 `Sign in with GitHub`를 누르고 GitHub의 device page에서 일회용 code를 승인한다.
4. `Install or configure GitHub App`에서 tester 본인이 소유한 test repository만 선택한다.
5. Options로 돌아와 Sync Repository를 불러오고 branch를 선택하거나 명시적으로 test branch를 만든다.
6. Connection test를 실행한다. 이 동작은 commit을 만들지 않는다.

Organization repository와 collaborator repository는 현재 제품 범위가 아니다.

## 5. Maintainer가 대신할 수 없는 검증

다음은 실제 tester 계정과 Coding Platform session이 필요하다.

- GitHub device approval와 App installation
- App 설치 repository만 picker에 보이는지 확인
- 로그인된 LeetCode/Programmers에서 실제 Accepted 제출

세부 시나리오는 `docs/MANUAL_VALIDATION.md`를 따른다. Issue, screenshot, log에는 access token, refresh token, device code, cookie, session 값, private solution code를 포함하지 않는다.
