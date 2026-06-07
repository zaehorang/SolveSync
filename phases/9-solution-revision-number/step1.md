# Step 1: catalog-revision

## 읽을 파일

먼저 아래 파일을 읽고 Solution Catalog와 README projection 계약을 이해한다:

- `/CONTEXT.md`
- `/docs/ARCHITECTURE.md`
- `/docs/adr/0008-solution-catalog-as-readme-source-of-truth.md`
- `/docs/adr/0015-overwrite-latest-solution-for-same-problem-language.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/docs/adr/0027-solution-revision-numbered-commit-message.md`
- `/src/shared/solutionCatalog.ts`
- `/src/shared/indexFile.test.ts`
- `/src/shared/githubTree.ts`
- `/src/shared/githubTree.test.ts`

수정하기 전에 Step 0에서 갱신한 docs를 주의 깊게 읽는다.

## 작업

Solution Catalog v3와 revision merge contract를 구현한다.

- `src/shared/solutionCatalog.ts`
  - `SOLUTION_CATALOG_VERSION`을 `3`으로 올린다.
  - v1과 v2 Catalog를 정상 legacy schema로 취급해 v3로 normalize한다.
  - `SolutionCatalogLanguageEntry`에 `solutionRevisionNumber: number`를 추가한다.
  - v1 `lastSubmissionId`와 v2 `lastAcceptedSourceId` normalize 결과의 기존 language entry는 `solutionRevisionNumber: 1`로 설정한다.
  - v3에서 `solutionRevisionNumber`가 누락, 0, 음수, 소수, string 등 positive integer가 아니면 `MalformedSolutionCatalogError`가 나야 한다.
  - `mergeSolutionCatalogEntryWithResult(...)`를 추가하고 `{ catalog, solutionRevisionNumber }`를 반환한다.
    - 새 문제+언어는 `1`.
    - 같은 `lastAcceptedSourceId`는 기존 revision을 유지한다.
    - 다른 `acceptedSourceId`는 기존 revision에서 `+1`.
  - 기존 `mergeSolutionCatalogEntry(...)`는 wrapper로 유지하고 기존 call site가 깨지지 않게 한다.
- `src/shared/indexFile.test.ts`
  - empty Catalog v3 생성.
  - v1 `lastSubmissionId`와 v2 `lastAcceptedSourceId`가 v3 + `solutionRevisionNumber: 1`로 normalize.
  - 새 Accepted Source ID는 revision 증가.
  - 같은 Accepted Source ID는 revision 유지.
  - malformed v3 revision 필드 reject.
- `src/shared/githubTree.test.ts`
  - serialized Catalog snapshot 기대값을 v3 shape로 갱신한다.

## 인수 기준

```bash
npm test -- --run src/shared/indexFile.test.ts src/shared/githubTree.test.ts src/shared/readme.test.ts
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

- Solution README 렌더링에 revision 번호를 넣지 말 것. 이유: README는 기존 projection UI를 유지한다.
- v1/v2 Catalog를 즉시 별도 migration commit으로 쓰는 코드를 만들지 말 것. 이유: 다음 성공 sync commit에서 자연스럽게 v3가 반영된다.
- 기존 test를 깨뜨리지 말 것.
