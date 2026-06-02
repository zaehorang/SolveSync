# Step 4: popup-glass-status

## 읽을 파일

먼저 아래 파일을 읽고 Popup 운영 상태 흐름을 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/UI_GUIDE.md`
- `src/shared/i18n.ts`
- `src/shared/uiModels.ts`
- `src/shared/theme.css`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- `src/popup/index.test.ts`
- `phases/3-liquid-glass-ui/index.json`

수정하기 전에 Step 3의 Options language behavior를 확인한다.

## 작업

Popup page를 language-aware Liquid Glass operational control surface로 개편한다.

- Locale handling:
  - `settings:read` 응답의 `uiLanguage`와 `navigator.language`로 locale을 resolve한다.
  - render 시 `document.documentElement.lang`을 `en` 또는 `ko`로 갱신한다.
  - Hard-coded 사용자 표시 문구를 i18n key 또는 shared UI model output으로 대체한다.
- Status summary:
  - 상단 glass status card를 만든다.
  - `getSetupStatusView(locale, settings)` 결과를 사용해 label/detail/tone을 표시한다.
  - status card는 icon 또는 text marker와 함께 label/detail을 보여준다.
- Popup controls:
  - Auto Sync toggle behavior는 유지한다.
  - Options link는 계속 `chrome.runtime.openOptionsPage()`를 사용한다.
  - GitHub connection, repository, branch summary를 compact rows로 표시한다.
- History:
  - 최근 20개 history 유지.
  - status badge를 사용한다.
  - Commit/File links는 사용 가능한 경우만 표시하고 새 tab에서 연다.
  - Failure detail panel과 Retry button behavior를 유지한다.
  - Unsupported language는 commit이 만들어지지 않은 이유를 locale별로 표시한다.
- Styling:
  - `src/shared/theme.css` tokens를 사용한다.
  - Popup width 380px에서 horizontal scroll이 없어야 한다.
  - 영어/한국어 문구 모두 badge/button 안에서 잘리지 않아야 한다.
- Tests:
  - `src/popup/popup.test.ts`를 locale-aware expected label로 갱신한다.
  - Korean setup status/history/failure label case를 최소 1개 이상 추가한다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Popup 책임 안에 머무르는가?
   - `ADR.md`의 Vanilla DOM UI decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/3-liquid-glass-ui/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Localized Popup and applied Liquid Glass status, control, and history layout."`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 일반 수동 sync button을 추가하지 말 것. 이유: v1은 Retry만 제공한다.
- History limit 20개 정책을 변경하지 말 것. 이유: PRD와 UI guide의 운영 정책이다.
- Retry payload가 없는 실패에 Retry button을 보여주지 말 것. 이유: 사용자가 실행할 수 없는 action이 된다.
- GitHub link를 자동으로 열지 말 것. 이유: 사용자를 놀라게 하는 navigation 금지 규칙이다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
