# Step 2: shared-sync-logic

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/src/shared/types.ts`
- `/src/shared/messages.ts`
- `/src/shared/storageSchema.ts`
- `/src/shared/errors.ts`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 Step 1에서 작성된 shared contract를 주의 깊게 읽는다.

## 작업

순수 함수 기반의 sync 도메인 로직을 `src/shared` 아래에 구현하고 Vitest 테스트를 작성한다.

생성 또는 수정할 파일:

- `src/shared/language.ts`
- `src/shared/paths.ts`
- `src/shared/indexFile.ts`
- `src/shared/readme.ts`
- `src/shared/githubTree.ts`
- `src/shared/errorNormalize.ts`
- `src/shared/index.ts`
- 관련 `*.test.ts`

필수 함수:

- `mapLeetCodeLanguage(raw: string): SupportedLanguage | null`
- `buildSubmissionIdentity(input): SubmissionIdentity`
- `buildSolutionPath(problem, language): string`
- `mergeIndexEntry(index, submission, path, syncedAt): LeetCodeSyncIndex`
- `createEmptyIndex(): LeetCodeSyncIndex`
- `parseIndexJson(text: string): LeetCodeSyncIndex`
- `renderManagedReadmeTable(index): string`
- `mergeReadmeManagedBlock(existingReadme, table): string`
- `buildInitialReadme(table): string`
- `buildGitTreeFiles(input): Array<{ path: string; content: string }>`
- `normalizeError(error): NormalizedError`

요구사항:

- Swift path는 `swift/leetcode/0001_two_sum.swift` 형식이다.
- Python3 path는 `python/leetcode/0001_two_sum.py` 형식이다.
- Swift 파일을 `swift/SwiftAlgorithm` 아래에 생성하는 로직은 없어야 한다.
- README marker 문자열은 정확히 `<!-- LEETCODE_TABLE_START -->`, `<!-- LEETCODE_TABLE_END -->`를 사용한다.
- README marker 밖 기존 내용은 보존한다.
- README가 없으면 최소 README와 marker block을 생성한다.
- README가 있지만 marker가 없으면 파일 하단에 marker block을 추가한다.
- README table row는 numeric problem id 오름차순 정렬한다.
- LeetCode 문제 설명 전문을 저장하는 타입이나 함수 인자를 추가하지 않는다.
- malformed index는 normalize 가능한 error로 이어질 수 있게 한다.

테스트:

- Swift/Python3 language mapping
- unsupported language returns null
- solution path 생성
- index 신규 생성과 같은 문제/언어 overwrite
- README marker replacement와 marker 없는 README 처리
- README 없는 경우 생성
- Git tree file payload가 solution, README, `.leetcode-sync/index.json`을 포함
- error normalization 주요 code

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
   - 성공: `"status": "completed"`로 설정하고 `"summary": "shared pure sync logic for language mapping, paths, index, README, tree payload, and errors"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- GitHub 폴더 생성 API 개념을 추가하지 말 것. 이유: 파일 commit으로 중간 폴더가 생기게 해야 한다.
- README 갱신 toggle 또는 README 비갱신 mode를 만들지 말 것. 이유: ADR-013은 README 항상 갱신을 결정했다.
- LeetCode 문제 설명 전문을 fixture에 넣지 말 것. 이유: CRITICAL 보안/개인정보 규칙 위반이다.
- 기존 test를 깨뜨리지 말 것.
