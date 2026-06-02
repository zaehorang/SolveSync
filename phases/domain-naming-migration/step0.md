# Step 0: docs-contracts

## 읽을 파일

먼저 아래 파일을 읽고 현재 제품 범위와 naming source of truth를 이해한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/DEFERRED_WORK.md`
- `/docs/UI_GUIDE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/adr/0008-solution-catalog-as-readme-source-of-truth.md`
- `/docs/adr/0016-processed-after-commit-success-only.md`
- `/docs/adr/0017-versioned-storage-schema.md`
- `/docs/adr/0018-typed-runtime-message-union.md`
- `/docs/adr/0024-coding-platform-adapters-and-shared-sync-core.md`

`docs/ADR.md`는 더 이상 source of truth가 아니다. ADR은 `docs/adr/` 아래 파일을 기준으로 읽는다.

## 작업

도메인 naming migration의 문서 계약을 먼저 확정한다.

수정할 문서:

- `docs/ARCHITECTURE.md`
- `docs/PRD.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/DEFERRED_WORK.md`
- `AGENTS.md`
- 새 ADR: `docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`

문서에 반영할 결정:

- 표준 코드/domain 용어는 `CONTEXT.md` 기준이다.
- TypeScript와 runtime/storage naming은 다음 방향으로 정렬한다:
  - `Platform`/`platform` -> `CodingPlatform`/`codingPlatform`
  - `SubmissionIdentity`/`identity` -> `SyncDeduplicationKey`/`syncDeduplicationKey`
  - `submissionId` -> `acceptedSourceId`
  - `RepositoryRef`/`BranchRef` -> `SyncRepository`/`SyncBranch`
  - `SyncRecord` -> `SyncHistoryEntry`
  - `RetryPayload` -> `RetryBundle`
  - `ProgrammersAcceptedSnapshot` -> `ProgrammersAcceptedEditorSnapshot`
- `chrome.storage.local` schema는 v4로 migration한다.
- Runtime message는 새 namespaced type으로 바꾼다:
  - `history:read` -> `sync-history:read`
  - `history:updated` -> `sync-history:updated`
  - `retry-payloads:read` -> `retry-bundles:read`
  - `retryPayloadId` -> `retryBundleId`
- Solution Catalog는 v2 schema로 올리고 `lastSubmissionId`를 `lastAcceptedSourceId`로 바꾼다.
- Solution Catalog 실제 파일 경로는 유지한다:
  - `leetcode/.leetcode-sync/index.json`
  - `programmers/.programmers-sync/index.json`
- `zaehorang/Swift_Algorithm`은 현재 Sync Repository이며, 이 migration에서 `main`에 직접 catalog v2 변경을 push한다.

`docs/DEFERRED_WORK.md`는 이번 phase로 해결할 항목과 남는 항목을 구분한다. 해결 예정 항목은 완료 예정/진행 중임을 명시하고, 구현 TODO를 `docs/ARCHITECTURE.md`에 넣지 않는다.

## 인수 기준

```bash
rg -n "docs/ADR.md|processedSubmissions|sync identity|retry payload|platform index" AGENTS.md docs
rg -n "lastSubmissionId|RetryPayload|SyncRecord|SubmissionIdentity|selectedRepository|selectedBranch|history:read|retry-payloads:read" docs AGENTS.md
```

위 `rg` 결과는 legacy migration 설명이나 명시적 old-name 대응 표에만 남아야 한다.

## 검증

1. 인수 기준 command를 실행한다.
2. 새 ADR이 다음 template을 따르는지 확인한다:
   - `# {decision title}`
   - `결정: ...`
   - `이유: ...`
   - `트레이드오프: ...`
3. 이 step에 대해 `phases/domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "domain naming migration docs and ADR contract established"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 제품 세부 규칙을 `AGENTS.md`에 장황하게 복제하지 말 것. 이유: source of truth는 `docs/`와 `CONTEXT.md`다.
- `docs/ARCHITECTURE.md`에 단순 TODO 목록을 넣지 말 것. 이유: architecture 문서는 runtime/storage/message 계약을 설명하는 문서다.
- `docs/ADR.md`를 되살리지 말 것. 이유: ADR source of truth는 `docs/adr/`다.
- 기존 test를 깨뜨리지 말 것.
