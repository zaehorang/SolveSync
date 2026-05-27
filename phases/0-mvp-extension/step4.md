# Step 4: github-client

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/src/shared/types.ts`
- `/src/shared/githubTree.ts`
- `/src/shared/readme.ts`
- `/src/shared/indexFile.ts`
- `/src/background/storage.ts`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 이전 step에서 작성된 storage와 shared sync logic을 주의 깊게 읽는다.

## 작업

GitHub API 실행 코드를 `src/background/client` 아래에 격리해 구현한다.

생성 또는 수정할 파일:

- `src/background/client/github.ts`
- `src/background/client/github.test.ts`
- 필요한 경우 `src/background/client/types.ts`
- 필요한 shared 타입 또는 error normalization 보강

필수 기능:

- PAT 기반 request helper. PAT는 함수 인자로 받고 로그나 error message에 노출하지 않는다.
- repository list 조회. pagination을 고려한다.
- branch list 조회.
- repository default branch 조회.
- branch create: 사용자가 명시적으로 요청한 경우 default branch HEAD에서 생성한다.
- connection test: repository 접근, branch ref 접근, commit에 필요한 Git data read 가능 여부 확인. test commit이나 branch update는 하지 않는다.
- Git Data API single commit:
  - branch ref 조회
  - base commit/tree 조회
  - solution, README, `.leetcode-sync/index.json` blob 생성
  - tree 생성
  - commit 생성
  - branch ref update
- branch ref update conflict 시 최신 branch 상태를 다시 읽고 README/index를 재생성해 한 번만 재시도할 수 있는 hook 또는 옵션 제공.

요구사항:

- Contents API로 여러 파일을 따로 commit하지 않는다.
- GitHub 폴더 생성 API를 만들지 않는다.
- branch protection ref update 실패는 우회하지 않고 normalized error로 반환한다.
- rate limit, auth failed, token expired, repo not found, branch not found, branch create failed, default branch unavailable, commit failed, conflict failed를 normalize한다.
- commit message 형식은 `solve: leetcode 0001 two sum in swift`를 생성할 수 있어야 한다.
- 테스트는 fetch mock으로 수행한다. 실제 GitHub API를 호출하지 않는다.

테스트:

- repository pagination
- branch create가 default branch HEAD를 사용
- connection test가 write request를 만들지 않음
- commit flow request 순서
- ref update conflict retry가 최대 1회
- branch protected/rate limited/auth 실패 normalize

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/0-mvp-extension/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "GitHub background client for repository, branch, connection test, branch create, and Git Data API commit flow"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- GitHub OAuth flow를 만들지 말 것. 이유: v1 범위 밖이다.
- selected repository를 코드 기본값으로 하드코딩하지 말 것. 이유: Options에서 사용자가 선택해야 한다.
- connection test에서 test commit, branch update, branch create 같은 write를 수행하지 말 것. 이유: PRD가 read-only test를 요구한다.
- PAT를 test fixture나 error detail에 넣지 말 것. 이유: CRITICAL 보안 규칙 위반이다.
- 기존 test를 깨뜨리지 말 것.
