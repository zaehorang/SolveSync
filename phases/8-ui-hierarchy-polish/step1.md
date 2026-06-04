# Step 1: popup-top-controls

## 읽을 파일

먼저 아래 파일을 읽고 Popup 상단 상태/제어 UI와 Step 0 결과를 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `phases/8-ui-hierarchy-polish/index.json`
- `src/shared/theme.css`
- `src/shared/i18n.ts`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- `src/popup/index.test.ts`

수정하기 전에 Step 0 summary와 변경 파일을 확인한다.

## 작업

Popup 상단 상태/제어 영역의 공간 사용, sticky overlap, Auto Sync 표현 일관성을 개선한다. 이 step은 Popup surface만 다룬다.

수정 대상:

- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- 필요한 경우 `src/popup/index.test.ts`
- 필요한 경우 `src/shared/i18n.ts`

요구사항:

- Popup scroll에서 status card가 history content를 가리지 않게 한다.
  - phase 7의 sticky status card가 실제 content overlap을 만들고 있으면 sticky behavior를 제거하거나 overlap 없는 구조로 바꾼다.
  - Chrome popup width 380px, height 600px 기준 horizontal scroll이 없어야 한다.
  - scroll 중에도 content가 status card 아래로 숨어 읽기 흐름이 깨지면 안 된다.
- 상단 status card와 control panel의 밀도를 낮춘다.
  - 첫 화면에서 Recent Sync History가 가능한 빨리 보여야 한다.
  - 설정 요약은 유지하되, repository/branch 반복을 history로 다시 밀어 넣지 않는다.
  - 긴 repository name은 줄바꿈되어도 layout을 밀지 않도록 `min-width: 0`, wrapping, overflow 방어를 적용한다.
- Popup Auto Sync를 Options Auto Sync와 같은 switch 계열 표현으로 맞춘다.
  - native checkbox 동작과 accessibility는 유지한다.
  - label click, keyboard toggle, checked state가 유지되어야 한다.
  - Options의 switch CSS와 충돌하지 않는 Popup-local class를 쓰거나 공통 패턴을 안전하게 재사용한다.
- Commit/File link, Details/Retry/Retry all button의 affordance가 구분되는지 확인하고 Step 0의 link touch target 개선을 유지한다.
- 제품 동작, storage schema, background sync flow는 변경하지 않는다.

Tests:

- Popup CSS contract test가 있다면 sticky overlap 방지, switch class, horizontal overflow 방어를 grep-friendly하게 검증한다.
- DOM test가 있다면 Auto Sync input이 checkbox semantics를 유지하는지 확인한다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/popup/popup.test.ts src/popup/index.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Popup 책임 안에 머무르는가?
   - Auto Sync setting 저장/메시징 계약을 변경하지 않았는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/8-ui-hierarchy-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Popup top controls made compact, non-overlapping, and switch-consistent"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Popup에서 GitHub connection summary와 Sync Repository/Sync Branch summary를 완전히 제거하지 말 것. 이유: `UI_GUIDE.md`의 Popup 필수 section이다.
- 제품 동작이나 storage schema를 변경하지 말 것. 이유: 이 step은 UI layout/affordance 개선이다.
- 일반 수동 sync button을 추가하지 말 것. 이유: v1 scope 밖이다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
