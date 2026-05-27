# Step 5: leetcode-client

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/src/shared/types.ts`
- `/src/shared/language.ts`
- `/src/shared/errorNormalize.ts`
- `/src/background/client/github.ts`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 이전 step에서 작성된 GitHub client 패턴을 주의 깊게 읽는다.

## 작업

LeetCode GraphQL 우선 API client를 `src/background/client` 아래에 격리해 구현한다.

생성 또는 수정할 파일:

- `src/background/client/leetcode.ts`
- `src/background/client/leetcode.test.ts`
- 필요한 shared 타입 또는 error normalization 보강

필수 기능:

- `fetchProblemMetadata(titleSlug)` 형태의 함수로 problem id, frontend id, title, title slug, difficulty, URL에 필요한 metadata를 반환한다.
- `fetchLatestAcceptedSubmission(titleSlug)` 형태의 함수로 latest accepted submission id, language, code, submittedAt 등을 반환한다.
- GraphQL query와 response parsing은 client 내부에 중앙화한다.
- LeetCode response language를 `SupportedLanguage`로 매핑하고 unsupported는 commit 대상이 아님을 표현한다.
- 로그인 만료, 세션 문제, fetch 실패, malformed response를 normalized error로 반환한다.

요구사항:

- DOM에서 code를 긁어오지 않는다. DOM은 Accepted 이벤트 감지에만 쓰인다.
- LeetCode 문제 설명 전문을 저장하거나 반환하지 않는다.
- 실제 LeetCode cookie, session token을 코드, fixture, 문서 예시에 넣지 않는다.
- 테스트는 fetch mock으로 수행한다. 실제 LeetCode API를 호출하지 않는다.
- API shape 변경에 대비해 response parser를 작게 분리한다.

테스트:

- metadata response parsing
- latest accepted submission parsing
- unsupported language 처리
- auth required normalize
- malformed response normalize
- code 없는 accepted submission은 sync 불가 실패로 처리

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
   - 성공: `"status": "completed"`로 설정하고 `"summary": "LeetCode GraphQL background client for metadata and latest accepted submission parsing"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- LeetCode 문제 설명 전문을 storage, GitHub payload, test fixture에 넣지 말 것. 이유: CRITICAL 보안/개인정보 규칙 위반이다.
- content script에서 LeetCode API client를 호출하게 만들지 말 것. 이유: external API client는 background에 격리한다.
- 실제 cookie/session/token 값을 fixture로 쓰지 말 것. 이유: CRITICAL 보안 규칙 위반이다.
- 기존 test를 깨뜨리지 말 것.
