# Step 0: popup-sticky-error-batches

## 읽을 파일

먼저 아래 파일을 읽고 Popup UI와 이전 phase 결과를 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `phases/6-ui-state-design-polish/index.json`
- `src/shared/theme.css`
- `src/shared/i18n.ts`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- `src/popup/index.test.ts`

`docs/ADR.md`는 source of truth가 아니다. ADR은 `docs/adr/` 아래 파일을 기준으로 읽는다.

## 작업

남은 디자인 피드백인 Popup scroll 처리와 동일 오류 묶음 복구 affordance를 Popup layer 안에서 해결한다.

수정 대상:

- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- 필요한 경우 `src/shared/i18n.ts`
- 필요한 경우 `src/popup/index.test.ts`

요구사항:

- Popup 상단 운영 상태 summary가 긴 Sync History를 스크롤해도 보이도록 한다.
  - `status-card`를 sticky summary로 처리한다.
  - Chrome popup width 380px에서 horizontal scroll이 없어야 한다.
  - sticky surface가 텍스트를 가리거나 layout jump를 만들면 안 된다.
- 같은 history group 안에서 인접한 실패 항목이 같은 error code와 user-facing summary를 갖고, 모두 retry 가능하면 batch recovery affordance를 보여준다.
  - batch summary는 `{count} failed · {summary}` 형태의 짧은 운영 문구를 i18n key로 제공한다.
  - batch에는 `Retry all` button을 제공한다.
  - `Retry all`은 batch의 Retry Bundle id들을 사용해 순차 retry를 실행한다.
  - retry 중에는 해당 bundle id들의 buttons를 disabled 상태로 보이게 한다.
  - 개별 Retry button 정책은 유지한다. Retry Bundle이 없거나 retry 불가이면 button을 보여주지 않는다.
  - 일반 수동 sync button은 추가하지 않는다.
- Same-error batching은 Popup display/retry orchestration에만 머무르고, background Sync History 저장 schema나 Retry Bundle schema를 변경하지 않는다.
- Tests:
  - `buildHistoryDisplayModel`이 같은 문제 group 안의 동일 retryable error를 batch로 묶는지 검증한다.
  - 서로 다른 error code/summary 또는 retry 불가 실패는 batch로 묶지 않는지 검증한다.
  - sticky status card와 batch/retry all 관련 CSS class가 존재하는지 최소한의 regression test 또는 grep-friendly CSS 계약으로 보강한다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/popup/popup.test.ts src/popup/index.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Popup 책임 안에 머무르는가?
   - Retry Bundle이 없는 실패에 실행 불가능한 Retry button을 보여주지 않는가?
   - 일반 수동 sync button을 추가하지 않았는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/7-popup-operational-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Popup sticky status summary and same-error retry batches added"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Sync History storage schema나 Retry Bundle storage schema를 변경하지 말 것. 이유: 이 step은 Popup display/retry affordance만 다룬다.
- 일반 수동 sync button을 추가하지 말 것. 이유: v1에서 사용자가 직접 실행할 수 있는 것은 실패 Retry뿐이다.
- Retry Bundle이 없거나 retry 불가인 실패에 Retry button 또는 Retry all을 보여주지 말 것. 이유: 실행할 수 없는 action이다.
- GitHub tab을 자동으로 열지 말 것. 이유: 사용자를 놀라게 하는 navigation 금지 규칙이다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
