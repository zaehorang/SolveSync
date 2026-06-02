# Step 2: shared-domain-types

## 읽을 파일

먼저 아래 파일을 읽고 shared type boundary와 previous step output을 이해한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0024-coding-platform-adapters-and-shared-sync-core.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/shared/types.ts`
- `/src/shared/language.ts`
- `/src/shared/platformPolicy.ts`
- `/src/shared/messages.ts`
- `/src/shared/storageSchema.ts`
- `/src/shared/types.test.ts`
- `/src/shared/language.test.ts`
- `/src/shared/platformPolicy.test.ts`
- `/src/shared/index.ts`
- `/src/shared/solutionCatalog.ts`

수정하기 전에 Step 1에서 작성한 Solution Catalog v2 code를 확인한다.

## 작업

shared domain type과 guard naming을 `CONTEXT.md` 기준으로 정렬한다. 이 step은 shared layer 중심이며, 아직 모든 caller rename을 끝내지 않아도 된다. 다만 repository는 typecheck가 통과해야 한다.

구현 요구사항:

- `src/shared/types.ts`
  - `Platform` -> `CodingPlatform`
  - `SubmissionIdentity` -> `SyncDeduplicationKey`
  - `RepositoryRef` -> `SyncRepository`
  - `BranchRef` -> `SyncBranch`
  - `SyncRecord` -> `SyncHistoryEntry`
  - `RetryPayload` -> `RetryBundle`
  - `RetryPayloadSummary` -> `RetryBundleSummary`
- Field rename:
  - `platform` -> `codingPlatform`
  - `identity` -> `syncDeduplicationKey`
  - `submissionId` -> `acceptedSourceId`
  - `repository` fields that mean selected destination may remain `repository` inside GitHub client inputs, but shared destination type name must be `SyncRepository`.
- Guard/function rename:
  - `isPlatform` -> `isCodingPlatform`
  - `isSubmissionIdentity` -> `isSyncDeduplicationKey`
  - `isRepositoryRef` -> `isSyncRepository`
  - `isBranchRef` -> `isSyncBranch`
  - `isSyncRecord` -> `isSyncHistoryEntry`
  - `isRetryPayload` -> `isRetryBundle`
  - `buildSubmissionIdentity` -> `buildSyncDeduplicationKey`
- Value strings stay unchanged:
  - `"leetcode"`
  - `"programmers"`
  - Programmers accepted source id format, e.g. `programmers:{lessonId}:{language}:{codeHash}`
- To keep the step buildable, temporary deprecated type aliases are allowed only in `src/shared/types.ts` and `src/shared/language.ts`.
  - Alias comments must say they are transitional for this phase.
  - Later cleanup steps must remove aliases when callers are migrated.

Tests:

- Update shared type and language tests to use new names.
- Add guard tests proving v4 shape accepts `codingPlatform`, `acceptedSourceId`, and rejects legacy-only shape unless the storage migration parser handles it.

## 인수 기준

```bash
npm run typecheck
npm test -- src/shared/types.test.ts src/shared/language.test.ts src/shared/platformPolicy.test.ts src/shared/solutionCatalog.test.ts
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `rg -n "SubmissionIdentity|buildSubmissionIdentity|isSubmissionIdentity|\\bPlatform\\b|RepositoryRef|BranchRef|SyncRecord|RetryPayload" src/shared`를 실행한다.
   - 결과는 transitional alias 또는 legacy migration parser/test에만 남아야 한다.
3. 이 step에 대해 `phases/domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "shared domain types renamed with transitional aliases for remaining callers"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `"leetcode"` 또는 `"programmers"` value string을 바꾸지 말 것. 이유: existing storage, URLs, target paths, policy keys가 이 값을 사용한다.
- Programmers accepted source id 값 자체를 다시 계산하거나 변경하지 말 것. 이유: deduplication compatibility를 보존해야 한다.
- 임시 alias를 shared 외부 파일에 흩뿌리지 말 것. 이유: cleanup 범위를 통제해야 한다.
- 기존 test를 깨뜨리지 말 것.
