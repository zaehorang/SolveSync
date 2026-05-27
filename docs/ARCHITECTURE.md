# 아키텍처

## 시스템 개요
PS-LP-Sync는 standalone Chrome extension이다. LeetCode 문제 페이지를 관찰해 Accepted 제출을 감지하고, LeetCode GraphQL 우선 API client로 Accepted submission 상세를 읽은 뒤 설정된 GitHub 저장소에 풀이 파일을 커밋한다.

이 확장은 별도 backend server를 운영하지 않는다. 모든 orchestration은 브라우저 extension runtime 안에서 수행한다.

## 소스 구조
```text
src/
├── background/      # sync orchestration과 외부 API write
│   └── client/      # LeetCode GraphQL, GitHub repository/branch/Git Data API 실행 코드
├── content/         # LeetCode 페이지 관찰과 toast UI
├── options/         # PAT 안내, repository/branch 선택, branch 생성, connection test UI
├── popup/           # Auto Sync 토글, history, failure, retry UI
└── shared/          # 타입, mapping, runtime message, storage schema, 순수 로직
```

구현 후 루트에는 다음 파일들이 있어야 한다.

```text
manifest.json
package.json
package-lock.json
vite.config.ts
tsconfig.json
vitest.config.ts
src/
docs/
AGENTS.md
README.md
```

## 런타임 컴포넌트
### Content Script
- `https://leetcode.com/problems/*`에서 실행된다.
- 현재 URL에서 `titleSlug`를 추출한다.
- `MutationObserver`로 Accepted 결과 변화를 감지한다.
- 같은 DOM 변화가 반복될 수 있으므로 짧은 debounce를 적용한다.
- background service worker로 `accepted_detected` 메시지를 보낸다.
- LeetCode 페이지 안에 toast feedback을 렌더링한다.
- GitHub API를 호출하지 않고 sync 상태의 owner도 아니다.

### Background Service Worker
- sync state machine의 owner다.
- runtime listener는 service worker top-level에서 등록한다.
- settings와 Auto Sync 상태를 읽는다.
- LeetCode metadata와 submission detail을 가져온다.
- 같은 submission identity에 대한 storage 기반 in-flight lock을 적용한다.
- 중복 제출 감지를 적용한다.
- GitHub commit payload를 만든다.
- sync history와 retry payload를 갱신한다.
- content script와 popup에 상태 메시지를 보낸다.
- 오래 유지되는 in-memory state를 source of truth로 사용하지 않는다.

### Options Page
- GitHub PAT, 선택된 repository, 선택된 branch, Auto Sync 설정을 저장한다.
- fine-grained PAT 설정 방법을 안내한다.
- PAT로 접근 가능한 repository 목록과 선택한 repository의 branch 목록을 불러온다.
- 사용자가 명시적으로 요청한 경우에만 선택한 repository의 default branch HEAD에서 새 branch를 생성한다.
- GitHub repository, branch, Git data read API를 대상으로 connection test를 실행한다.
- Connection test는 test commit이나 branch update 같은 write 작업을 수행하지 않는다.
- PAT와 retry payload code가 local storage에 저장된다는 사실을 명시한다.

### Popup
- Auto Sync toggle을 보여준다.
- 최근 20개 sync record를 보여준다.
- 성공 link, 실패 summary, 펼칠 수 있는 technical detail을 보여준다.
- retry 가능한 실패 payload에 대해 retry를 실행한다.
- 설정이 없으면 Options로 이동할 수 있게 한다.

### Shared Modules
- 공통 TypeScript 타입을 정의한다.
- runtime message union을 정의한다.
- versioned storage schema를 정의한다.
- LeetCode 언어를 대상 path와 extension으로 매핑한다.
- 결정적인 filename과 path를 생성한다.
- `.leetcode-sync/index.json` 데이터를 merge한다.
- README managed table content를 생성한다.
- GitHub Git Data API tree payload를 구성한다.
- 외부 API error를 사용자 메시지와 debug 메시지로 normalize한다.

## Manifest와 권한
v1 manifest는 최소 권한을 사용한다.

- `permissions`: `storage`
- `host_permissions`: `https://leetcode.com/*`, `https://api.github.com/*`
- content script match: `https://leetcode.com/problems/*`

Content script는 LeetCode problem page에서 Accepted 감지와 toast 렌더링만 담당한다. LeetCode와 GitHub API 호출은 background service worker에서 수행한다.

