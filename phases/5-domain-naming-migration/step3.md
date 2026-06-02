# Step 3: storage-schema-v4

## 읽을 파일

먼저 아래 파일을 읽고 storage migration과 TTL/cap 정책을 이해한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0016-processed-after-commit-success-only.md`
- `/docs/adr/0017-versioned-storage-schema.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/shared/types.ts`
- `/src/shared/storageSchema.ts`
- `/src/background/storage.ts`
- `/src/shared/storageSchema.test.ts`
- `/src/background/storage.test.ts`

수정하기 전에 Step 2에서 작성한 shared type rename과 transitional alias를 확인한다.

## 작업

`chrome.storage.local` schema를 v4로 올리고 storage naming을 새 도메인 용어로 정렬한다.

구현 요구사항:

- `STORAGE_SCHEMA_VERSION`을 `4`로 올린다.
- Top-level storage key rename:
  - `processedSubmissions` -> `processedSyncDeduplicationKeys`
  - `retryPayloads` -> `retryBundles`
  - `inFlightSyncs` -> `syncDeduplicationKeyLocks`
  - `syncHistory` key는 유지해도 되지만 state 내부 list는 `records` -> `entries`로 바꾼다.
- Settings state:
  - `selectedRepository` -> `syncRepository`
  - `selectedBranch` -> `syncBranch`
- State/interface rename:
  - `ProcessedSubmissionEntry` -> `ProcessedSyncDeduplicationKeyEntry`
  - `ProcessedSubmissionsState` -> `ProcessedSyncDeduplicationKeysState`
  - `RetryPayloadsState` -> `RetryBundlesState`
  - `InFlightSyncLock` -> `SyncDeduplicationKeyLock`
  - `InFlightSyncsState` -> `SyncDeduplicationKeyLocksState`
- Field rename:
  - `identity` -> `syncDeduplicationKey`
  - `processedAt` can remain `processedAt`.
  - Retry Bundle fields must use `solutionReadmePath` and `solutionCatalogPath`.
- Backward-compatible parser:
  - v1-v3 settings with `selectedRepository`/`selectedBranch` parse into v4 `syncRepository`/`syncBranch`.
  - v1-v3 processed entries with `identity.submissionId` parse into v4 `syncDeduplicationKey.acceptedSourceId`.
  - v1-v3 retry payloads parse into v4 retry bundles.
  - v1-v3 history `records` parse into v4 `entries`.
  - v1-v3 in-flight locks parse into v4 lock state.
  - malformed state still falls back only for the affected key.
- `src/background/storage.ts` public methods:
  - Rename methods to new domain names, e.g. `listProcessedSyncDeduplicationKeys`, `hasProcessedSyncDeduplicationKey`, `markSyncDeduplicationKeyProcessed`, `saveRetryBundle`, `listRetryBundles`, `getRetryBundle`, `removeRetryBundle`, `pruneRetryBundles`, `acquireSyncDeduplicationKeyLock`, `releaseSyncDeduplicationKeyLock`, `pruneSyncDeduplicationKeyLocks`.
  - Temporary method aliases are allowed only inside `createExtensionStorage` return object if later steps still need them.

Tests:

- Update storage schema tests for v4 default shapes.
- Add v1-v3 migration tests for settings, processed keys, sync history entries, retry bundles, and locks.
- Preserve retry bundle cap/TTL and in-flight lock TTL behavior.

## 인수 기준

```bash
npm run typecheck
npm test -- src/shared/storageSchema.test.ts src/background/storage.test.ts
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `rg -n "processedSubmissions|retryPayloads|inFlightSyncs|selectedRepository|selectedBranch|\\brecords\\b|identity|submissionId" src/shared/storageSchema.ts src/background/storage.ts src/shared/storageSchema.test.ts src/background/storage.test.ts`를 실행한다.
   - 결과는 explicit legacy migration handling에만 남아야 한다.
3. 이 step에 대해 `phases/5-domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "storage schema v4 added with renamed settings, deduplication key, retry bundle, and history state migration"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 기존 storage 값을 임의 삭제하는 migration을 만들지 말 것. 이유: 사용자의 local extension state를 보존해야 한다.
- Retry Bundle TTL 7일, cap 20개 정책을 바꾸지 말 것. 이유: solution code가 임시 저장될 수 있는 high-risk rule이다.
- GitHub commit 성공 전 processed로 기록하지 말 것. 이유: 실패 제출을 재시도할 수 있어야 한다.
- 기존 test를 깨뜨리지 말 것.
