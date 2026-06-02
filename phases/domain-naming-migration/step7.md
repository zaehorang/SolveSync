# Step 7: copy-and-doc-cleanup

## 읽을 파일

먼저 아래 파일을 읽고 지금까지의 migration 결과와 문서 계약을 확인한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/UI_GUIDE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/DEFERRED_WORK.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/shared/types.ts`
- `/src/shared/language.ts`
- `/src/shared/storageSchema.ts`
- `/src/shared/messages.ts`
- `/src/background/storage.ts`
- `/src/background/sync.ts`
- `/src/shared/i18n.ts`

수정하기 전에 Step 1-6의 summaries와 변경된 파일을 주의 깊게 읽는다.

## 작업

남은 transitional alias, stale naming, 문서/테스트 표현을 정리한다.

구현 요구사항:

- Remove transitional aliases that were allowed in earlier steps unless they are explicitly needed for legacy parser input types.
- `AGENTS.md` high-risk rules must use:
  - processed Sync Deduplication Key
  - storage-based Sync Deduplication Key lock
  - Retry Bundle
  - Solution Catalog projection
- Docs must describe:
  - v4 storage names
  - runtime message aliases as compatibility only
  - Solution Catalog v2 and retained `index.json` path
  - `Swift_Algorithm` catalog migration validation
- `docs/DEFERRED_WORK.md` should no longer present this naming migration as future work.
  - If any naming item remains intentionally deferred, state the exact leftover and reason.
- User-facing copy should avoid:
  - retry payload
  - sync identity
  - platform index
  - platform README
  - generic record where Sync History entry is intended.

Allowed stale terms:

- In explicit legacy migration parser/test descriptions.
- In `CONTEXT.md` `_Avoid_` lines.
- In ADR text where describing old names as the migration source.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
rg -n "SubmissionIdentity|SyncRecord|RetryPayload|retry payload|sync identity|platform index|platform README|selectedRepository|selectedBranch|history:read|retry-payloads:read|lastSubmissionId" src docs AGENTS.md CONTEXT.md
```

`rg` 결과는 allowed stale terms에만 남아야 한다.

## 검증

1. 인수 기준 command를 실행한다.
2. `docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`가 ADR template을 유지하는지 확인한다.
3. `docs/DEFERRED_WORK.md`가 architecture 문서처럼 변하지 않았는지 확인한다.
4. 이 step에 대해 `phases/domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "stale naming aliases, copy, and docs cleaned up after v4 migration"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Legacy parser support를 제거하지 말 것. 이유: 기존 local storage와 existing target catalog를 읽어야 한다.
- `CONTEXT.md`의 `_Avoid_` 목록을 stale-term audit 통과 목적으로 지우지 말 것. 이유: avoid list는 용어 가드레일이다.
- 새 제품 기능을 추가하지 말 것. 이유: 이 step은 cleanup과 consistency audit이다.
- 기존 test를 깨뜨리지 말 것.
