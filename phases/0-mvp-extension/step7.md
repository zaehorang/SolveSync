# Step 7: content-toast

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md`
- `/src/shared/messages.ts`
- `/src/background/runtime.ts`
- `/src/content/index.ts`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 background runtime message contract를 주의 깊게 읽는다.

## 작업

LeetCode content script에서 Accepted 감지와 toast UI를 구현한다.

생성 또는 수정할 파일:

- `src/content/index.ts`
- `src/content/toast.ts`
- `src/content/detector.ts`
- `src/content/styles.css` 또는 content script가 주입하는 style module
- `src/content/*.test.ts` 가능한 순수 함수 테스트
- 필요한 manifest/Vite 설정 조정

필수 기능:

- `https://leetcode.com/problems/*` 페이지에서 현재 URL의 `titleSlug` 추출
- `MutationObserver`로 Accepted 결과 변화 감지
- DOM 변화 반복에 대한 debounce
- accepted detected runtime message를 background로 전송
- background status message를 받아 toast 상태 갱신
- toast states: setup required, auto sync off, syncing, synced, unsupported language, failed
- success 상태는 commit link/file link가 있을 때 표시
- failure 상태는 Popup 또는 Options action 제공
- setup required 상태는 Options action 제공

요구사항:

- content script는 GitHub API를 직접 호출하지 않는다.
- DOM은 Accepted 이벤트 감지에만 사용하고 submission code를 긁어오지 않는다.
- Toast는 오른쪽 아래 fixed position이며 일반 desktop width에서 submit/editor control을 가리지 않도록 작고 절제된 UI로 만든다.
- Toast에 긴 technical stack trace를 표시하지 않는다.
- 링크 클릭 전 GitHub tab을 자동으로 열지 않는다.

테스트:

- titleSlug extraction
- Accepted text detector
- debounce가 반복 감지를 줄임
- status-to-toast model mapping

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
   - 성공: `"status": "completed"`로 설정하고 `"summary": "content script Accepted detector and compact LeetCode toast UI wired to background messages"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- LeetCode DOM에서 solution code를 추출하지 말 것. 이유: code는 GraphQL client에서 가져와야 한다.
- GitHub API 호출을 content script에 넣지 말 것. 이유: 외부 write는 background service worker만 수행한다.
- Toast에 stack trace나 긴 debug detail을 표시하지 말 것. 이유: UI_GUIDE는 짧은 상태 문구를 요구한다.
- 기존 test를 깨뜨리지 말 것.
