# Step 2: glass-theme-tokens

## 읽을 파일

먼저 아래 파일을 읽고 visual direction과 current CSS 구조를 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/UI_GUIDE.md`
- `src/options/styles.css`
- `src/popup/styles.css`
- `src/content/toast.ts`
- `phases/3-liquid-glass-ui/index.json`

수정하기 전에 Step 0과 Step 1의 summary를 확인한다.

## 작업

Liquid Glass inspired design token foundation을 만든다.

- `src/shared/theme.css`를 추가한다.
  - `:root`에 `--ss-*` custom properties를 정의한다.
  - 최소 token:
    - `--ss-bg`
    - `--ss-bg-wash-blue`
    - `--ss-bg-wash-green`
    - `--ss-bg-wash-lavender`
    - `--ss-glass`
    - `--ss-glass-elevated`
    - `--ss-glass-border`
    - `--ss-hairline`
    - `--ss-text-primary`
    - `--ss-text-secondary`
    - `--ss-text-muted`
    - `--ss-accent`
    - `--ss-success`
    - `--ss-error`
    - `--ss-warning`
    - `--ss-radius-panel`
    - `--ss-radius-shell`
    - `--ss-shadow-glass`
  - Values must match `docs/UI_GUIDE.md` direction.
- Import `src/shared/theme.css` from `src/options/styles.css` and `src/popup/styles.css`.
- Update only base token usage in Options/Popup CSS in this step.
  - Page background, font stack, text colors, border colors, button colors, status colors may move to tokens.
  - Do not restructure layouts yet.
- For content toast, add a small local token block inside `CONTENT_TOAST_CSS` because shadow DOM cannot rely on page-level variables.
  - Keep behavior and DOM structure unchanged in this step.
- Ensure no CSS depends on external fonts or remote assets.

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
   - `ADR.md`의 Vanilla DOM UI decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/3-liquid-glass-ui/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Added shared Liquid Glass design tokens and wired base CSS token usage."`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Options와 Popup layout을 이 step에서 재배치하지 말 것. 이유: token foundation과 layout changes를 분리한다.
- Decorative orb, glow blob, bokeh background를 만들지 말 것. 이유: `docs/UI_GUIDE.md` 금지 패턴이다.
- Remote font, image, icon dependency를 추가하지 말 것. 이유: local extension bundle이 외부 asset에 의존하면 안 된다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
