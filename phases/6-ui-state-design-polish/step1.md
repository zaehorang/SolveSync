# Step 1: options-setup-flow

## 읽을 파일

먼저 아래 파일을 읽고 Options 설정 흐름과 Step 0 token 산출물을 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `src/shared/theme.css`
- `src/shared/i18n.ts`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/options/options.test.ts`
- `src/options/index.test.ts`
- `phases/6-ui-state-design-polish/index.json`

수정하기 전에 Step 0에서 추가한 token 이름과 intent를 확인한다.

## 작업

Options page의 4단계 설정 위계와 선택 상태, 저장 접근성을 개선한다.

수정 대상:

- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- 필요한 경우 `src/shared/i18n.ts`
- 필요한 경우 `src/options/options.test.ts`
- 필요한 경우 `src/options/index.test.ts`

요구사항:

- GitHub Connection 흐름을 `PAT -> Sync Repository -> Sync Branch -> Connection test` 4단계로 시각화한다.
  - 각 step은 숫자 marker와 짧은 제목을 갖는다.
  - marker/active/complete/disabled 상태는 Step 0 token을 사용한다.
  - 기존 form control id와 behavior는 유지한다.
- selected state는 회색/흰색 하이라이트가 아니라 브랜드 blue 계열로 보이게 한다.
  - Language segmented control selected state를 blue token으로 바꾼다.
  - repository/branch select의 focus/selected affordance도 가능한 범위에서 blue token과 일관되게 맞춘다.
- repository list empty/loading/search no-match 상태의 vertical space가 과하게 커 보이지 않도록 compact empty state를 적용한다.
- Save controls는 긴 Options form에서 접근 가능해야 한다.
  - desktop과 mobile에서 form 하단 sticky save bar 또는 sticky action panel을 사용한다.
  - sticky 영역이 content를 가리지 않도록 bottom padding을 둔다.
  - 저장 버튼과 status text는 영어/한국어 모두 잘리지 않게 한다.
- 제품 copy는 i18n key 기반으로 유지한다.
- Branch 생성은 기존처럼 사용자가 명시적으로 클릭한 경우에만 동작해야 한다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/options/options.test.ts src/options/index.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Options Page 책임 안에 머무르는가?
   - `docs/adr/0004-vanilla-dom-ui.md`의 Vanilla DOM UI decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/6-ui-state-design-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Options setup flow hierarchy, blue selected states, compact empty states, and sticky save controls added"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Sync Repository나 Sync Branch를 자동 선택하지 말 것. 이유: PRD와 UI Guide가 사용자 선택을 요구한다.
- 존재하지 않는 branch를 자동 생성하지 말 것. 이유: branch 생성은 명시적 Create branch action만 허용된다.
- Options에 marketing hero를 추가하지 말 것. 이유: SolveSync는 조용한 개발 도구 UI다.
- README를 수정하지 말 것. 이유: 사용자가 명시적으로 요청하지 않았다.
- `dist/`를 수정하지 말 것. 이유: build artifact는 커밋하지 않는다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
