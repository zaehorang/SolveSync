# Step 6: integration-qa

## 읽을 파일

먼저 아래 파일을 읽고 전체 변경 의도와 완료된 step summary를 확인한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/UI_GUIDE.md`
- `src/shared/i18n.ts`
- `src/shared/uiModels.ts`
- `src/shared/theme.css`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/content/toast.ts`
- `phases/2-liquid-glass-ui/index.json`

수정하기 전에 Step 0부터 Step 5까지의 summary를 확인한다.

## 작업

UI 리디자인 전체를 통합 검증하고 작은 정리만 수행한다.

- I18n audit:
  - Options, Popup, Toast에 남은 사용자 표시 hard-coded mixed Korean/English 문구를 `rg`로 찾고 i18n key로 이동한다.
  - Platform/product names는 그대로 둘 수 있다: `SolveSync`, `GitHub`, `LeetCode`, `Programmers`, `PAT`, `Auto Sync`, `Swift`, `Python3`.
- Layout audit:
  - Popup width 380px 기준으로 horizontal scroll이 생길 수 있는 CSS를 정리한다.
  - Long repository name, long branch name, long problem title이 layout을 깨지 않게 한다.
  - Toast는 `calc(100vw - safe margin)` 안에 들어오게 한다.
- Build audit:
  - `dist/content/index.js`에 static ESM import가 남지 않도록 `npm run build` 결과를 확인한다.
- Documentation audit:
  - `docs/UI_GUIDE.md`와 구현이 명백히 충돌하면 UI guide 또는 구현 중 하나를 정리한다.
  - README는 수정하지 않는다.
- Optional manual note:
  - 필요하면 `docs/MANUAL_VALIDATION.md`에 UI language switch와 toast visual check 항목을 추가한다.
  - 이 문서 수정은 README 수정이 아니다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/2-liquid-glass-ui/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Completed integration QA for localized Liquid Glass Options, Popup, and content toast UI."`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Large refactor를 새로 시작하지 말 것. 이유: 이 step은 통합 QA와 작은 정리만 담당한다.
- API client, sync path generation, README/index generation을 수정하지 말 것. 이유: UI 리디자인 범위 밖이다.
- README를 수정하지 말 것. 이유: 사용자가 명시적으로 요청하지 않았다.
- Build artifact인 `dist/`, `node_modules/`, coverage output을 커밋 대상으로 만들지 말 것. 이유: AGENTS.md 개발 프로세스 규칙이다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
