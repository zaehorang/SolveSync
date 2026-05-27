# Step 1: shared-contracts

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/src/shared/index.ts`
- `/manifest.json`
- `/package.json`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 Step 0에서 작성된 scaffold를 주의 깊게 읽는다.

## 작업

공통 TypeScript 계약을 `src/shared` 아래에 정의한다. 이 step은 타입과 가벼운 type guard 중심이며 외부 API 호출을 구현하지 않는다.

생성 또는 수정할 파일:

- `src/shared/types.ts`
- `src/shared/messages.ts`
- `src/shared/storageSchema.ts`
- `src/shared/errors.ts`
- `src/shared/index.ts`
- 필요한 테스트 파일 `src/shared/*.test.ts`

필수 export:

- `SupportedLanguage = "swift" | "python3"`
- `LeetCodeLanguage` 또는 LeetCode response language를 표현하는 타입
- `ProblemMetadata`
- `AcceptedSubmission`
- `SubmissionIdentity`
- `RepositoryRef`
- `BranchRef`
- `SettingsState`
- `ProcessedSubmissionsState`
- `SyncHistoryState`
- `RetryPayloadsState`
- `InFlightSyncsState`
- `SyncRecord`
- `RetryPayload`
- `SyncStatus`
- `NormalizedErrorCode`
- runtime message discriminated unions:
  - content to background: accepted detected, toast action
  - popup/options to background: settings read/write, repository list, branch list, branch create, connection test, retry, history read
  - background to content/popup: sync status, history update

요구사항:

- 모든 storage top-level object는 `version` field를 포함한다.
- Runtime message payload에는 PAT, LeetCode cookie, session token을 포함하지 않는다.
- Error code는 `ARCHITECTURE.md`의 Error Model 목록을 빠짐없이 포함한다.
- `assertNever` 같은 exhaustiveness helper를 제공한다.
- API client 구현, storage adapter 구현, UI 렌더링은 하지 않는다.

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
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/0-mvp-extension/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "shared TypeScript contracts for storage, messages, sync records, and normalized errors"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `src/shared`에서 `fetch`를 직접 호출하지 말 것. 이유: ADR-011은 외부 API client를 background 아래에 격리한다.
- PAT를 runtime message payload 타입에 넣지 말 것. 이유: background가 storage에서 직접 읽어야 한다.
- 아직 존재하지 않는 UI state를 임의로 크게 설계하지 말 것. 이유: UI는 얇게 유지해야 한다.
- 기존 test를 깨뜨리지 말 것.
