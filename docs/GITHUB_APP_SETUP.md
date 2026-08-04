# GitHub App Setup

SolveSync Release ZIP을 만들기 전에 maintainer가 수행할 외부 설정이다. Extension에는 공개 client ID와 App slug만 포함하며 client secret, private key, backend는 사용하지 않는다. Release ZIP 사용자는 별도의 GitHub App을 등록하지 않는다.

## 1. Public GitHub App 등록

GitHub Settings의 Developer settings에서 새 GitHub App을 만든다.

- GitHub App name: `SolveSync Preview`
- Description: `Connect SolveSync to repositories you choose and sync accepted LeetCode and Programmers solutions from the Chrome extension.`
- Homepage URL: `https://github.com/zaehorang/SolveSync`
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

### 기존 설치의 권한 변경 승인

GitHub App의 repository permission을 추가하거나 접근 수준을 높여도 기존 installation에는 즉시 적용되지 않는다. 각 installation 소유자가 GitHub의 `Settings → Applications → Installed GitHub Apps → SolveSync Preview → Configure`에서 대기 중인 권한 변경을 승인해야 한다. 확장에서 Device Flow 로그인을 다시 진행하는 것만으로는 installation permission이 갱신되지 않는다.

승인 후에도 `POST .../git/blobs: Resource not accessible by integration`이 발생하면 다음을 확인한다.

1. 설치된 App의 권한에 `Contents: Read and write`가 표시되는지 확인한다.
2. Repository access에 실제 Sync Repository가 포함되어 있는지 확인한다.
3. 설정이 모두 맞아도 실패하면 기존 installation을 제거하고 대상 repository를 선택해 다시 설치한 뒤, 확장에서 다시 로그인한다.

권한을 변경한 Release는 기존 tester의 승인 완료 여부와 새 tester의 신규 설치 흐름을 모두 검증한다. 자세한 동작은 [GitHub의 권한 변경 승인 안내](https://docs.github.com/apps/using-github-apps/approving-updated-permissions-for-a-github-app)를 따른다.

공식 문서:

- [GitHub App 생성](https://docs.github.com/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
- [Device Flow user access token](https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [User access token refresh](https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)

## 2. Local build 설정

```bash
cp .env.example .env.local
```

GitHub App General page의 공개 값을 입력한다.

```dotenv
VITE_GITHUB_APP_CLIENT_ID=your-public-client-id
VITE_GITHUB_APP_SLUG=actual-app-slug
```

`.env.local`은 gitignored file이다. 값을 바꾼 뒤 extension을 다시 build하고 Chrome에서 reload한다.

```bash
npm run typecheck
npm test
npm run build
```

## 3. Tester onboarding

1. Tester는 GitHub Releases에서 최신 `solvesync-*.zip`을 내려받고 압축을 푼다.
2. Chrome의 Developer mode에서 `Load unpacked`로 압축을 푼 폴더를 로드한다.
3. Options에서 `Sign in with GitHub`를 누르고 GitHub의 device page에서 일회용 code를 승인한다.
4. `Install or configure GitHub App`에서 tester 본인이 소유한 test repository만 선택한다.
5. Options로 돌아와 Sync Repository를 불러오고 branch를 선택하거나 명시적으로 test branch를 만든다.
6. Connection test를 실행한다. 이 동작은 commit을 만들지 않는다.

Organization repository와 collaborator repository는 현재 제품 범위가 아니다.

## 4. Maintainer가 대신할 수 없는 검증

다음은 실제 tester 계정과 Coding Platform session이 필요하다.

- GitHub device approval와 App installation
- App 설치 repository만 picker에 보이는지 확인
- 로그인된 LeetCode/Programmers에서 실제 Accepted 제출

세부 시나리오는 `docs/MANUAL_VALIDATION.md`를 따른다. Issue, screenshot, log에는 access token, refresh token, device code, cookie, session 값, private solution code를 포함하지 않는다.
