# GitHub App Setup

SolveSync local build를 소규모 tester에게 전달하기 전에 maintainer가 수행할 외부 설정이다. Extension에는 공개 client ID와 App slug만 포함하며 client secret, private key, backend는 사용하지 않는다.

## 1. Public GitHub App 등록

GitHub Settings의 Developer settings에서 새 GitHub App을 만든다.

- GitHub App name: tester가 알아볼 수 있는 이름
- Homepage URL: 프로젝트의 공개 안내 페이지
- Callback URL: Device Flow에서는 사용하지 않음
- Webhook: 비활성화
- Expire user authorization tokens: 활성화
- Device Flow: 활성화
- Where can this GitHub App be installed?: Any account

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

GitHub App General page의 공개 값을 입력한다.

```dotenv
VITE_GITHUB_APP_CLIENT_ID=Iv1.actual-public-client-id
VITE_GITHUB_APP_SLUG=actual-app-slug
```

`.env.local`은 gitignored file이다. 값을 바꾼 뒤 extension을 다시 build하고 Chrome에서 reload한다.

```bash
npm run typecheck
npm test
npm run build
```

## 3. Tester onboarding

1. Tester에게 build된 `dist`와 GitHub App install URL을 전달한다.
2. Tester는 Options에서 `Sign in with GitHub`를 누르고 GitHub의 device page에서 일회용 code를 승인한다.
3. `Install or configure GitHub App`에서 tester 본인이 소유한 test repository만 선택한다.
4. Options로 돌아와 Sync Repository를 불러오고 branch를 선택하거나 명시적으로 test branch를 만든다.
5. Connection test를 실행한다. 이 동작은 commit을 만들지 않는다.

Organization repository와 collaborator repository는 현재 제품 범위가 아니다.

## 4. Maintainer가 대신할 수 없는 검증

다음은 실제 tester 계정과 Coding Platform session이 필요하다.

- GitHub device approval와 App installation
- App 설치 repository만 picker에 보이는지 확인
- 로그인된 LeetCode/Programmers에서 실제 Accepted 제출

세부 시나리오는 `docs/MANUAL_VALIDATION.md`를 따른다. Issue, screenshot, log에는 access token, refresh token, device code, cookie, session 값, private solution code를 포함하지 않는다.
