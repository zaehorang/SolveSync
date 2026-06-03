# Step 2: options-save-panel

## 읽을 파일

먼저 아래 파일을 읽고 Options UI와 Popup switch 변경 결과를 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `phases/8-ui-hierarchy-polish/index.json`
- `src/shared/theme.css`
- `src/shared/i18n.ts`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/options/options.test.ts`
- `src/options/index.test.ts`

수정하기 전에 Step 1 summary와 변경 파일을 확인한다.

## 작업

Options 하단 Save controls의 수평 위계와 모바일 overflow 문제를 해결한다. 이 step은 Options surface만 다룬다.

수정 대상:

- `src/options/styles.css`
- `src/options/options.test.ts`
- 필요한 경우 `src/options/index.ts`
- 필요한 경우 `src/options/index.test.ts`
- 필요한 경우 `src/shared/i18n.ts`

요구사항:

- 넓은 화면에서 Save controls가 큰 빈 패널 안에 작은 저장 버튼 하나만 왼쪽에 놓인 것처럼 보이지 않게 한다.
  - save status/message가 있으면 message와 action의 관계가 자연스럽게 보여야 한다.
  - save status/message가 없으면 빈 우측 영역 때문에 수평 위계가 어색하지 않아야 한다.
  - 버튼은 명확한 primary action으로 보이되 Options 전체 layout보다 과하게 무겁지 않아야 한다.
- 모바일에서 Save button이 하단 패널 공간을 자연스럽게 사용해야 한다.
  - 360px viewport 기준 button이 작게 왼쪽에 고립되지 않게 한다.
  - mobile layout에서는 button이 full-width 또는 panel width에 맞는 명확한 primary action이어야 한다.
- Options 모바일 360px에서 숨겨진 Auto Sync checkbox/input 때문에 horizontal overflow가 생기지 않게 한다.
  - `switch-row` input의 accessible behavior는 유지한다.
  - hidden input이 global `input { width: 100%; }` 규칙의 영향을 받아 viewport 밖으로 나가지 않게 한다.
  - label click, keyboard toggle, checked state가 유지되어야 한다.
- Options Auto Sync switch 표현은 유지하고, Popup switch와 시각적 언어가 어긋나지 않게 한다.
- 제품 동작, storage schema, GitHub API flow는 변경하지 않는다.

Tests:

- Options CSS contract test가 있다면 action panel desktop/mobile layout, hidden switch input overflow 방어를 grep-friendly하게 검증한다.
- DOM test가 있다면 Auto Sync input semantics가 유지되는지 확인한다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/options/options.test.ts src/options/index.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Options 책임 안에 머무르는가?
   - branch 자동 생성이나 GitHub API behavior를 변경하지 않았는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/8-ui-hierarchy-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Options save controls hierarchy and mobile switch overflow fixed"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- GitHub connection flow, branch loading, branch creation 동작을 변경하지 말 것. 이유: 이 step은 Options layout/overflow 개선이다.
- branch를 자동 생성하는 동작을 추가하지 말 것. 이유: `ARCHITECTURE.md`와 ADR의 명시적 금지 사항이다.
- PAT나 실제 secret을 fixture, docs, source에 넣지 말 것. 이유: 보안 요구사항이다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
