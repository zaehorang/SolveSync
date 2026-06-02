# Step 5: content-sync-toast

## 읽을 파일

먼저 아래 파일을 읽고 content script와 toast 상태 흐름을 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/UI_GUIDE.md`
- `src/shared/i18n.ts`
- `src/shared/uiModels.ts`
- `src/shared/messages.ts`
- `src/content/index.ts`
- `src/content/toast.ts`
- `src/content/toast.test.ts`
- `src/content/index.test.ts`
- `src/background/runtime.ts`
- `phases/3-liquid-glass-ui/index.json`

수정하기 전에 Step 1의 shared toast model과 Step 2의 content toast token block을 확인한다.

## 작업

Problem page sync popup/toast를 language-aware Liquid Glass state popup으로 개편한다.

- Locale handling:
  - Content toast는 표시 전에 current settings를 읽어 `uiLanguage`를 반영한다.
  - `settings:read`가 실패하면 `system` preference로 fallback한다.
  - `navigator.language`와 preference로 locale을 resolve한다.
  - Toast DOM의 accessible text는 resolved locale을 사용한다.
- Toast model:
  - `setup_required`, `auto_sync_disabled`, `syncing`, `retrying`, `synced`, `unsupported_language`, `failed` 상태를 모두 shared UI model 기반으로 렌더링한다.
  - Success actions: Commit/File/Dismiss.
  - Failure actions: retry payload가 있는 경우 Retry, 설정 복구가 필요한 경우 Open Options.
  - Setup action: Open Options.
  - Syncing/Retrying: action 없이 spinner 또는 progress-style indicator.
- Runtime actions:
  - Existing `content:toast_action` flow를 유지한다.
  - Retry action이 필요하면 typed runtime message를 추가한다. 이 경우 `src/shared/messages.ts`, `src/background/runtime.ts`, 관련 tests를 함께 갱신한다.
  - Retry action을 추가할 때도 retry payload id가 없는 실패에는 Retry를 보여주지 않는다.
- Styling:
  - Shadow DOM 안에 Liquid Glass token block을 둔다.
  - 오른쪽 아래 fixed placement를 유지하되 editor controls와 겹치지 않도록 safe offset을 둔다.
  - Toast width는 `min(360px, calc(100vw - 32px))` 수준의 responsive constraint를 둔다.
  - 긴 문제명은 overflow-wrap 또는 line clamp로 layout을 깨지 않게 한다.
- Tests:
  - `src/content/toast.test.ts`에 상태별 localized title/detail/actions/autoDismiss 검증을 추가한다.
  - Retry action을 추가했다면 runtime message guard test도 추가한다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Content Script 책임 안에 머무르는가?
   - content script가 GitHub API를 직접 호출하지 않는가?
   - content bundle에 static ESM import가 남지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/3-liquid-glass-ui/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Localized and redesigned content sync popup/toast with Liquid Glass states and recovery actions."`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Content script에서 GitHub API를 직접 호출하지 말 것. 이유: 외부 write 작업은 background service worker만 수행한다.
- LeetCode/Programmers page 전체 text scan을 추가하지 말 것. 이유: Accepted detector guardrail을 깨뜨린다.
- Failed toast에 긴 debug stack trace를 표시하지 말 것. 이유: technical detail은 Popup details에 둔다.
- Toast action click 시 GitHub tab을 자동으로 열지 말 것. 이유: 사용자가 action을 클릭한 경우에만 link를 연다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
