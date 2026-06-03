# Step 0: semantic-ui-tokens

## 읽을 파일

먼저 아래 파일을 읽고 UI source of truth와 기존 Liquid Glass phase 결과를 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `phases/3-liquid-glass-ui/index.json`
- `src/shared/theme.css`
- `src/options/styles.css`
- `src/popup/styles.css`
- `src/content/toast.ts`
- `src/shared/uiModels.ts`
- `src/shared/uiModels.test.ts`

`docs/ADR.md`는 source of truth가 아니다. ADR은 `docs/adr/` 아래 파일을 기준으로 읽는다.

## 작업

디자인 피드백의 기반인 상태 색, 선택 색, spacing, badge primitive를 token 수준에서 정리한다.

수정 대상:

- `src/shared/theme.css`
- 필요한 경우 `src/shared/uiModels.ts`
- 필요한 경우 `src/shared/uiModels.test.ts`

요구사항:

- `UI_GUIDE.md`의 Visual Style을 유지하면서 의미 기반 token을 추가한다.
  - selection/selected state는 브랜드 blue 계열로 고정한다.
  - success/failed/progress/warning/neutral/disabled 상태는 배경, border, foreground token을 갖게 한다.
  - 4px 기반 spacing token을 추가한다.
  - badge pill에서 줄바꿈이 생기지 않도록 재사용 가능한 token 또는 style contract를 마련한다.
- 기존 token 이름은 가능한 유지하고 새 token을 추가하는 방식으로 호환성을 지킨다.
- `getSyncStatusTone`의 의미를 유지하되 `syncing`과 `retrying`이 UI에서 진행 중 상태로 구분 가능한 token을 쓸 수 있게 한다.
- 색상 값은 `UI_GUIDE.md`의 권장 token에서 벗어나지 않는다.
- product behavior, runtime message, storage schema는 변경하지 않는다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/shared/uiModels.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Shared Modules 책임 안에 머무르는가?
   - `docs/adr/0004-vanilla-dom-ui.md`의 Vanilla DOM UI decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/6-ui-state-design-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "semantic UI tokens for selection, state, spacing, and badge styling added"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 보라/파랑-보라 gradient를 UI 전체 배경으로 추가하지 말 것. 이유: `UI_GUIDE.md`의 금지 패턴이다.
- runtime message, storage schema, sync behavior를 변경하지 말 것. 이유: 이 step은 visual token foundation만 다룬다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
