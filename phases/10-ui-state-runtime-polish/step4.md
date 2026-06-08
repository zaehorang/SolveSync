# Step 4: options-mobile-hierarchy

## 읽을 파일

먼저 아래 파일을 읽고 Options layout과 이전 picker 변경을 이해한다:

- `AGENTS.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0004-vanilla-dom-ui.md`
- `phases/10-ui-state-runtime-polish/index.json`
- `src/options/index.html`
- `src/options/index.ts`
- `src/options/styles.css`
- `src/options/index.test.ts`
- `src/options/options.test.ts`

수정하기 전에 Step 3 summary와 repository picker 변경을 확인한다.

## 작업

Options의 mobile segmented control과 sticky Save controls hierarchy를 조정한다.

- `src/options/styles.css`
  - mobile media query에서 `.segmented-control`을 `grid-template-columns: 1fr`로 바꾸는 규칙을 제거하거나 override한다.
  - 360px 폭에서 `System / English / 한국어`가 한 segmented control 안의 세 column으로 유지되게 한다.
  - 필요하면 segmented button padding/font-size/min-width를 줄인다.
  - selected/focus state는 유지한다.
  - sticky Save controls는 유지한다.
  - Save controls가 빈 status 공간을 차지하지 않게 한다.
  - Save controls shadow/background가 setup steps보다 과하게 두드러지면 낮춘다.
  - narrow viewport에서 Save button은 full-width로 reachable해야 한다.
  - 긴 form 하단 content가 sticky bar에 가리지 않도록 bottom padding 또는 spacing을 확인한다.
- `src/options/index.ts`
  - 필요하면 empty save message 렌더링 시 불필요한 error/visible state가 남지 않게 조정한다.
- `src/options/options.test.ts` 또는 `src/options/index.test.ts`
  - CSS에 mobile `.segmented-control` 단일 column 회귀가 없는지 검증한다.
  - save status empty state가 misleading error text/class를 노출하지 않는지 검증한다.

## 인수 기준

```bash
npm test -- --run src/options/index.test.ts src/options/options.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - Options UI 책임 안의 layout/style 변경으로 제한했는가?
   - `docs/UI_GUIDE.md`의 Language segmented control, Save controls, mobile readability 기준을 충족하는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/10-ui-state-runtime-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Kept language segmented control horizontal at 360px and reduced sticky Save controls visual dominance"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- sticky Save controls를 제거하지 말 것. 이유: 긴 Options form에서 Save가 항상 reachable해야 한다.
- viewport width 기반으로 font-size를 scale하지 말 것. 이유: UI Guide가 viewport width 기반 font scaling을 금지한다.
- card 안에 또 다른 decorative card를 추가하지 말 것. 이유: UI Guide가 nested card 구조를 금지한다.
- 기존 test를 깨뜨리지 말 것.
