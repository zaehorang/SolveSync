# Step 8: options-ui

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md`
- `/src/shared/messages.ts`
- `/src/shared/types.ts`
- `/src/options/index.html`
- `/src/options/index.ts`
- `/src/options/styles.css`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 background runtime message contract와 storage settings model을 주의 깊게 읽는다.

## 작업

Options page를 v1 설정 화면으로 구현한다.

생성 또는 수정할 파일:

- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/options/options.test.ts` 가능한 순수 state reducer 테스트
- 필요한 shared message/type 보강

필수 UI:

- 프로젝트 제목과 한 줄 설명
- GitHub PAT input, 기본 masked display, show/hide toggle
- Fine-grained PAT checklist
- Load repositories action
- 검색 가능한 repository picker
- branch picker
- Create branch action
- Auto Sync enabled checkbox 또는 switch
- Connection test action과 result 상태
- Security disclosure
- Save controls

필수 동작:

- PAT 입력 후 repository 목록을 background message로 요청한다.
- repository를 자동 선택하지 않는다.
- repository 선택 후 branch 목록을 background message로 요청한다.
- branch 목록에서 repository default branch를 기본 선택값으로 표시한다.
- 원하는 branch가 없을 때만 사용자가 Create branch action을 명시 실행할 수 있게 한다.
- connection test는 background message를 통해 실행하고, write action을 만들지 않는다.
- connection test 성공 여부와 무관하게 settings 저장은 가능하다.
- Options 재진입 시 저장된 PAT/repository/branch/Auto Sync 상태를 복원한다.

보안 안내 문구는 다음 내용을 반드시 포함한다:

- PAT는 Chrome extension local storage에 저장된다.
- 실패 retry payload는 Accepted solution code를 local storage에 임시 저장할 수 있다.
- retry payload는 최대 20개, 최대 7일 보관하고 retry 성공 후 삭제한다.
- v1 확장은 별도 backend server를 운영하지 않는다.
- Solution code는 설정된 GitHub sync commit을 위해서만 GitHub로 전송된다.

스타일:

- Vanilla HTML/CSS/TypeScript만 사용한다.
- neutral palette와 compact spacing을 사용한다.
- card/panel radius는 8px 이하로 유지한다.
- gradient, glow, glassmorphism, marketing hero style을 사용하지 않는다.

테스트:

- repository filter state
- branch selection default
- missing required settings validation
- connection test status mapping

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
3. 이 step에 대해 `phases/0-mvp-extension/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Options UI for PAT, repository and branch pickers, branch create, connection test, Auto Sync, and security disclosure"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 특정 repository를 기본값으로 하드코딩하지 말 것. 이유: 사용자가 PAT로 접근 가능한 repository 중 선택해야 한다.
- branch를 자동 생성하지 말 것. 이유: ADR-020은 명시적 Create branch action만 허용한다.
- PAT를 평문으로 계속 노출하지 말 것. 이유: 보안 UX 요구사항이다.
- README 갱신 toggle을 만들지 말 것. 이유: v1은 README를 항상 갱신한다.
- 기존 test를 깨뜨리지 말 것.
