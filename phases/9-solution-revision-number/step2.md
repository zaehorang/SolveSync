# Step 2: commit-message-contract

## 읽을 파일

먼저 아래 파일을 읽고 GitHub commit contract와 Step 1의 catalog 결과 타입을 이해한다:

- `/docs/ARCHITECTURE.md`
- `/docs/adr/0007-github-git-data-api-for-single-commit.md`
- `/docs/adr/0027-solution-revision-numbered-commit-message.md`
- `/src/background/client/github.ts`
- `/src/background/client/github.test.ts`
- `/src/shared/solutionCatalog.ts`

수정하기 전에 Step 1에서 변경된 `src/shared/solutionCatalog.ts`와 테스트를 주의 깊게 읽는다.

## 작업

GitHub commit message가 Solution Revision Number를 필수로 받도록 contract를 변경한다.

- `src/background/client/github.ts`
  - `BuildGitHubCommitMessageInput`에 `solutionRevisionNumber: number`를 필수 field로 추가한다.
  - `buildGitHubCommitMessage(...)`가 기존 message 끝에 ` #n` suffix를 붙이도록 변경한다.
  - positive integer가 아닌 revision number를 받지 않도록 방어한다. throw 방식은 기존 error normalization과 typecheck에 맞게 단순하게 유지한다.
- `src/background/client/github.test.ts`
  - LeetCode와 Programmers commit message suffix `#n` 기대값을 추가한다.
  - 기존 call site가 `solutionRevisionNumber` 없이 컴파일되지 않도록 테스트 fixture를 갱신한다.

## 인수 기준

```bash
npm test -- --run src/background/client/github.test.ts
npm run typecheck
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `docs/adr/`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/9-solution-revision-number/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- commit message suffix를 UI copy helper에 넣지 말 것. 이유: commit message는 GitHub client/background sync contract다.
- revision number를 GitHub commit history scan으로 계산하지 말 것. 이유: source of truth는 Solution Catalog다.
- 기존 test를 깨뜨리지 말 것.
