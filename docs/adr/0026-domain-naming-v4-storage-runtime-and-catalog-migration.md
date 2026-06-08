# Domain naming v4 storage/runtime and catalog migration

결정: 표준 코드/domain 용어는 `CONTEXT.md`를 따른다. TypeScript와 runtime/storage naming은 `CodingPlatform`, `codingPlatform`, `SyncDeduplicationKey`, `syncDeduplicationKey`, `acceptedSourceId`, `SyncRepository`, `SyncBranch`, `SyncHistoryEntry`, `RetryBundle`, `ProgrammersAcceptedEditorSnapshot`을 새 계약으로 사용한다. `chrome.storage.local` schema는 v4로 migration하고, runtime message는 Sync History와 Retry Bundle 기준의 namespaced type과 field를 사용한다. Runtime message alias는 compatibility input으로만 유지하고 새 code는 v4 message를 emit한다. Solution Catalog는 v2 schema로 올려 language별 `lastAcceptedSourceId`를 저장하되 실제 파일 경로는 `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json`을 유지한다. Migration validation은 `your-name/algorithm-solutions` 같은 사용자가 선택한 Sync Repository의 검증 branch에서 수행하며, 특정 repository를 제품 기본값으로 고정하지 않는다.

이유: 코드와 문서가 서로 다른 이름으로 같은 개념을 부르면 storage migration, runtime message 변경, UI copy 정리가 반복적으로 깨진다. `CONTEXT.md`를 naming source of truth로 삼고 schema version을 올리면 legacy local state를 보존하면서 새 코드가 한 용어 체계로 수렴할 수 있다. Solution Catalog 파일 경로를 유지하면 사용자의 Sync Repository 구조와 기존 links를 깨지 않고 catalog entry 내부 schema만 개선할 수 있다.

트레이드오프: v4 migration은 legacy name을 읽는 backward-compatible parser와 테스트를 추가해야 하므로 단기 구현량이 늘어난다. Solution Catalog file name이 계속 `index.json`으로 남아 새 용어와 완전히 같지는 않지만, repository path 안정성과 기존 링크 보존을 우선한다. Migration validation은 사용자가 선택한 Sync Repository와 Sync Branch를 사용하므로 공개 문서에 특정 개인 repository를 검증 대상으로 고정하지 않는다.

## Legacy name 대응

| Legacy name | New name |
| --- | --- |
| `Platform` / `platform` | `CodingPlatform` / `codingPlatform` |
| `SubmissionIdentity` / `identity` / sync identity | `SyncDeduplicationKey` / `syncDeduplicationKey` |
| `submissionId` | `acceptedSourceId` |
| `RepositoryRef` / `BranchRef` / `selectedRepository` / `selectedBranch` | `SyncRepository` / `SyncBranch` / `syncRepository` / `syncBranch` |
| `SyncRecord` | `SyncHistoryEntry` |
| `RetryPayload` / retry payload / `retryPayloadId` | `RetryBundle` / `retryBundleId` |
| `ProgrammersAcceptedSnapshot` | `ProgrammersAcceptedEditorSnapshot` |
| `history:read` / `history:updated` | `sync-history:read` / `sync-history:updated` |
| `retry-payloads:read` | `retry-bundles:read` |
| Solution Catalog v1 `lastSubmissionId` | Solution Catalog v2 `lastAcceptedSourceId` |
| `processedSubmissions` storage key | `processedSyncDeduplicationKeys` storage key |
| `retryPayloads` storage key | `retryBundles` storage key |
| `inFlightSyncs` storage key | `syncDeduplicationKeyLocks` storage key |
