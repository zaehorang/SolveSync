# Step 4: integration-qa

## 읽을 파일

먼저 아래 파일을 읽고 이번 phase의 변경 범위와 검증 기준을 확인한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `docs/adr/0023-separate-iife-content-script-bundle.md`
- `phases/6-ui-state-design-polish/index.json`
- `src/shared/theme.css`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/content/toast.ts`

수정하기 전에 Steps 0-3의 summaries와 변경 파일을 확인한다.

## 작업

이번 UI state polish phase의 통합 QA를 수행하고, 필요한 작은 마감 수정만 한다.

요구사항:

- 디자인 피드백 항목을 current implementation 기준으로 감사한다.
  - 상태 색과 selected 색이 일관적인가?
  - badge가 `Sync/ed`처럼 깨질 가능성이 제거됐는가?
  - 실패 항목에 Retry 또는 다음 행동 안내가 있는가?
  - empty/loading/progress 상태가 UI Guide에 맞게 보이는가?
  - Options 4단계 설정 위계가 보이는가?
  - 같은 문제 다중 언어 history가 한 카드로 묶이는가?
  - Save controls가 긴 Options form에서 접근 가능한가?
  - Commit/File은 link, Details/Retry는 button으로 구분되는가?
  - popup header/status summary가 popup width에서 안정적인가?
- 감사 중 작은 CSS/test/copy mismatch가 있으면 수정한다.
- 제품 scope나 sync behavior는 변경하지 않는다.
- `docs/MANUAL_VALIDATION.md`에 수동 검증 절차 갱신이 필요한지 판단한다.
  - 이번 변경이 기존 수동 검증 절차의 UI 관찰 포인트를 바꿨다면 짧게 갱신한다.
  - 단순 CSS 내부 변경만이면 갱신하지 않는다.

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
   - 작업이 `ARCHITECTURE.md`의 Options/Popup/Content/Shared 책임을 넘지 않는가?
   - `docs/adr/0004-vanilla-dom-ui.md`와 `docs/adr/0023-separate-iife-content-script-bundle.md`를 위반하지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
4. 이 step에 대해 `phases/6-ui-state-design-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Integration QA completed for design tokens, Options flow, Popup recovery history, and content toast polish"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 큰 refactor를 시작하지 말 것. 이유: 이 step은 통합 QA와 작은 마감 수정만 담당한다.
- 제품 scope를 넓히지 말 것. 이유: 일반 수동 sync, OAuth, 새 Coding Platform 지원은 v1 범위 밖이다.
- `dist/`, coverage output, `node_modules/`를 커밋하지 말 것. 이유: build artifact와 dependency output은 커밋 대상이 아니다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
