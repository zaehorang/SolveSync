# Step 5: popup-runtime-fixture

## 읽을 파일

먼저 아래 파일을 읽고 Popup runtime assumptions와 test 구조를 이해한다:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `docs/adr/0018-typed-runtime-message-union.md`
- `phases/10-ui-state-runtime-polish/index.json`
- `src/shared/i18n.ts`
- `src/shared/types.ts`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/index.test.ts`
- `src/popup/popup.test.ts`

수정하기 전에 Step 4 summary와 Options visual changes를 확인한다.

## 작업

Popup의 static/mock QA fixture를 test-only 경로로 추가한다.

- Product code에는 `file://` 또는 non-extension runtime fallback UI를 추가하지 않는다.
- Popup code는 Chrome extension runtime이 있다는 제품 가정을 유지한다.
- Test-only fixture 또는 helper를 만든다.
  - 가능한 위치: `src/popup/fixtures` 또는 기존 popup test 파일 내부 helper.
  - mock `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, `chrome.runtime.openOptionsPage` 등 Popup render에 필요한 최소 runtime surface를 제공한다.
  - mock data는 long problem title, long Sync Repository, long Sync Branch, Retry, Retry all, empty history 구조를 포함한다.
  - 실제 PAT, cookie, session token, private code를 넣지 않는다.
- `src/popup/popup.test.ts` 또는 `src/popup/index.test.ts`
  - fixture로 Popup 구조가 meaningful content를 렌더링할 수 있는지 검증한다.
  - empty Sync History state가 조용한 empty copy를 표시하는지 검증한다.
  - retry 가능한 실패에서 Retry/Retry all 구조를 확인한다.
  - Solution Revision Number가 Popup text로 노출되지 않는지 확인한다.
- `docs/MANUAL_VALIDATION.md`
  - 구현 결과로 수동 검증 절차가 바뀐 경우에만 짧게 갱신한다.

## 인수 기준

```bash
npm test -- --run src/popup/index.test.ts src/popup/popup.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - Popup product code가 extension runtime assumption을 유지하는가?
   - test fixture에 secret이나 실제 사용자 data가 없는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/10-ui-state-runtime-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Added test-only Popup runtime fixture coverage for long content, retry states, empty history, and revision non-display"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Product Popup에 static/file fallback UI를 추가하지 말 것. 이유: 실제 제품은 Chrome extension runtime 안에서 실행된다.
- fixture에 PAT, cookie, session token, 실제 private code를 넣지 말 것. 이유: 보안/개인정보 요구사항 위반이다.
- Popup width를 `100vw` 또는 viewport 의존 root sizing으로 바꾸지 말 것. 이유: Chrome action popup은 content 기준 sizing을 사용한다.
- 기존 test를 깨뜨리지 말 것.
