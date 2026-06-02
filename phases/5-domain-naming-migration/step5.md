# Step 5: ui-surfaces

## 읽을 파일

먼저 아래 파일을 읽고 Options, Popup, Toast의 copy와 state model을 이해한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/UI_GUIDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/shared/types.ts`
- `/src/shared/storageSchema.ts`
- `/src/shared/messages.ts`
- `/src/shared/uiModels.ts`
- `/src/shared/i18n.ts`
- `/src/options/index.ts`
- `/src/popup/index.ts`
- `/src/content/toast.ts`
- `/src/options/options.test.ts`
- `/src/options/index.test.ts`
- `/src/popup/popup.test.ts`
- `/src/popup/index.test.ts`
- `/src/content/toast.test.ts`
- `/src/shared/uiModels.test.ts`

수정하기 전에 Step 4에서 작성한 runtime message names와 background outputs를 확인한다.

## 작업

UI surface와 view model을 v4 naming으로 정렬한다.

구현 요구사항:

- Options:
  - `selectedRepository`/`selectedBranch` state naming을 `syncRepository`/`syncBranch`로 바꾼다.
  - Public settings update/read shapes use v4 names.
  - UI copy는 사용자가 이해하는 `Sync Repository`, `Sync Branch` 기준으로 정리한다.
- Popup:
  - `historyRecords`/`record` implementation naming을 `syncHistoryEntries`/`entry` 또는 `syncHistoryEntry`로 바꾼다.
  - `retryPayloads`/`retryPayloadId`를 `retryBundles`/`retryBundleId`로 바꾼다.
  - New runtime messages `sync-history:read`, `retry-bundles:read`, `sync-history:updated`를 사용한다.
- Toast/view models:
  - `SyncRecord` type reference를 `SyncHistoryEntry`로 바꾼다.
  - Retry action payload uses `retryBundleId`.
- i18n:
  - User-facing English/Korean copy에서 “retry payload”를 “Retry Bundle” 또는 자연스러운 한국어 표현으로 바꾼다.
  - “record(s)”가 Sync History count를 뜻하는 경우 “sync(s)” 또는 “history item(s)”처럼 더 직관적인 표현으로 바꾼다.
  - UI에 storage/internal implementation term을 노출하지 않는다.

Tests:

- Options tests cover syncRepository/syncBranch state.
- Popup tests cover retry bundle availability and Sync History rendering.
- Toast/UI model tests use SyncHistoryEntry and retryBundleId.

## 인수 기준

```bash
npm run typecheck
npm test -- src/options/options.test.ts src/options/index.test.ts src/popup/popup.test.ts src/popup/index.test.ts src/content/toast.test.ts src/shared/uiModels.test.ts
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `rg -n "selectedRepository|selectedBranch|retry payload|Retry payload|retryPayload|SyncRecord|historyRecords|\\brecords\\b|\\brecord\\b" src/options src/popup src/content src/shared/i18n.ts src/shared/uiModels.ts`를 실행한다.
   - 결과는 DOM class/id like `history-list` 또는 explicit legacy tests가 아닌 이상 제거해야 한다.
3. 이 step에 대해 `phases/5-domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "options, popup, toast, i18n, and UI models migrated to sync destination, Sync History, and Retry Bundle naming"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- UI에 technical storage key 이름을 노출하지 말 것. 이유: 사용자는 storage schema가 아니라 Sync Repository/Retry Bundle/Sync History를 이해해야 한다.
- Popup에 일반 수동 sync action을 추가하지 말 것. 이유: v1 manual action은 retry 가능한 실패에만 제공된다.
- DOM class/id를 불필요하게 전부 rename하지 말 것. 이유: CSS/test churn을 줄이고 user-facing naming에 집중해야 한다.
- 기존 test를 깨뜨리지 말 것.
