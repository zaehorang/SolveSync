# Step 3: options-language-layout

## 읽을 파일

먼저 아래 파일을 읽고 Options behavior와 새 UI guide를 이해한다:

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
- `src/options/options.test.ts`
- `src/options/index.test.ts`
- `phases/3-liquid-glass-ui/index.json`

수정하기 전에 이전 step에서 추가된 i18n, UI model, design token API를 확인한다.

## 작업

Options page를 language-aware Liquid Glass settings layout으로 개편한다.

- Locale handling:
  - Runtime state에 `uiLanguage: UiLanguagePreference`와 resolved `locale: UiLocale`을 둔다.
  - `navigator.language`와 settings의 `uiLanguage`로 locale을 resolve한다.
  - render 시 `document.documentElement.lang`을 `en` 또는 `ko`로 갱신한다.
  - Language segmented control에서 `System`, `English`, `한국어`를 선택할 수 있게 한다.
  - 언어 변경은 즉시 현재 Options 화면 문구를 re-render한다.
  - Save 시 `uiLanguage`를 `settings:write` update에 포함한다.
- HTML structure:
  - Hard-coded 사용자 표시 문구를 줄이고 render 단계에서 text를 주입한다.
  - 큰 glass shell 안에 settings sections를 배치한다.
  - 필수 section은 `General`, `GitHub Connection`, `Security`, `About`, `Save controls`를 유지한다.
  - 기존 element id는 tests와 TS collectElements가 필요로 하는 경우 유지한다.
- Options behavior:
  - PAT show/hide, repository loading/search, branch loading, branch create, connection test, save behavior는 유지한다.
  - Repository는 자동 선택하지 않는다.
  - Branch는 repository default branch를 우선 선택하는 기존 정책을 유지한다.
  - Connection test는 commit을 만들지 않는다.
- Styling:
  - `src/shared/theme.css` tokens를 사용해 frosted shell, settings row, segmented control, compact buttons를 구현한다.
  - Button text와 status text가 영어/한국어 모두에서 overflow되지 않게 한다.
- Tests:
  - `src/options/options.test.ts`에 language preference save/render helper 또는 validation case를 추가한다.
  - 기존 validation/status tests는 locale-aware expected label로 갱신한다.

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Options Page 책임 안에 머무르는가?
   - `ADR.md`의 Vanilla DOM UI decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/3-liquid-glass-ui/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Localized Options page and applied Liquid Glass settings layout with language control."`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- GitHub API request shape를 변경하지 말 것. 이유: Options UI 개편은 repository/branch API behavior를 바꾸지 않는다.
- PAT 값을 public settings나 runtime message에 노출하지 말 것. 이유: AGENTS.md CRITICAL 보안 규칙이다.
- README를 수정하지 말 것. 이유: 사용자가 README 변경을 요청하지 않았다.
- Card grid marketing layout을 만들지 말 것. 이유: Options는 settings UI여야 한다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
