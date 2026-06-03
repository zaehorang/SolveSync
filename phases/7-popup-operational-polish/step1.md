# Step 1: integration-qa

## 읽을 파일

먼저 아래 파일을 읽고 두 UI polish phase의 완료 조건을 확인한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `docs/adr/0023-separate-iife-content-script-bundle.md`
- `phases/6-ui-state-design-polish/index.json`
- `phases/7-popup-operational-polish/index.json`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`

수정하기 전에 Step 0 summary와 변경 파일을 확인한다.

## 작업

Popup operational polish의 통합 QA를 수행하고 필요한 작은 마감 수정만 한다.

요구사항:

- 다음 항목을 current implementation 기준으로 감사한다.
  - Popup status summary가 sticky로 동작할 CSS 계약을 갖는가?
  - 같은 문제 group의 동일 retryable error가 batch로 묶이는가?
  - `Retry all`이 Retry Bundle id 기반으로만 동작하고, Retry Bundle이 없는 실패에는 보이지 않는가?
  - Commit/File link와 Details/Retry/Retry all button affordance가 구분되는가?
  - Popup width 380px에서 horizontal scroll을 유발할 만한 nowrap 요소가 방어되는가?
  - Phase 6에서 추가한 status badge, language badge, grouped history, content toast polish가 깨지지 않았는가?
- `docs/MANUAL_VALIDATION.md`에 sticky status summary와 Retry all 관찰 포인트가 빠져 있으면 짧게 갱신한다.
- 제품 scope나 sync behavior는 변경하지 않는다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `npm run build`가 content IIFE bundle 검증까지 통과하는지 확인한다.
3. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Popup/Shared 책임을 넘지 않는가?
   - `docs/adr/0004-vanilla-dom-ui.md`와 `docs/adr/0023-separate-iife-content-script-bundle.md`를 위반하지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
4. 이 step에 대해 `phases/7-popup-operational-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Integration QA completed for Popup sticky status summary and same-error retry batches"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 큰 refactor를 시작하지 말 것. 이유: 이 step은 통합 QA와 작은 마감 수정만 담당한다.
- 제품 scope를 넓히지 말 것. 이유: 일반 수동 sync, OAuth, 새 Coding Platform 지원은 v1 범위 밖이다.
- `dist/`, coverage output, `node_modules/`를 커밋하지 말 것. 이유: build artifact와 dependency output은 커밋 대상이 아니다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
