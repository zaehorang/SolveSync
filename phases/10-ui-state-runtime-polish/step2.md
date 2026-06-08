# Step 2: options-extension-state-errors

## 읽을 파일

먼저 아래 파일을 읽고 Options 초기화와 runtime messaging 경계를 이해한다:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `docs/adr/0018-typed-runtime-message-union.md`
- `phases/10-ui-state-runtime-polish/index.json`
- `src/shared/errors.ts`
- `src/shared/errorNormalize.ts`
- `src/shared/i18n.ts`
- `src/options/index.ts`
- `src/options/index.test.ts`
- `src/options/options.test.ts`

수정하기 전에 Step 1 summary와 shared error model 변경을 확인한다.

## 작업

Options page의 extension-local settings read/write failure를 `extension_state_unavailable`로 표시한다.

- `src/options/index.ts`
  - initial `readSettings()` failure가 `normalizeError(error)`의 generic fallback을 타서 `github_commit_failed` copy를 보여주지 않게 한다.
  - `chrome.storage.local`, `chrome.runtime.lastError`, missing background response처럼 extension runtime/settings context가 없는 경우는 명시적으로 `extension_state_unavailable`로 normalize한다.
  - save settings write failure도 extension-local failure이면 Save controls 근처에 extension recovery copy를 표시한다.
  - GitHub repository/branch loading, branch create, connection test 같은 external/API failure는 기존 GitHub/network normalize 경로를 유지한다.
  - Save bar status는 메시지가 있을 때만 의미 있는 text를 갖게 하되, 실제 styling 조정은 Step 4에서 한다.
- `src/shared/i18n.ts`
  - 현재 Options visible copy가 i18n key를 요구하는 구조라면 English/Korean key를 추가한다.
  - 한국어 UI에서 새 visible copy가 hard-coded English로 보이지 않게 한다.
- `src/options/index.test.ts` 또는 `src/options/options.test.ts`
  - Options initial settings read failure가 `extension_state_unavailable` user copy를 보여주는지 검증한다.
  - same path에서 `Could not commit the solution to GitHub.`가 표시되지 않는지 검증한다.
  - save settings extension-local failure도 local extension recovery message를 표시하는지 검증한다.

## 인수 기준

```bash
npm test -- --run src/shared/errorNormalize.test.ts src/options/index.test.ts src/options/options.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - Options UI가 storage/runtime read/write의 owner가 아니라 background/shared boundary를 그대로 사용하는가?
   - external API failure를 extension state failure로 넓게 오분류하지 않았는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/10-ui-state-runtime-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Mapped Options extension-local settings failures to extension_state_unavailable without changing GitHub API error paths"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- repository loading, branch loading, branch create, connection test failure를 무조건 `extension_state_unavailable`로 바꾸지 말 것. 이유: 이들은 GitHub/API recovery copy가 필요한 외부 실패다.
- Options에 영어/한국어 visible copy를 직접 hard-code하지 말 것. 이유: UI Guide가 i18n key 기반 copy를 요구한다.
- background service worker의 장기 in-memory state를 source of truth로 만들지 말 것. 이유: MV3 service worker는 suspend될 수 있다.
- 기존 test를 깨뜨리지 말 것.
