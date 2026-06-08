# Step 3: repository-picker-states

## 읽을 파일

먼저 아래 파일을 읽고 Sync Repository picker의 제품 흐름과 UI 계약을 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0020-user-selected-sync-repository-and-branch.md`
- `phases/10-ui-state-runtime-polish/index.json`
- `src/shared/i18n.ts`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/options/index.test.ts`
- `src/options/options.test.ts`

수정하기 전에 Step 2 summary와 Options error handling 변경을 확인한다.

## 작업

Sync Repository picker의 empty/loading/no-match 상태를 실제 selected option과 분리한다.

- `src/options/index.html`
  - repository select 주변에 dedicated status element/block을 추가한다.
  - label과 setup flow는 그대로 읽히게 유지한다.
- `src/options/index.ts`
  - repository list state가 `ready`일 때만 실제 repository option을 select에 렌더링한다.
  - `empty`, `loading`, `no-matches` 상태를 disabled selected option으로 렌더링하지 않는다.
  - non-ready 상태에서는 select를 disable하거나 숨기되, search input과 status block이 현재 상태를 설명해야 한다.
  - repository를 자동 선택하지 않는다.
  - search no-match는 filter result로 읽히게 하고 validation failure처럼 보이게 하지 않는다.
  - 기존 i18n key를 우선 재사용한다:
    - `options.repositoryList.empty`
    - `options.repositoryList.loading`
    - `options.repositoryList.noMatches`
    - `options.message.noRepositorySearchMatches`
- `src/options/styles.css`
  - status block이 실제 selected repository option처럼 보이지 않게 시각적으로 분리한다.
  - 360px 폭에서도 label/search/status/select가 겹치지 않게 한다.
- `src/options/options.test.ts` 또는 `src/options/index.test.ts`
  - loading/empty/no-match 상태에서 disabled selected placeholder option이 selected repository처럼 보이는 구조가 없는지 검증한다.
  - ready 상태에서만 repository option이 렌더링되고 사용자가 직접 선택할 수 있는지 검증한다.

## 인수 기준

```bash
npm test -- --run src/options/index.test.ts src/options/options.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - Sync Repository는 사용자 선택으로만 저장되는가?
   - 특정 repository를 code default로 고정하지 않았는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/10-ui-state-runtime-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Separated Sync Repository loading/empty/no-match status from real selectable repository options"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- repository를 자동 선택하지 말 것. 이유: Sync Repository는 사용자가 명시적으로 선택해야 한다.
- empty/loading/no-match copy를 selected `<option>`처럼 보이게 만들지 말 것. 이유: 사용자가 repository가 선택됐다고 오해한다.
- branch picker 동작을 크게 refactor하지 말 것. 이유: 이 step은 repository picker state split만 담당한다.
- 기존 test를 깨뜨리지 말 것.
