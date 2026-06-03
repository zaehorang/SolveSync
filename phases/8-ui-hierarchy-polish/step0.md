# Step 0: popup-history-hierarchy

## 읽을 파일

먼저 아래 파일을 읽고 Popup UI와 최근 phase 결과를 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `phases/6-ui-state-design-polish/index.json`
- `phases/7-popup-operational-polish/index.json`
- `src/shared/i18n.ts`
- `src/shared/types.ts`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- `src/popup/index.test.ts`

`docs/ADR.md`는 source of truth가 아니다. ADR은 `docs/adr/` 아래 파일을 기준으로 읽는다.

## 작업

Popup의 Recent Sync History에서 정보 중복과 셀 위계 문제를 해결한다. 이 step은 Popup history display model, render markup, Popup CSS만 다룬다.

수정 대상:

- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts`
- 필요한 경우 `src/popup/index.test.ts`
- 필요한 경우 `src/shared/i18n.ts`

요구사항:

- 같은 history group/cell 안에서 같은 language가 group badge와 row badge에 반복 노출되지 않게 한다.
  - History item에는 Language가 반드시 보여야 한다.
  - 한 문제에 여러 language sync가 있을 때는 문제 group header가 문제 단위 정보만 담당하고, 각 language/status/link는 entry row에서 보여준다.
  - group header에 language badge를 남겨야 할 특별한 이유가 없다면 group-level language badge를 제거하고 row-level language badge를 source of truth로 삼는다.
- Recent Sync History에서 Sync Repository/Sync Branch target label을 반복하지 않는다.
  - 상단 상태/제어 요약은 설정 정보를 담당한다.
  - history group meta와 개별 row meta에는 repository/branch를 넣지 않는다.
  - history meta는 Coding Platform과 time처럼 문제 풀이 맥락에 필요한 정보만 남긴다.
- 문제 group과 개별 sync row의 시각 위계를 분명히 한다.
  - 한 문제가 어디서 시작하고 끝나는지 cell boundary가 명확해야 한다.
  - 문제 header, entry list, entry row, action links가 CSS class로 구분되어야 한다.
  - 같은 문제의 여러 language sync는 `problem group -> language/status row -> Commit/File action` 구조가 읽혀야 한다.
  - Commit/File link가 어느 row에 속하는지 즉시 알 수 있게 row 내부 action 영역에 배치한다.
- Commit/File link의 touch target을 개선한다.
  - 시각적으로 과하게 무겁지 않은 text button 또는 pill 형태로 처리한다.
  - 각 link는 최소 32px 높이 수준의 클릭 영역을 가져야 한다.
- Same-error batch/Retry all 기능은 phase 7 동작을 유지한다.
- 일반 수동 sync button은 추가하지 않는다.
- History 저장 schema, Retry Bundle schema, background sync flow는 변경하지 않는다.

Tests:

- `buildHistoryDisplayModel` 또는 관련 Popup display model test에서 group meta/row meta에 repository/branch target label이 반복되지 않는지 검증한다.
- 같은 문제의 단일 language와 복수 language case에서 language가 중복 badge로 표현되지 않는지 검증한다.
- CSS contract test가 있다면 history group/entry/action class와 link touch target class를 grep-friendly하게 보강한다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/popup/popup.test.ts src/popup/index.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Popup 책임 안에 머무르는가?
   - Sync History storage schema나 Retry Bundle storage schema를 변경하지 않았는가?
   - 일반 수동 sync button을 추가하지 않았는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/8-ui-hierarchy-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Popup history duplicates removed and problem/entry hierarchy clarified"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Sync History storage schema나 Retry Bundle storage schema를 변경하지 말 것. 이유: 이 작업은 표시 위계만 다룬다.
- 상단 설정 요약까지 제거하지 말 것. 이유: `UI_GUIDE.md`는 Popup에 GitHub connection summary와 Sync Repository/Sync Branch summary를 요구한다.
- 일반 수동 sync button을 추가하지 말 것. 이유: v1에서 사용자가 직접 실행할 수 있는 것은 실패 Retry뿐이다.
- GitHub tab을 자동으로 열지 말 것. 이유: 사용자를 놀라게 하는 navigation 금지 규칙이다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
