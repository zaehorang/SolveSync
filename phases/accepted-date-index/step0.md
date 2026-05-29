# Step 0: accepted-date-index

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/AGENTS.md`
- `/src/shared/indexFile.ts`
- `/src/shared/readme.ts`
- `/src/background/sync.ts`
- `/src/shared/indexFile.test.ts`
- `/src/shared/readme.test.ts`
- `/src/background/sync.test.ts`

수정하기 전에 현재 index merge, README table generation, GitHub commit file generation 흐름을 주의 깊게 읽는다.

## 작업

Accepted 날짜 기반 metadata를 platform index와 platform README에 추가한다. 아직 배포 전 변경이므로 기존 index schema migration 또는 backwards-compatible parsing은 만들지 않는다.

구현 요구사항:

- `src/shared/indexFile.ts`
  - `LeetCodeSyncIndexLanguageEntry`에 `firstAcceptedDate: IsoDateString`과 `lastAcceptedDate: IsoDateString`를 추가한다. 값은 실제로 `YYYY-MM-DD` 문자열이지만 기존 shared type convention에 맞춰 `IsoDateString` alias를 재사용해도 된다.
  - `LeetCodeSyncIndexProblem`에도 `firstAcceptedDate`와 `lastAcceptedDate`를 추가한다.
  - `LeetCodeSyncIndex` root에 `activity`를 추가한다.
    - 최소 shape: `{ days: Record<string, { acceptedCount: number; newProblemCount: number }> }`
    - `acceptedCount`: 해당 local date에 sync된 Accepted submission 수.
    - `newProblemCount`: 해당 local date에 index에 새로 추가된 problem 수.
  - `createEmptyIndex()`는 `activity.days`가 비어 있는 새 index를 반환한다.
  - `mergeIndexEntry(...)` signature를 accepted date를 받을 수 있게 바꾼다. 예: `mergeIndexEntry(index, submission, path, syncedAt, acceptedDate)`.
  - 같은 problem/language의 새 Accepted는 기존 solution path를 덮어쓰되, language/problem의 `firstAcceptedDate`는 보존하고 `lastAcceptedDate`는 새 accepted date 기준으로 갱신한다.
  - 같은 language entry의 `lastSubmissionId`와 새 `submission.submissionId`가 같으면 activity count를 중복 증가시키지 않는다.
  - 새 problem이 처음 추가되는 경우에만 해당 date의 `newProblemCount`를 1 증가시킨다.
  - `isLeetCodeSyncIndex` validation은 새 field가 없으면 malformed로 판정한다. migration fallback을 추가하지 않는다.

- `src/background/sync.ts`
  - `AcceptedSubmission.acceptedAt`에서 browser/service-worker local date 기준 `YYYY-MM-DD`를 계산한다.
  - UTC ISO slice를 쓰지 않는다. `new Date(acceptedAt)` 뒤 `getFullYear()`, `getMonth() + 1`, `getDate()`를 사용해 local date를 만든다.
  - `buildCommitFiles`에서 `mergeIndexEntry`에 `acceptedDate`를 전달한다.
  - LeetCode는 기존 GraphQL submission timestamp에서 만들어진 `submission.acceptedAt`을 사용한다.
  - Programmers는 기존 `payload.detectedAt` 기반 `submission.acceptedAt`을 사용한다.

- `src/shared/readme.ts`
  - platform README managed table header를 `| # | Title | Difficulty | Solved | Swift | Python |`로 확장한다.
  - row의 `Solved` cell에는 problem-level `firstAcceptedDate`를 렌더링한다.
  - 기존 marker 밖 내용 보존과 platform-relative solution link 동작은 유지한다.

- Tests
  - `src/shared/indexFile.test.ts`를 업데이트해 새 index shape, date field merge, activity aggregation, same submission idempotence, same problem new submission date update를 검증한다.
  - `src/shared/readme.test.ts`를 업데이트해 `Solved` column과 날짜 렌더링을 검증한다.
  - `src/background/sync.test.ts`를 업데이트해 LeetCode와 Programmers successful commit index JSON에 accepted date와 activity aggregate가 포함되는지 검증한다.
  - 필요하면 기존 fixture expected object를 새 schema에 맞게 갱신한다.

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
3. 이 step에 대해 `phases/accepted-date-index/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "acceptedDate metadata added to sync index, README table, and sync commit tests"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- migration code 또는 backwards-compatible parser를 추가하지 말 것. 이유: 아직 배포 전이고 사용자는 현재 target repo JSON을 직접 보정하기로 했다.
- index에 `acceptedAt`, `firstAcceptedAt`, `lastAcceptedAt` 같은 timestamp field를 추가하지 말 것. 이유: 이번 요구사항은 날짜 기반 README/count/streak source이고 `YYYY-MM-DD`만 저장하기로 했다.
- target repository를 코드 기본값으로 고정하지 말 것. 이유: SolveSync는 Options에서 선택한 repository와 branch에 동기화하는 제품이다.
- 대상 저장소 루트 `README.md` 자동 갱신 기능을 추가하지 말 것. 이유: 이번 범위는 platform index와 platform README까지다.
- LeetCode/Programmers 문제 설명 전문, PAT, cookie, session token, 실제 사용자 secret을 source/test/docs에 넣지 말 것.
- 기존 test를 깨뜨리지 말 것.
