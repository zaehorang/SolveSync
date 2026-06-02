# Step 9: final-validation

## 읽을 파일

먼저 아래 파일을 읽고 전체 migration 계약과 이전 step 결과를 확인한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/UI_GUIDE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/DEFERRED_WORK.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/phases/domain-naming-migration/index.json`

수정하기 전에 Step 0-8 summaries와 live log가 남아 있다면 함께 확인한다.

## 작업

전체 migration 결과를 검증하고 작은 누락만 수정한다. 이 step에서 큰 refactor를 새로 시작하지 않는다.

검증 요구사항:

- SolveSync full gate:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Stale naming audit:
  - `SubmissionIdentity`
  - `SyncRecord`
  - `RetryPayload`
  - `retry payload`
  - `sync identity`
  - `platform index`
  - `platform README`
  - `selectedRepository`
  - `selectedBranch`
  - `history:read`
  - `retry-payloads:read`
  - `lastSubmissionId`
- Allowed occurrences:
  - explicit legacy migration tests/parser comments
  - `CONTEXT.md` avoid list
  - ADR migration source explanation.
- External repo verification:
  - `zaehorang/Swift_Algorithm` remote `main` has v2 catalogs.
  - Remote catalog JSON has `lastAcceptedSourceId`.
  - Remote catalog JSON has no `lastSubmissionId`.

If a small typo, import, test expectation, or doc stale term is found, fix it in this step. If a broad architectural issue is found, mark the step `blocked` with a precise reason instead of starting a new migration.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
rg -n "SubmissionIdentity|SyncRecord|RetryPayload|retry payload|sync identity|platform index|platform README|selectedRepository|selectedBranch|history:read|retry-payloads:read|lastSubmissionId" src docs AGENTS.md CONTEXT.md
gh api -H 'Accept: application/vnd.github.raw' 'repos/zaehorang/Swift_Algorithm/contents/leetcode/.leetcode-sync/index.json?ref=main'
gh api -H 'Accept: application/vnd.github.raw' 'repos/zaehorang/Swift_Algorithm/contents/programmers/.programmers-sync/index.json?ref=main'
```

## 검증

1. 인수 기준 command를 실행한다.
2. Stale naming audit 결과를 검토하고 allowed occurrence만 남았는지 확인한다.
3. `git status --short`를 확인한다.
4. 이 step에 대해 `phases/domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "full SolveSync gates passed and Swift_Algorithm catalog v2 remote state verified"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 이 step에서 새 naming 정책을 만들지 말 것. 이유: 정책은 Step 0 ADR과 architecture에 확정되어야 한다.
- 큰 refactor를 시작하지 말 것. 이유: final validation은 누락 보정과 검증 단계다.
- External repo의 README/solution files를 수정하지 말 것. 이유: Step 8과 같은 catalog-only scope를 유지해야 한다.
- 기존 test를 깨뜨리지 말 것.