## MV3 Service Worker 제약
- Background service worker는 언제든 suspend될 수 있으므로 진행 상태를 memory에만 두면 안 된다.
- settings, in-flight lock, processed submissions, sync history, retry payload는 `chrome.storage.local`에 저장하고 재시작 후 복구 가능해야 한다.
- service worker wake-up 후 storage를 다시 읽어 현재 요청을 판단한다.
- 중복 방지는 memory cache가 아니라 storage에 저장된 processed identity와 in-flight identity를 기준으로 한다.

## 데이터 흐름
```text
LeetCode page
→ content script가 Accepted 감지
→ background가 settings와 Auto Sync 확인
→ background가 identity lock 획득
→ background가 LeetCode GraphQL client로 problem metadata 조회
→ background가 현재 titleSlug의 최신 accepted submission detail 조회
→ background가 solution path, index 갱신, README 갱신 생성
→ background가 GitHub Git Data API로 commit 생성
→ background가 processed identity와 history 저장
→ content script와 popup이 결과 표시
```

## LeetCode 연동
- DOM은 Accepted 이벤트 감지에만 사용한다.
- Submission code와 problem metadata는 현재 브라우저 로그인 세션을 사용해 LeetCode GraphQL API를 우선 호출해 가져온다.
- LeetCode client 모듈은 GraphQL query와 API response parsing을 중앙화해야 한다.
- Background는 content script가 보낸 `titleSlug`를 기준으로 최신 Accepted submission detail을 조회한다.
- Accepted code를 가져오지 못하면 sync를 진행하지 않는다.
- 처리된 제출의 안정적인 식별자는 submission id, title slug, language 조합이다.
- 미지원 언어는 unsupported 상태로 기록하고 commit하지 않는다.
- 로그인 만료나 세션 문제는 `leetcode_auth_required`로 normalize한다.

## GitHub 연동
- Repository는 코드 기본값이 아니라 Options에서 사용자가 선택한 값이다.
- Options는 PAT로 접근 가능한 repository 목록을 pagination을 고려해 불러오고, 접근 가능한 repository가 없으면 no accessible repositories 상태를 보여준다.
- Branch picker는 선택한 repository의 branch 목록을 불러오고, 기본 선택값은 repository default branch다.
- 존재하지 않는 branch는 자동 생성하지 않는다. 사용자가 Create branch action을 실행한 경우에만 repository default branch HEAD에서 branch ref를 생성한다.
- Empty repository처럼 default branch HEAD가 없으면 branch 생성은 실패 상태로 처리한다.
- Accepted 이벤트 하나가 commit 하나가 되도록 GitHub Contents API 대신 Git Data API를 사용한다.
- commit에는 다음 파일이 포함된다.
  - solution file
  - `README.md`
  - `.leetcode-sync/index.json`
- commit 흐름은 다음 순서를 따른다.
  - branch ref 조회
  - base commit과 tree 조회
  - 변경 파일 blob 생성
  - 새 tree 생성
  - 새 commit 생성
  - branch ref update
- branch가 이동해 ref update가 실패하면 최신 branch 상태를 다시 읽고 README와 index를 재생성한 뒤 한 번만 재시도한다.
- branch 생성 중 이미 같은 branch가 존재하게 된 race condition은 branch 목록을 다시 읽어 존재하면 성공에 준해 처리한다.
- 같은 문제/언어의 새 Accepted 제출은 같은 solution file path를 최신 풀이로 덮어쓴다.
- branch protection으로 ref update가 막히면 우회하지 않고 `github_branch_protected`로 실패 처리한다.
- GitHub rate limit은 `github_rate_limited`, token 만료나 권한 부족은 `github_token_expired` 또는 `github_auth_failed`로 normalize한다.
- commit message 형식은 `solve: leetcode 0001 two sum in swift`다.

## 대상 저장소 경로
대상 저장소와 branch는 Options에서 선택한다. 특정 repository를 코드 기본값으로 고정하지 않는다.

Swift 풀이:
```text
swift/leetcode/0001_two_sum.swift
```

Python3 풀이:
```text
python/leetcode/0001_two_sum.py
```

생성된 Swift 파일은 `swift/SwiftAlgorithm` 아래에 저장하지 않는다. 이 규칙은 기본 검증 저장소의 Xcode build source 충돌을 피하기 위해 시작됐지만, v1에서는 모든 대상 repository에 같은 path convention을 적용한다.

## Missing Path Policy
- 폴더 생성 API를 호출하지 않는다. 이 사용 사례에는 GitHub 폴더 생성 API가 필요 없다.
- `swift/leetcode`가 없으면 첫 Swift solution file을 해당 path로 commit해 GitHub가 폴더를 보이게 한다.
- `python/leetcode`가 없으면 첫 Python3 solution file을 해당 path로 commit해 GitHub가 폴더를 보이게 한다.
- `.leetcode-sync/index.json`이 없으면 첫 synced solution과 같은 commit에서 생성한다.
- `README.md`가 없으면 첫 synced solution과 같은 commit에서 생성한다.
- README가 있지만 managed marker가 없으면 파일 하단에 managed marker block을 추가한다.

