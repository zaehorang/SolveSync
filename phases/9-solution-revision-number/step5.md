# Step 5: integration-validation

## 읽을 파일

먼저 아래 파일을 읽고 전체 변경이 문서, shared logic, background orchestration에 일관되게 반영됐는지 확인한다:

- `/CONTEXT.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/adr/0027-solution-revision-numbered-commit-message.md`
- `/src/shared/solutionCatalog.ts`
- `/src/background/client/github.ts`
- `/src/background/sync.ts`
- `/src/shared/githubTree.ts`

수정하기 전에 Step 0-4의 변경 파일과 `phases/9-solution-revision-number/index.json` summary를 읽는다.

## 작업

전체 품질 검증과 마무리 조정을 수행한다.

- `rg`로 다음을 확인한다.
  - `buildGitHubCommitMessage(` call site가 모두 `solutionRevisionNumber`를 전달한다.
  - `SOLUTION_CATALOG_VERSION` 기대값과 테스트 fixture가 v3로 정렬됐다.
  - Retry 실행 path가 `RetryBundle.commitMessage`를 commit 생성 message로 사용하지 않는다.
  - Popup/Toast/README 렌더링에 Solution Revision Number가 표시되지 않는다.
- 필요한 최소 수정만 수행한다.
- docs와 tests가 구현과 어긋나면 source of truth 문서를 기준으로 구현 또는 테스트를 맞춘다.

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
   - `docs/adr/`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/9-solution-revision-number/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `dist/`, coverage output, build artifact를 커밋하지 말 것. 이유: AGENTS.md에서 금지한다.
- 수동 검증이 필요한 외부 GitHub/LeetCode/Programmers 상태를 자동 테스트로 가장하지 말 것. 이유: 실제 계정과 브라우저 세션이 필요한 검증은 `docs/MANUAL_VALIDATION.md`에 남긴다.
- 기존 test를 깨뜨리지 말 것.
