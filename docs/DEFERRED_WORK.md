# Deferred Work

> **Description**: 지금 결정했지만 즉시 반영하지 않고 나중에 처리할 작업을 추적하는 문서다.

## 이번 phase에서 해결 중

Domain naming migration phase는 `CONTEXT.md`의 표준 용어를 문서, TypeScript identifier, runtime message, storage schema, UI copy에 반영한다. 아래 legacy name은 backward-compatible parser와 migration 설명에서만 유지하고, 새 write path와 새 문서는 v4/domain name을 사용한다.

| 영역 | Legacy name | v4/domain name | 상태 |
| --- | --- | --- | --- |
| Coding Platform | `Platform` / `platform` | `CodingPlatform` / `codingPlatform` | 이번 phase에서 정렬 |
| Sync Deduplication Key | `SubmissionIdentity` / `identity` / sync identity | `SyncDeduplicationKey` / `syncDeduplicationKey` | 이번 phase에서 정렬 |
| Accepted Source ID | `submissionId` | `acceptedSourceId` | 이번 phase에서 정렬 |
| Sync Repository / Sync Branch | `RepositoryRef` / `BranchRef` / `selectedRepository` / `selectedBranch` | `SyncRepository` / `SyncBranch` / `syncRepository` / `syncBranch` | 이번 phase에서 정렬 |
| Sync History | `SyncRecord` / `history:read` / `history:updated` | `SyncHistoryEntry` / `sync-history:read` / `sync-history:updated` | 이번 phase에서 정렬 |
| Retry Bundle | `RetryPayload` / retry payload / `retryPayloadId` / `retry-payloads:read` | `RetryBundle` / `retryBundleId` / `retry-bundles:read` | 이번 phase에서 정렬 |
| Accepted Editor Snapshot | `ProgrammersAcceptedSnapshot` | `ProgrammersAcceptedEditorSnapshot` | 이번 phase에서 정렬 |
| Solution Catalog v2 | `lastSubmissionId` | `lastAcceptedSourceId` | 이번 phase에서 정렬 |
| Processed keys storage | `processedSubmissions` | `processedSyncDeduplicationKeys` | 이번 phase에서 정렬 |
| Retry storage | `retryPayloads` | `retryBundles` | 이번 phase에서 정렬 |

## 남는 항목

- Solution Catalog 실제 파일 경로는 호환성을 위해 `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json`으로 유지한다. 파일명 변경은 이번 phase의 목표가 아니며, 필요하면 별도 ADR과 migration 계획으로 다룬다.
- `chrome.storage.local`의 기존 사용자 state는 v4 migration에서 보존한다. Legacy parser 제거는 migration 안정화 이후 별도 compatibility cleanup으로만 검토한다.
- Domain naming migration이 완료되면 이 문서는 새 deferred item만 남도록 정리한다.
