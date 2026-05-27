# Step 6: sync-orchestrator

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/src/shared/messages.ts`
- `/src/shared/types.ts`
- `/src/shared/indexFile.ts`
- `/src/shared/readme.ts`
- `/src/shared/githubTree.ts`
- `/src/background/storage.ts`
- `/src/background/client/github.ts`
- `/src/background/client/leetcode.ts`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 이전 step에서 작성된 storage와 API clients를 주의 깊게 읽는다.

## 작업

Background service worker의 sync orchestration과 runtime message handling을 구현한다.

생성 또는 수정할 파일:

- `src/background/sync.ts`
- `src/background/runtime.ts`
- `src/background/index.ts`
- `src/background/sync.test.ts`
- 필요한 shared 타입 또는 message 보강

필수 기능:

- service worker top-level에서 runtime listener 등록
- content의 accepted detected message 처리
- settings와 Auto Sync 확인
- setup required, auto sync disabled 상태 처리
- LeetCode metadata/latest accepted submission 조회
- unsupported language는 history에 기록하고 commit하지 않음
- identity 생성 및 processed duplicate check
- storage 기반 in-flight lock acquire/release
- GitHub commit payload 생성
- commit 성공 후에만 processed 기록
- success/failure history append
- GitHub commit 단계 실패에만 retry payload 저장
- retry message 처리: 저장된 payload로 GitHub commit 단계만 재시도
- content/popup에 status/history update 메시지 broadcast

요구사항:

- Content script는 GitHub API를 직접 호출하지 않으며, orchestrator만 write 작업을 수행한다.
- 같은 identity는 동시에 하나만 처리한다.
- terminal success/failure 후 in-flight lock을 삭제한다.
- retry 성공 후 retry payload를 삭제한다.
- retry 실패 후 payload를 유지하고 failure detail을 갱신한다.
- branch conflict retry는 GitHub client에서 제공한 hook을 사용해 README/index를 최신 상태 기준으로 재생성한다.
- message payload에 PAT를 포함하지 않는다. PAT는 storage settings에서 background가 읽는다.

테스트:

- setup required
- Auto Sync off
- unsupported language no commit
- duplicate processed identity no duplicate commit
- in-flight duplicate no duplicate commit
- commit success marks processed and appends history
- GitHub commit failure stores retry payload and does not mark processed
- retry success deletes payload and marks processed
- retry failure keeps payload

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
   - 성공: `"status": "completed"`로 설정하고 `"summary": "background sync orchestrator with runtime messages, duplicate locks, history, processed marking, and retry lifecycle"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- processedSubmissions를 GitHub commit 전에 기록하지 말 것. 이유: 실패 제출이 processed로 고정되면 retry와 재감지가 깨진다.
- 일반 수동 sync action을 추가하지 말 것. 이유: v1은 실패 payload Retry만 제공한다.
- in-memory state만으로 duplicate를 막지 말 것. 이유: MV3 service worker suspend에 취약하다.
- 기존 test를 깨뜨리지 말 것.
