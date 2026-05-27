# Step 9: popup-ui

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md`
- `/src/shared/messages.ts`
- `/src/shared/types.ts`
- `/src/popup/index.html`
- `/src/popup/index.ts`
- `/src/popup/styles.css`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 background runtime message contract와 sync history/retry model을 주의 깊게 읽는다.

## 작업

Popup page를 빠른 제어와 운영 상태 확인 화면으로 구현한다.

생성 또는 수정할 파일:

- `src/popup/index.html`
- `src/popup/index.ts`
- `src/popup/styles.css`
- `src/popup/popup.test.ts` 가능한 순수 state reducer 테스트
- 필요한 shared message/type 보강

필수 UI:

- Auto Sync toggle
- setup status summary
- Options link
- 최근 sync history, 최신 항목 위
- history empty state
- success item의 commit link와 file link
- failure item의 짧은 error summary
- 선택 또는 펼침 가능한 failure detail panel
- retry 가능한 실패 payload에만 Retry button
- unsupported language item은 commit이 만들어지지 않은 이유 표시

필수 동작:

- popup load 시 settings와 history를 background message로 읽는다.
- Auto Sync toggle 변경은 settings update message로 저장한다.
- Retry button은 retry payload가 있는 item에만 표시한다.
- Retry 중에는 button을 disable하고 진행 중 상태를 표시한다.
- Retry 성공 후 item에 commit/file link를 반영한다.
- Retry 실패 후 payload는 유지하고 error detail을 갱신한다.
- retry payload가 만료되었거나 삭제된 항목에는 Retry button을 숨긴다.
- 일반 수동 sync button은 제공하지 않는다.

스타일:

- 일반 extension popup width에서 horizontal scroll 없이 표시한다.
- compact spacing과 neutral palette를 사용한다.
- nested card 구조를 만들지 않는다.
- 색상만으로 상태를 전달하지 않는다.

테스트:

- history sort/display model
- retry button visibility
- Auto Sync toggle message
- failure detail mapping
- unsupported language display model

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
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Popup UI for Auto Sync, setup status, recent history, failure detail, and retry controls"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- Auto Sync off 상태에서 일반 수동 sync button을 추가하지 말 것. 이유: v1 범위는 실패 Retry뿐이다.
- Retry payload가 없는 item에 Retry button을 표시하지 말 것. 이유: retry는 GitHub commit 실패 payload에만 가능하다.
- GitHub link를 자동으로 열지 말 것. 이유: 사용자가 link를 클릭할 때만 navigation해야 한다.
- 기존 test를 깨뜨리지 말 것.
