# Step 1: solution-catalog-v2

## 읽을 파일

먼저 아래 파일을 읽고 Solution Catalog와 GitHub commit file generation 흐름을 이해한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0008-solution-catalog-as-readme-source-of-truth.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/shared/indexFile.ts`
- `/src/shared/readme.ts`
- `/src/shared/githubTree.ts`
- `/src/shared/platformPolicy.ts`
- `/src/background/sync.ts`
- `/src/shared/indexFile.test.ts`
- `/src/shared/readme.test.ts`
- `/src/background/sync.test.ts`

수정하기 전에 Step 0에서 작성한 문서를 확인한다.

## 작업

Solution Catalog 코드를 v2 naming으로 정렬한다. 실제 target repository 파일 경로는 바꾸지 않는다.

구현 요구사항:

- `src/shared/indexFile.ts`를 Solution Catalog 중심 naming으로 바꾼다.
  - 가능하면 파일명도 `src/shared/solutionCatalog.ts`로 바꾼다.
  - public export와 import 경로도 새 이름으로 정렬한다.
- Catalog version:
  - `LEETCODE_SYNC_INDEX_VERSION` 계열 이름을 `SOLUTION_CATALOG_VERSION` 계열 이름으로 바꾼다.
  - 새 catalog writer는 `version: 2`를 쓴다.
- Schema rename:
  - language entry의 `lastSubmissionId`를 `lastAcceptedSourceId`로 바꾼다.
  - merge input은 `acceptedSourceId`를 받도록 바꾼다.
  - 기존 `solutionPath`, accepted date fields, activity shape는 유지한다.
- Backward-compatible parser:
  - v1 catalog JSON의 `lastSubmissionId`를 읽어 v2 `lastAcceptedSourceId`로 normalize한다.
  - malformed state는 기존처럼 `MalformedIndexError` 계열 error로 처리하되, 이름은 Solution Catalog에 맞게 조정한다.
- Path policy:
  - `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json` 경로는 유지한다.
  - 코드 식별자는 `solutionCatalogPath` 같은 이름을 사용한다.
- README rendering은 v2 catalog를 source로 계속 사용한다.
- GitHub tree payload builder input은 `solutionCatalogPath`와 `solutionCatalog` naming을 사용한다.

Tests:

- v1 catalog가 v2로 normalize되는 test를 추가한다.
- v2 writer가 `lastAcceptedSourceId`만 쓰고 `lastSubmissionId`를 쓰지 않는지 검증한다.
- LeetCode와 Programmers sync commit test가 v2 catalog JSON을 포함하는지 갱신한다.

## 인수 기준

```bash
npm run typecheck
npm test -- src/shared/indexFile.test.ts src/shared/readme.test.ts src/shared/githubTree.test.ts src/background/sync.test.ts
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. `rg -n "lastSubmissionId|LeetCodeSyncIndex|indexPath|readmePath" src/shared src/background`를 실행한다.
   - `lastSubmissionId`는 v1 legacy parser/test 설명에만 남아야 한다.
   - `indexPath`와 `readmePath`는 아직 migration 중이면 compatibility 영역에만 남아야 한다.
3. 이 step에 대해 `phases/domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Solution Catalog v2 introduced with lastAcceptedSourceId and legacy v1 parsing"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `leetcode/.leetcode-sync/index.json` 또는 `programmers/.programmers-sync/index.json` 경로를 바꾸지 말 것. 이유: 사용자가 catalog 파일명은 유지하기로 결정했다.
- README table layout을 임의로 바꾸지 말 것. 이유: 이번 step은 catalog schema naming migration이다.
- Sync Repository의 solution file path를 바꾸지 말 것. 이유: 기존 README links와 target repository 구조를 보존해야 한다.
- 기존 test를 깨뜨리지 말 것.
