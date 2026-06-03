# Step 2: popup-history-recovery

## 읽을 파일

먼저 아래 파일을 읽고 Popup 운영 상태와 Retry Bundle 정책을 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `src/shared/theme.css`
- `src/shared/i18n.ts`
- `src/shared/uiModels.ts`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- `src/popup/index.test.ts`
- `phases/6-ui-state-design-polish/index.json`

수정하기 전에 Step 0 token과 Step 1 component state style을 확인한다.

## 작업

Popup Sync History의 badge 깨짐, 실패 복구 경로, 링크/버튼 구분, 같은 문제 다중 언어 중복 표시를 개선한다.

수정 대상:

- `src/popup/index.ts`
- `src/popup/styles.css`
- 필요한 경우 `src/shared/i18n.ts`
- 필요한 경우 `src/shared/uiModels.ts`
- `src/popup/popup.test.ts`
- 필요한 경우 `src/popup/index.test.ts`

요구사항:

- Status badge는 pill 형태를 유지하되 가로형으로 고정한다.
  - `Synced`가 `Sync/ed`처럼 깨지지 않게 `white-space: nowrap`과 안정적 width constraints를 적용한다.
  - 긴 localized status는 popup width 안에서 overflow 없이 보이게 한다.
- `syncing`과 `retrying`은 진행 중 tone/token으로 보이게 한다.
- 실패 history item은 복구 경로가 막다른 길처럼 보이지 않아야 한다.
  - Retry Bundle이 있으면 Retry button을 Details 옆에 직접 노출한다.
  - Retry 중에는 button을 disabled하고 진행 중 label을 보여준다.
  - Retry Bundle이 없으면 Retry button은 숨기고 detail 또는 inline hint로 다음 행동을 보여준다.
  - `programmers_extract_failed`와 unsupported language는 commit이 만들어지지 않은 이유를 짧게 보여준다.
- Commit/File은 link affordance를 유지하고, Details/Retry는 button affordance를 유지한다.
- 같은 Coding Platform의 같은 문제가 여러 언어로 최근 history에 반복되면 한 카드로 묶어 표시한다.
  - grouping key는 `codingPlatform` + 안정적인 problem id/title slug를 사용한다.
  - grouped card는 대표 제목 하나와 language badge들을 보여준다.
  - 각 language entry의 status, time, links, failure/retry action은 잃지 않는다.
  - history limit은 입력 history 기준 최근 20개 정책을 유지한다.
- Popup width 380px에서 horizontal scroll이 없어야 한다.

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
   - GitHub link는 사용자가 클릭할 때만 새 tab으로 열리는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/6-ui-state-design-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Popup history grouping, no-wrap status badges, retry recovery affordances, and link/button distinction added"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 일반 수동 sync button을 추가하지 말 것. 이유: v1에서 사용자가 직접 실행할 수 있는 것은 실패 Retry뿐이다.
- Retry Bundle이 없거나 만료된 실패에 Retry button을 보여주지 말 것. 이유: 실행할 수 없는 action이다.
- History limit 20개 정책을 늘리지 말 것. 이유: PRD와 UI Guide의 운영 정책이다.
- GitHub tab을 자동으로 열지 말 것. 이유: 사용자를 놀라게 하는 navigation 금지 규칙이다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