## README와 Index
`.leetcode-sync/index.json`이 source of truth다.

v1은 README를 항상 갱신한다. README 갱신을 끄는 설정이나 mode는 제공하지 않는다.

Index entry는 다음 정보를 저장한다.
- problem id
- frontend id
- title
- title slug
- difficulty
- LeetCode URL
- language별 solution path
- last synced time
- language별 last submission id

README 생성 규칙:
- managed marker 밖 내용은 보존한다.
- `<!-- LEETCODE_TABLE_START -->`와 `<!-- LEETCODE_TABLE_END -->` 사이 내용만 교체한다.
- number, title, difficulty, Swift, Python 컬럼을 생성한다.
- row는 numeric problem id 오름차순으로 정렬한다.
- Swift와 Python cell은 해당 solution path가 있을 때 link를 건다.

## Storage Model
`chrome.storage.local`을 사용한다.

모든 top-level value는 `version` field를 포함한다. v1에서는 migration 구현이 작더라도 schema version을 저장해 이후 변경 여지를 남긴다.

Keys:
- `settings`: version, PAT, selected repository owner/name, selected branch, Auto Sync, connection status.
- `processedSubmissions`: version, 처리된 submission identity 목록.
- `syncHistory`: version, 최근 20개 sync record.
- `retryPayloads`: version, GitHub commit retry가 가능한 실패 payload. 최대 20개, 최대 7일 보관한다.
- `inFlightSyncs`: version, 현재 처리 중인 submission identity lock 목록. 각 lock은 생성 시각을 저장하고 10분 TTL을 가진다.

Retry payload에는 solution code가 포함될 수 있다. Retry 성공 후에는 삭제해야 한다.

## 동시성과 Retry Lifecycle
- sync identity는 `submissionId`, `titleSlug`, language 조합이다.
- 새 sync 시작 전 10분이 지난 stale in-flight lock을 정리한다.
- background는 sync 시작 전에 `inFlightSyncs`에 identity lock을 기록한다.
- 같은 identity가 이미 in-flight이면 새 요청은 중복으로 처리하지 않고 현재 상태를 반환한다.
- GitHub commit 성공 후에만 `processedSubmissions`에 identity를 기록한다.
- GitHub commit 단계 실패는 processed로 기록하지 않는다.
- GitHub commit 단계까지 필요한 데이터가 준비된 실패만 retry payload를 저장한다.
- retry payload는 최대 20개까지 보관하며 7일이 지난 payload는 정리한다.
- sync 성공 또는 실패가 terminal 상태로 기록되면 in-flight lock을 삭제한다.
- Retry 성공 후에는 retry payload를 삭제하고 history를 성공 상태로 갱신한다.

## Runtime Messaging
모든 runtime message는 `src/shared`의 discriminated union 타입을 통과해야 한다.

Message categories:
- content to background: Accepted detected, toast action.
- popup/options to background: settings read/write, repository list, branch list, branch create, connection test, retry.
- background to content/popup: sync status, history update.

Message payload에는 실제 PAT, LeetCode cookie, session token을 포함하지 않는다. PAT는 storage에서 background가 직접 읽는다.

## Error Model
모든 실패는 안정적인 error code로 normalize한다.
- `setup_required`
- `auto_sync_disabled`
- `unsupported_language`
- `leetcode_auth_required`
- `leetcode_fetch_failed`
- `github_auth_failed`
- `github_token_expired`
- `github_no_accessible_repos`
- `github_repo_not_found`
- `github_branch_not_found`
- `github_default_branch_unavailable`
- `github_branch_create_failed`
- `github_branch_protected`
- `github_rate_limited`
- `github_commit_failed`
- `github_conflict_failed`
- `malformed_index`
- `network_failed`

Toast는 짧은 메시지만 보여준다. Popup은 상세 메시지와 retry 가능 여부를 보여준다.

## 테스트 가능한 단위
Vitest로 다음을 검증한다.
- language mapping
- filename과 path 생성
- index merge와 update
- README marker replacement
- README가 없는 경우의 생성 동작
- GitHub tree payload 생성
- repository picker state와 empty repository list 처리
- branch picker와 branch 생성 처리
- duplicate identity 처리
- in-flight identity lock 처리
- stale in-flight lock TTL 정리
- retry payload cap과 TTL 정리
- error normalization
- typed runtime message handling
