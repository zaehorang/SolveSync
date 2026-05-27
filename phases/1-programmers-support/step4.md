# Step 4: integration-validation

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/UI_GUIDE.md`
- `/AGENTS.md`
- `/manifest.json`
- `/scripts/verify_extension_build.mjs`
- `/phases/1-programmers-support/index.json`

수정하기 전에 Step 0-3에서 변경된 code와 tests를 주의 깊게 읽는다.

## 작업

전체 통합 검증과 작은 마감 정리를 수행한다. 이 step은 새 기능 추가보다 회귀 제거, build 검증, test gap 보강에 집중한다.

필수 동작:

- `npm run typecheck`, `npm test`, `npm run build`를 실행하고 실패를 수정한다.
- `npm run build`가 content IIFE bundle에 static ESM `import`가 없다는 검증을 통과해야 한다.
- Manifest 권한이 최소 범위인지 확인한다.
  - `storage`
  - `https://leetcode.com/*`
  - `https://school.programmers.co.kr/*`
  - `https://api.github.com/*`
  - content matches는 LeetCode/Programmers 문제 페이지로 제한
- LeetCode 기존 successful sync tests가 기존 output path를 유지하는지 확인한다.
- Programmers successful sync tests가 `programmers/README.md`와 `programmers/.programmers-sync/index.json`을 같은 commit에 포함하는지 확인한다.
- 테스트 fixture에 실제 PAT, cookie, session token, private user code가 없는지 확인한다.
- README는 수정하지 않는다.
- 필요한 경우 `docs/MANUAL_VALIDATION.md`의 구현과 어긋난 항목만 최소 수정한다. 이미 문서가 구현과 맞으면 건드리지 않는다.

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
3. 이 step에 대해 `phases/1-programmers-support/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- README를 수정하지 말 것. 이유: 사용자가 명시적으로 요청하지 않은 README 변경은 금지되어 있다.
- Chrome Web Store, OAuth, Swift/Python3 외 언어 지원을 추가하지 말 것. 이유: v1 범위 밖이다.
- 실제 외부 GitHub commit을 만드는 수동 검증을 자동 test로 넣지 말 것. 이유: unit/build 검증은 네트워크와 사용자 PAT 없이 실행되어야 한다.
- 기존 test를 깨뜨리지 말 것.
