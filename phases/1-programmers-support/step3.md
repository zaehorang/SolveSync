# Step 3: ui-platform-surface

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/UI_GUIDE.md`
- `/docs/ADR.md`
- `/AGENTS.md`
- `/src/content/toast.ts`
- `/src/popup/index.ts`
- `/src/popup/index.html`
- `/src/popup/styles.css`
- `/src/options/index.ts`
- `/src/options/index.html`
- `/src/options/styles.css`
- `/src/shared/types.ts`
- `/src/shared/errorNormalize.ts`
- `/phases/1-programmers-support/index.json`

수정하기 전에 Step 0-2에서 변경된 shared/content/background code를 주의 깊게 읽는다.

## 작업

사용자 surface를 LeetCode-only 문구에서 platform-aware 문구로 정리한다. 이 step은 Options, Popup, Toast UI 표현과 관련 tests만 다룬다.

필수 동작:

- Popup history item에 platform label을 표시한다. label은 `LeetCode` 또는 `Programmers`다.
- Toast의 문제 제목 fallback은 platform-aware record에서도 깨지지 않아야 한다.
- `programmers_extract_failed`는 Popup/Toast에서 사용자가 이해 가능한 짧은 메시지와 retry 불가 상태로 표시한다.
- Options와 Popup의 보안 문구는 LeetCode/Programmers 문제 설명 전문을 저장하지 않는다고 안내한다.
- LeetCode-only title/eyebrow/copy가 있으면 `Problem sync`, `Accepted sync`, `LeetCode and Programmers` 같은 제품 범위에 맞는 표현으로 바꾼다.
- 일반 수동 sync button은 추가하지 않는다. Retry는 기존처럼 GitHub commit retry payload에만 제공한다.
- UI 업무 규칙은 shared/background에 두고 UI 코드는 얇게 유지한다.

테스트:

- Popup render tests에서 platform label이 표시되는지 검증한다.
- Toast tests에서 Programmers failed/synced record를 렌더링할 수 있는지 검증한다.
- Options/Popup security disclosure 관련 tests가 있으면 LeetCode/Programmers 문구로 갱신한다.

## 인수 기준

```bash
npm run build
npm test
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/1-programmers-support/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- UI에 일반 수동 sync action을 추가하지 말 것. 이유: v1 범위에서 사용자가 직접 실행할 수 있는 것은 Retry뿐이다.
- UI에서 PAT 값을 평문으로 계속 노출하지 말 것. 이유: 보안 disclosure와 최소 노출 정책을 지켜야 한다.
- Platform label 때문에 버튼/카드 텍스트가 overflow되게 만들지 말 것. 이유: UI_GUIDE의 responsive text 규칙 위반이다.
- 기존 test를 깨뜨리지 말 것.
