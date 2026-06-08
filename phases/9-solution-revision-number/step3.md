# Step 3: sync-payload-recalculation

## 읽을 파일

먼저 아래 파일을 읽고 background orchestration과 GitHub conflict retry 흐름을 이해한다:

- `/docs/ARCHITECTURE.md`
- `/docs/adr/0007-github-git-data-api-for-single-commit.md`
- `/docs/adr/0016-processed-after-commit-success-only.md`
- `/docs/adr/0027-solution-revision-numbered-commit-message.md`
- `/src/background/sync.ts`
- `/src/background/sync.test.ts`
- `/src/background/client/github.ts`
- `/src/background/client/github.test.ts`
- `/src/shared/solutionCatalog.ts`

수정하기 전에 Step 1과 Step 2에서 변경된 catalog/message contract를 주의 깊게 읽는다.

## 작업

background sync가 최신 Repository Catalog 기준으로 files와 message를 함께 계산하도록 변경한다.

- `src/background/sync.ts`
  - `PreparedCommit`에서 `commitMessage`를 제거한다.
  - `buildCommitFiles(...)`를 `buildCommitPayload(...)`로 바꾸고 `{ files, message }`를 반환하게 한다.
  - `buildCommitPayload(...)`는 `mergeSolutionCatalogEntryWithResult(...)`의 `solutionRevisionNumber`로 `buildGitHubCommitMessage(...)`를 호출한다.
  - accepted sync 최초 commit 시에도 repository의 현재 Solution Catalog를 읽은 뒤 message를 계산한다.
  - GitHub ref conflict retry에서도 최신 branch tree에서 Solution Catalog와 README를 다시 읽고 files와 message를 함께 재계산한다.
- `src/background/client/github.ts`
  - conflict callback 반환 타입을 `GitTreeFile[]`에서 `{ files, message }` 형태의 payload로 확장한다.
  - 최초 commit payload와 conflict retry payload의 message를 각각 해당 commit 생성 요청에 사용한다.
- `src/background/client/github.test.ts`
  - conflict retry가 refreshed files와 refreshed message를 사용한다는 테스트를 추가 또는 갱신한다.
- `src/background/sync.test.ts`
  - LeetCode 첫 sync commit message가 `#1`.
  - Programmers 첫 sync commit message가 `#1`.
  - 기존 v2 Catalog language entry 다음 sync가 `#2`.
  - 같은 문제의 다른 언어는 `#1`.
  - duplicate processed key는 commit과 revision 증가 없음.

## 인수 기준

```bash
npm test -- --run src/background/client/github.test.ts src/background/sync.test.ts
npm run typecheck
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `docs/adr/`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/9-solution-revision-number/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "one-line output summary"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- branch에 붙지 못한 중간 commit의 revision number를 영구 저장하지 말 것. 이유: ref conflict retry에서 최종 branch 반영 commit만 revision을 소비해야 한다.
- 별도 problem-language lock을 추가하지 말 것. 이유: 동시성은 기존 Sync Deduplication Key lock과 GitHub ref conflict retry로 처리한다.
- 기존 test를 깨뜨리지 말 것.
