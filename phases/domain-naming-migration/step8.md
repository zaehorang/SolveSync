# Step 8: swift-algorithm-catalog

## 읽을 파일

먼저 아래 파일을 읽고 external Sync Repository migration 계약을 확인한다:

- `/CONTEXT.md`
- `/AGENTS.md`
- `/docs/ARCHITECTURE.md`
- `/docs/MANUAL_VALIDATION.md`
- `/docs/adr/0008-solution-catalog-as-readme-source-of-truth.md`
- `/docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `/src/shared/solutionCatalog.ts`
- `/src/shared/solutionCatalog.test.ts`

수정하기 전에 Step 1에서 확정한 Solution Catalog v2 schema를 확인한다.

## 작업

현재 SolveSync 기능을 쓰는 Sync Repository `zaehorang/Swift_Algorithm`의 Solution Catalog 파일을 v2로 migration하고 `main`에 직접 push한다.

대상 repo:

- `https://github.com/zaehorang/Swift_Algorithm`
- branch: `main`

작업 절차:

1. `/private/tmp` 아래 새 작업 디렉터리에 repo를 clone한다.
2. 최신 `main`을 기준으로 작업한다.
3. 다음 두 파일만 migration한다:
   - `leetcode/.leetcode-sync/index.json`
   - `programmers/.programmers-sync/index.json`
4. 각 catalog JSON:
   - `version`을 `2`로 바꾼다.
   - 모든 language entry의 `lastSubmissionId`를 `lastAcceptedSourceId`로 바꾼다.
   - 값은 그대로 보존한다.
   - `solutionPath`, accepted date fields, activity fields는 변경하지 않는다.
5. 다음 파일은 변경하지 않는다:
   - `leetcode/README.md`
   - `programmers/README.md`
   - solution files
   - `swift/SwiftAlgorithm/**`
6. JSON validity를 확인한다.
7. Commit message:
   - `chore: align SolveSync catalog naming`
8. `main`에 직접 push한다.

검증 command 예시:

```bash
python3 -m json.tool leetcode/.leetcode-sync/index.json >/tmp/leetcode-catalog-check.json
python3 -m json.tool programmers/.programmers-sync/index.json >/tmp/programmers-catalog-check.json
rg -n "lastSubmissionId" leetcode/.leetcode-sync/index.json programmers/.programmers-sync/index.json
rg -n "lastAcceptedSourceId" leetcode/.leetcode-sync/index.json programmers/.programmers-sync/index.json
git diff --name-only HEAD~1 HEAD
```

## 인수 기준

```bash
git status --short
git log -1 --oneline
```

그리고 remote state를 확인한다:

```bash
gh api -H 'Accept: application/vnd.github.raw' 'repos/zaehorang/Swift_Algorithm/contents/leetcode/.leetcode-sync/index.json?ref=main'
gh api -H 'Accept: application/vnd.github.raw' 'repos/zaehorang/Swift_Algorithm/contents/programmers/.programmers-sync/index.json?ref=main'
```

Remote catalog에는 `version: 2`, `lastAcceptedSourceId`가 있어야 하고 `lastSubmissionId`가 없어야 한다.

## 검증

1. 인수 기준 command를 실행한다.
2. `/Users/zaehorang/Projects/SolveSync` repo에는 external clone 변경을 복사하지 않는다.
3. 이 step에 대해 `phases/domain-naming-migration/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Swift_Algorithm main catalog JSON migrated to Solution Catalog v2 with lastAcceptedSourceId"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `Swift_Algorithm`의 README나 solution files를 수정하지 말 것. 이유: 이번 외부 repo 작업은 catalog naming migration만이다.
- `swift/SwiftAlgorithm/**`를 수정하지 말 것. 이유: Xcode build source folder는 SolveSync sync output 대상이 아니다.
- Catalog file path를 바꾸지 말 것. 이유: 사용자가 `index.json` 파일명 유지를 결정했다.
- `/Users/zaehorang/Projects/SolveSync` 안에 external repo clone을 만들지 말 것. 이유: workspace git 상태와 harness commits를 오염시키지 않기 위해서다.
