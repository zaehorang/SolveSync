# Step 3: content-toast-polish

## 읽을 파일

먼저 아래 파일을 읽고 content toast 상태 흐름과 Popup의 Step 2 상태 표현을 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `src/shared/theme.css`
- `src/shared/i18n.ts`
- `src/shared/uiModels.ts`
- `src/shared/messages.ts`
- `src/content/index.ts`
- `src/content/toast.ts`
- `src/content/toast.test.ts`
- `src/content/index.test.ts`
- `phases/6-ui-state-design-polish/index.json`

수정하기 전에 Step 0 token과 Step 2 badge/retry affordance를 확인한다.

## 작업

Problem page sync toast의 상태 표현과 action layout을 Step 0/2의 상태 디자인과 맞춘다.

수정 대상:

- `src/content/toast.ts`
- 필요한 경우 `src/shared/uiModels.ts`
- 필요한 경우 `src/shared/i18n.ts`
- `src/content/toast.test.ts`
- 필요한 경우 `src/content/index.test.ts`

요구사항:

- Shadow DOM token block을 Step 0의 semantic token 방향과 맞춘다.
- Toast 상태별 visual affordance를 명확히 한다.
  - `syncing`과 `retrying`은 진행 중 indicator로 보인다.
  - `synced`, `failed`, `unsupported_language`, `auto_sync_disabled`, `setup_required`는 색상만이 아니라 title/detail/action으로 의미를 전달한다.
- Toast actions는 button처럼 보이고, commit/file/dismiss/retry/open options label이 좁은 viewport에서 잘리지 않게 한다.
  - action label은 가능한 한 `white-space: nowrap`을 사용하되, 전체 row는 wrap 가능해야 한다.
  - primary action은 하나만 강조한다.
- close action은 accessible label을 유지하고, 시각적으로 text `x`가 어색하지 않도록 icon-like close glyph 또는 CSS 처리로 정리한다.
- 긴 problem title/detail은 2줄 clamp 또는 안정적인 wrapping으로 toast width를 깨지 않게 한다.
- reduced motion 환경에서는 spinner animation이 없어도 진행 중 상태가 전달돼야 한다.
- Content script는 GitHub API를 직접 호출하지 않는다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/content/toast.test.ts src/content/index.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Content Script 책임 안에 머무르는가?
   - Content script가 GitHub API를 직접 호출하지 않는가?
   - Toast에 긴 technical stack trace가 표시되지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/6-ui-state-design-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Content toast state visuals, action layout, close control, and responsive text behavior polished"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Content script에서 GitHub API를 직접 호출하지 말 것. 이유: 외부 write는 background service worker 책임이다.
- LeetCode/Programmers detector logic을 변경하지 말 것. 이유: 이 step은 toast presentation만 다룬다.
- Failed toast에 debug stack trace를 표시하지 말 것. 이유: technical detail은 Popup details에 둔다.
- GitHub tab을 자동으로 열지 말 것. 이유: 사용자가 action을 클릭한 경우에만 navigation한다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
