# Step 2: background-platform-sync

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/AGENTS.md`
- `/src/shared/types.ts`
- `/src/shared/messages.ts`
- `/src/shared/paths.ts`
- `/src/shared/indexFile.ts`
- `/src/shared/readme.ts`
- `/src/shared/errorNormalize.ts`
- `/src/background/sync.ts`
- `/src/background/runtime.ts`
- `/src/background/storage.ts`
- `/src/background/client/leetcode.ts`
- `/src/background/client/github.ts`
- `/phases/1-programmers-support/index.json`

수정하기 전에 Step 0과 Step 1에서 변경된 shared/content code를 주의 깊게 읽는다.

## 작업

Background sync orchestration을 platform source resolver 기반으로 완성한다. 이 step은 background orchestration과 GitHub commit payload 생성을 다룬다. UI 표시 문구 정리는 Step 3에서 처리한다.

필수 동작:

- `handleAcceptedDetected`는 platform discriminated payload를 받는다.
- setup required와 Auto Sync off 판단은 platform 공통으로 유지한다.
- LeetCode source resolver는 기존 GraphQL client 흐름을 유지한다.
- Programmers source resolver는 content snapshot에서 다음 값을 만든다.
  - `ProblemMetadata`: `problemId`와 `frontendId`는 `lessonId`, `title`은 snapshot title, `titleSlug`는 lesson/title 기반 stable slug, `difficulty`는 `-`, `url`은 page URL.
  - `AcceptedSubmission`: deterministic submission id, title slug, raw language, code, acceptedAt.
  - `SubmissionIdentity`: `platform: "programmers"`, deterministic submission id, title slug, supported language.
- Programmers deterministic submission id는 `programmers:{lessonId}:{language}:{codeHash}` 형식이다. `codeHash`는 deterministic이고 테스트 가능한 짧은 hash면 충분하다.
- Programmers code/title/language/lesson id가 부족하면 `programmers_extract_failed`로 failed history를 기록하고 GitHub commit 및 retry payload를 만들지 않는다.
- unsupported language는 두 플랫폼 모두 `unsupported_language`로 기록하고 commit하지 않는다.
- processed, in-flight lock, retry payload는 `platform`, `submissionId`, `titleSlug`, language 조합으로 중복을 판단한다.
- solution path, README path, index path, README marker는 platform policy를 사용한다.
- LeetCode commit 결과는 기존과 동일한 path와 README/index를 유지한다.
- Programmers commit은 solution file, `programmers/README.md`, `programmers/.programmers-sync/index.json`을 같은 GitHub commit에 포함한다.
- commit message는 platform별 prefix를 사용한다.
  - LeetCode: `solve: leetcode 0001 two sum in swift`
  - Programmers: `solve: programmers 120804 두 수의 곱 구하기 in swift`
- retry payload에는 platform README/index path가 저장되고 retry 시 같은 platform commit payload를 재생성한다.

테스트:

- 기존 LeetCode background sync tests는 기존 path와 behavior를 유지해야 한다.
- Programmers successful sync, duplicate processed, duplicate in-flight, unsupported language, extract failed without retry payload, retry success tests를 추가한다.
- malformed platform index는 `malformed_index`로 실패하고 retry payload를 만들지 않는 기존 정책을 유지한다.

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

- Background에서 Programmers DOM selector를 직접 알게 하지 말 것. 이유: DOM/editor 변경 영향은 content adapter에 격리한다.
- Programmers 비공식 제출 상세 API를 호출하지 말 것. 이유: v1은 현재 페이지 snapshot 기반으로만 동작한다.
- GitHub folder 생성 API를 추가하지 말 것. 이유: 파일 commit으로 중간 folder를 생성하는 정책이다.
- 기존 test를 깨뜨리지 말 것.
