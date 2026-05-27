# Step 1: content-programmers-adapter

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/AGENTS.md`
- `/src/shared/types.ts`
- `/src/shared/messages.ts`
- `/src/content/detector.ts`
- `/src/content/index.ts`
- `/src/content/toast.ts`
- `/manifest.json`
- `/vite.content.config.ts`
- `/phases/1-programmers-support/index.json`

수정하기 전에 Step 0에서 변경된 shared platform contract와 tests를 주의 깊게 읽는다.

## 작업

Content layer를 platform adapter 구조로 확장하고 Programmers 감지와 snapshot 추출을 구현한다. 이 step은 content script와 manifest content match만 다룬다. Background commit orchestration은 Step 2에서 완성한다.

필수 동작:

- 현재 URL에서 platform을 판별한다.
  - LeetCode: `https://leetcode.com/problems/{titleSlug}/...`
  - Programmers: `https://school.programmers.co.kr/learn/courses/{courseId}/lessons/{lessonId}...`
- LeetCode 기존 detector 동작은 유지한다.
- Programmers detector는 `정답입니다!`를 Accepted 1차 신호로 감지한다.
- Programmers detector는 `통과`, `채점 결과`, `합계: 100.0 / 100.0` 단독 문구를 Accepted trigger로 보지 않는다.
- detector는 플랫폼 DOM class selector나 전체 page text scan에 의존하지 않고 `MutationObserver` 변경 범위의 bounded leaf text 후보만 검사한다.
- Programmers Accepted 감지 직후 snapshot을 만든다.
  - `courseId`
  - `lessonId`
  - `problemTitle`
  - `rawLanguage`
  - `code`
  - `pageUrl`
  - `detectedAt`
- Programmers code source는 `document.querySelector<HTMLTextAreaElement>("textarea#code")?.value`를 1차 source로 사용한다.
- `.cm-line` 렌더 DOM은 source of truth로 쓰지 않는다. 진단용 fallback helper가 필요하면 code가 비어 있는 경우 실패 판단에만 사용한다.
- code가 비어 있거나 `textarea#code`가 없으면 snapshot 실패 payload가 아니라 `programmers_extract_failed`로 이어질 수 있는 명확한 background 메시지 또는 failure-capable payload를 보낸다. 이때 GitHub commit을 만들면 안 된다.
- Manifest에 `https://school.programmers.co.kr/*` host permission과 `https://school.programmers.co.kr/learn/courses/*/lessons/*` content script match를 추가한다.
- Content bundle은 계속 IIFE로 빌드되어야 하고 `npm run build` 검증을 통과해야 한다.

테스트:

- LeetCode URL parsing과 Accepted detection 기존 tests를 유지한다.
- Programmers URL parsing, `정답입니다!` detection, `통과` false positive 방지, `textarea#code.value` extraction tests를 추가한다.
- content message 생성 tests에서 LeetCode와 Programmers payload shape를 모두 검증한다.

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

- Content script에서 GitHub API를 호출하지 말 것. 이유: 외부 write 작업은 background service worker 책임이다.
- Programmers 문제 설명 전문을 읽거나 저장하지 말 것. 이유: 저장 대상은 풀이 코드와 문제 메타데이터뿐이다.
- `.cm-line`만 조합해 solution code로 저장하지 말 것. 이유: 스크롤 밖 숨은 줄이 누락될 수 있다.
- 기존 test를 깨뜨리지 말 것.
