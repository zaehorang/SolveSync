# Step 4: runtime-and-sync-core

## 읽을 파일

먼저 아래 파일을 읽고 background orchestration, runtime message, external API boundary를 이해한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0011-external-api-clients-in-background.md`
- `/docs/adr/0018-typed-runtime-message-union.md`
- `/docs/adr/0024-coding-platform-adapters-and-shared-sync-core.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/shared/types.ts`
- `/src/shared/messages.ts`
- `/src/shared/storageSchema.ts`
- `/src/background/storage.ts`
- `/src/background/runtime.ts`
- `/src/background/sync.ts`
- `/src/background/client/github.ts`
- `/src/background/client/leetcode.ts`
- `/src/shared/messages.test.ts`
- `/src/background/runtime.test.ts`
- `/src/background/sync.test.ts`
- `/src/background/client/github.test.ts`
- `/src/background/client/leetcode.test.ts`

수정하기 전에 Step 3에서 작성한 storage v4 public methods와 compatibility aliases를 확인한다.

## 작업

runtime message와 background sync core를 새 naming으로 정렬한다.

구현 요구사항:

- `src/shared/messages.ts`
  - `history:read` -> `sync-history:read`
  - `history:updated` -> `sync-history:updated`
  - `retry-payloads:read` -> `retry-bundles:read`
  - `RetrySyncMessage.payload.retryPayloadId` -> `retryBundleId`
  - responses use `RetryBundleSummary[]` and `SyncHistoryEntry[]`.
  - `isRuntimeMessage` must accept both new type strings and legacy aliases.
  - Add a normalizer function if useful, e.g. `normalizeRuntimeMessage(raw): RuntimeMessage | null`, so background can route legacy messages through new internal names.
- `src/background/runtime.ts`
  - Route only normalized new message names internally.
  - Legacy `history:read`, `history:updated`, `retry-payloads:read`, `retryPayloadId` are accepted at ingress but not emitted as new outgoing messages.
- `src/background/sync.ts`
  - Rename orchestration fields and outcomes:
    - `identity` -> `syncDeduplicationKey`
    - `record` -> `syncHistoryEntry` where the value is a Sync History item.
    - `retryPayload` -> `retryBundle`
    - `repository`/`branch` destination type names -> `syncRepository`/`syncBranch` where it represents the selected destination.
  - Use storage v4 method names from Step 3.
  - Use Solution Catalog v2 names from Step 1.
  - Preserve behavior: duplicate detection, in-flight lock, retry lifecycle, commit success marking.
- GitHub and LeetCode clients:
  - Use `SyncRepository`, `SyncBranch`, and `SyncDeduplicationKey` type names where appropriate.
  - Do not move API clients out of `src/background/client`.

Tests:

- Runtime tests cover new message names and legacy alias normalization.
- Sync tests use new field names and still cover LeetCode and Programmers success, duplicate, unsupported, retry success/failure.
- GitHub/LeetCode client tests compile and continue to validate API parsing behavior.

## 인수 기준

```bash
npm run typecheck
npm test -- src/shared/messages.test.ts src/background/runtime.test.ts src/background/sync.test.ts src/background/client/github.test.ts src/background/client/leetcode.test.ts
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `rg -n "history:read|history:updated|retry-payloads:read|retryPayloadId|RetryPayload|SyncRecord|SubmissionIdentity|\\bidentity\\b" src/shared/messages.ts src/background src/shared/messages.test.ts src/background/*.test.ts`를 실행한다.
   - 결과는 legacy alias handling/tests에만 남아야 한다.
3. 이 step에 대해 `phases/5-domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "runtime messages and background sync core migrated to Sync History and Retry Bundle naming"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Content script에서 GitHub API를 호출하게 만들지 말 것. 이유: external write는 background service worker 책임이다.
- Retry Bundle에 저장되는 solution code의 TTL/cap/disclosure 정책을 변경하지 말 것. 이유: privacy-sensitive state다.
- Legacy runtime message를 새 outgoing event로 다시 broadcast하지 말 것. 이유: internal contract는 v4 names여야 한다.
- 기존 test를 깨뜨리지 말 것.
