# Step 4: retry-recalculation

## 읽을 파일

먼저 아래 파일을 읽고 Retry Bundle storage compatibility와 retry 실행 흐름을 이해한다:

- `/docs/ARCHITECTURE.md`
- `/docs/PRD.md`
- `/docs/adr/0016-processed-after-commit-success-only.md`
- `/docs/adr/0027-solution-revision-numbered-commit-message.md`
- `/src/shared/types.ts`
- `/src/shared/storageSchema.ts`
- `/src/shared/storageSchema.test.ts`
- `/src/background/storage.ts`
- `/src/background/storage.test.ts`
- `/src/background/sync.ts`
- `/src/background/sync.test.ts`
- `/src/background/runtime.test.ts`

수정하기 전에 Step 3에서 변경된 `PreparedCommit`, `buildCommitPayload`, GitHub conflict payload contract를 주의 깊게 읽는다.

## 작업

Retry Bundle은 storage compatibility를 유지하되 retry 실행 시 저장된 commit message를 사용하지 않도록 정리한다.

- `src/shared/types.ts`, `src/shared/storageSchema.ts`
  - `RetryBundle.commitMessage` field는 유지한다.
  - parser/normalizer compatibility를 깨지 않되 새 retry 실행이 이 field에 의존하지 않게 한다.
- `src/background/sync.ts`
  - `makeRetryBundle(...)`은 compatibility field로 `commitMessage`를 채우되, 가능하면 legacy/placeholder message임이 코드 구조상 드러나게 한다.
  - `retryBundleToPreparedCommit(...)` 또는 equivalent flow에서 `commitMessage`를 PreparedCommit으로 되살리지 않는다.
  - Retry 성공 commit은 최신 Sync Branch의 Solution Catalog 기준으로 message를 재계산한다.
  - Retry 실패 후 저장되는 bundle도 solution code, paths, lastError, attempts, TTL/cap 정책을 유지한다.
- `src/background/sync.test.ts`
  - Retry 성공은 저장된 `RetryBundle.commitMessage`가 아니라 최신 Catalog 기준 message를 사용한다.
  - 최신 Catalog에서 같은 problem/language revision이 이미 올라간 상태라면 retry commit message가 다음 번호를 사용한다.
- 필요 시 `src/shared/storageSchema.test.ts`, `src/background/storage.test.ts`, `src/background/runtime.test.ts` fixture의 v3 Catalog 또는 commit message suffix 기대값을 갱신한다.

## 인수 기준

```bash
npm test -- --run src/background/sync.test.ts src/shared/storageSchema.test.ts src/background/storage.test.ts src/background/runtime.test.ts
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

- `RetryBundle.commitMessage` field를 제거하지 말 것. 이유: 기존 storage compatibility를 유지해야 한다.
- Retry Bundle을 Solution Catalog source of truth로 사용하지 말 것. 이유: revision은 최신 Sync Branch Catalog에서 계산해야 한다.
- 기존 test를 깨뜨리지 말 것.
