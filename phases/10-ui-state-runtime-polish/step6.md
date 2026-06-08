# Step 6: integration-visual-qa

## 읽을 파일

먼저 아래 파일을 읽고 이번 phase의 완료 조건과 수동 검증 기준을 확인한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `docs/adr/0023-separate-iife-content-script-bundle.md`
- `docs/adr/0027-solution-revision-numbered-commit-message.md`
- `phases/10-ui-state-runtime-polish/index.json`
- `src/shared/errors.ts`
- `src/shared/errorNormalize.ts`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/options/index.test.ts`
- `src/options/options.test.ts`
- `src/popup/index.test.ts`
- `src/popup/popup.test.ts`

수정하기 전에 Step 0-5 summary와 변경 파일을 확인한다.

## 작업

이번 phase의 통합 QA를 수행하고 필요한 작은 마감 수정만 한다.

검증할 요구사항:

- Error model
  - Options initial settings read failure가 GitHub commit failure copy로 보이지 않는다.
  - unknown external/API error fallback은 여전히 `github_commit_failed`다.
- Sync Repository picker
  - empty/loading/no-match 상태가 selected repository처럼 보이지 않는다.
  - repository가 자동 선택되지 않는다.
  - no-match copy는 filter result로 읽힌다.
- Options mobile layout
  - 360px 폭에서 Language segmented control이 세 column으로 유지된다.
  - Save controls는 sticky로 reachable하지만 active setup step을 덮지 않는다.
  - empty save status가 빈 error 공간이나 misleading red message를 만들지 않는다.
- Popup QA
  - mock runtime fixture가 long title/repository/branch, Retry, Retry all, empty history를 렌더링한다.
  - product Popup code에 static fallback이 추가되지 않았다.
- Solution Revision Number
  - Popup, Toast, Options, Solution README에 별도 badge나 metadata로 표시되지 않는다.
  - commit message revision behavior는 기존 sync/catalog tests와 manual validation scope에 맡긴다.

권장 visual 확인:

- 가능하면 Playwright 또는 local static server로 built Options와 Popup fixture를 380px/360px 근처에서 확인한다.
- 가능하면 Computer Use 또는 Chrome automation으로 `dist` unpacked extension의 실제 toolbar Popup을 확인한다.
- GUI/extension loading 권한이나 환경 때문에 직접 확인할 수 없으면, 그 사실과 대신 확인한 DOM/CSS/test evidence를 summary에 남긴다.
- 임시 fixture, screenshot, server artifact를 만들었다면 커밋하지 않는다.

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
   - 작업이 `ARCHITECTURE.md`의 Options/Popup/shared 책임을 넘지 않는가?
   - `docs/adr/0004-vanilla-dom-ui.md`, `docs/adr/0023-separate-iife-content-script-bundle.md`, `docs/adr/0027-solution-revision-numbered-commit-message.md`를 위반하지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
4. 이 step에 대해 `phases/10-ui-state-runtime-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Completed UI state/runtime polish QA with typecheck, tests, build, and documented visual evidence"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 큰 refactor를 시작하지 말 것. 이유: 이 step은 integration QA와 작은 마감 수정만 담당한다.
- `dist/`, coverage output, screenshots, temp fixture output, `node_modules/`를 커밋하지 말 것. 이유: build/test artifact는 커밋 대상이 아니다.
- Product Popup에 static fallback UI를 추가하지 말 것. 이유: Popup QA fixture는 test-only여야 한다.
- README를 수정하지 말 것. 이유: 사용자가 명시적으로 요청하지 않았다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
