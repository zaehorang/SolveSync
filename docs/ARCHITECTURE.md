# 아키텍처

> **Description**: 시스템 구조, 모듈 책임, 데이터 흐름, 저장소 모델, 기술 규칙을 정리한 문서다.

## 시스템 개요
SolveSync는 standalone Chrome extension이다. LeetCode와 Programmers 문제 페이지를 관찰해 Accepted 제출을 감지하고, 사용자가 선택한 Sync Repository에 Solution File을 커밋한다. 플랫폼별 route, 감지 신호와 source 수집 계약은 [LeetCode 연동](platforms/LEETCODE.md)과 [Programmers 연동](platforms/PROGRAMMERS.md)을 따른다.

이 확장은 별도 backend server를 운영하지 않는다. 모든 orchestration은 브라우저 extension runtime 안에서 수행한다.

## Domain Naming Contract
표준 코드/domain 용어는 `CONTEXT.md`를 따른다. TypeScript identifier와 runtime message payload는 `CodingPlatform`, `SyncDeduplicationKey`, `acceptedSourceId`, `SyncRepository`, `SyncBranch`, `SyncHistoryEntry`, `RetryBundle`, `ProgrammersAcceptedEditorSnapshot` 계약을 사용한다. Storage v5는 settings와 GitHub auth session을 분리하고, Solution Catalog v4는 `lastAcceptedSourceId`, `solutionRevisionNumber`, 9개 supported language key를 사용한다.

이전 storage와 runtime payload는 backward-compatible parser로 읽되, 새 write path는 현재 field만 쓴다. v4 settings 안의 legacy PAT는 v5 migration 때 저장 값에서 제거하고 로그인 필요 상태로 전환한다. Runtime message alias는 ingress compatibility 전용이다. 이전 이름과 새 이름의 대응표는 `docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`를 따른다.

## 소스 구조
```text
src/
├── background/      # sync orchestration, Coding Platform source resolver, 외부 API write
│   └── client/      # LeetCode GraphQL, GitHub Sync Repository/Sync Branch/Git Data API 실행 코드
├── content/         # LeetCode/Programmers 페이지 관찰, Programmers Accepted Editor Snapshot, toast UI
├── options/         # GitHub Device Flow, App 설치, Sync Repository/Sync Branch, connection test UI
├── popup/           # Auto Sync 토글, Sync History, failure, Retry Bundle UI
└── shared/          # 타입, Coding Platform policy, mapping, runtime message, Solution README/Catalog, storage schema, 순수 로직
```

구현 후 루트에는 다음 파일들이 있어야 한다.

```text
manifest.json
package.json
package-lock.json
vite.config.ts
vite.content.config.ts
tsconfig.json
vitest.config.ts
scripts/
src/
docs/
AGENTS.md
README.md
```

## 런타임 컴포넌트
### Content Script
- `https://leetcode.com/problems/*`와 `https://school.programmers.co.kr/learn/courses/*/lessons/*`에서 실행된다.
- Manifest `content_scripts`는 classic script로 실행되므로 content entry는 별도 IIFE bundle인 `dist/content/index.js`로 빌드한다.
- Content bundle에는 static ESM `import`가 남으면 안 되며 `npm run build`의 build verification이 이를 검사한다.
- Production build verification은 Vite의 production 환경에서 `VITE_GITHUB_APP_CLIENT_ID`와 `VITE_GITHUB_APP_SLUG`를 읽고, trim한 값이 하나라도 비어 있으면 해당 변수명을 포함한 오류로 build를 중단한다. 두 공개 설정이 모두 있어야 manifest 선언과 content IIFE 검증까지 진행한다.
- Content detection controller가 `MutationObserver`, route lifecycle, coalescing과 message emission을 소유한다. Content entry는 controller 시작과 toast wiring만 담당한다.
- Accepted 감지는 현재 DOM에 Accepted 상태가 존재하는지가 아니라, Coding Platform adapter가 이번 mutation에서 fresh visible Accepted transition을 확정했는지를 기준으로 한다.
- Text signal 탐색은 ADR 0022에 따라 mutation 범위 안에서 bounded traversal한다. 플랫폼별 presentation state가 필요하면 같은 observer에 adapter가 등록한 presentation root를 추가 target으로 등록하고 그 root의 visibility attribute만 관찰한다.
- Fresh signal마다 현재 URL을 다시 parsing해 route-bound immutable Accepted event를 즉시 만든다. Event에 DOM source snapshot이 필요하면 이 시점에 한 번만 캡처하고 지연 callback에서 DOM을 다시 읽지 않는다.
- 동일 render burst는 첫 event와 snapshot을 보존하는 fixed-window coalescer로 최대 한 번만 전달한다.
- Route key가 바뀌면 이전 route의 pending event와 coalescing state를 폐기한 뒤 현재 batch를 새 route 기준으로 판정한다. 전달 직전에도 route key를 다시 확인한다.
- Fresh transition, immutable event와 route lifecycle 결정은 ADR 0034를 따른다.
- background service worker로 `content:accepted_detected` 메시지를 보낸다.
- 문제 페이지 안에 toast feedback을 렌더링한다.
- GitHub API를 호출하지 않고 sync 상태의 owner도 아니다.

### Background Service Worker
- sync state machine의 owner다.
- runtime listener는 service worker top-level에서 등록한다.
- settings와 Auto Sync 상태를 읽는다.
- Coding Platform별 source resolver로 problem metadata, Accepted Submission 또는 Accepted Editor Snapshot, Sync Deduplication Key를 확정한다.
- 같은 Sync Deduplication Key에 대한 storage 기반 in-flight lock을 적용한다.
- 중복 제출 감지를 적용한다.
- GitHub commit payload를 만든다.
- Sync History와 Retry Bundle을 갱신한다.
- content script와 popup에 상태 메시지를 보낸다.
- 오래 유지되는 in-memory state를 source of truth로 사용하지 않는다.

### Options Page
- GitHub App Device Flow 로그인, Sync Repository, Sync Branch, Auto Sync 설정을 관리한다.
- Device Flow 응답을 받으면 일회용 user code와 verification action을 먼저 표시하고 background authorization polling을 예약한다. 사용자가 `Copy code and open GitHub` action을 실행할 때만 코드를 clipboard에 복사하고 verification URL을 새 탭으로 연다.
- 로그인 계정이 소유하고 GitHub App이 설치된 Sync Repository 목록과 선택한 Sync Repository의 Sync Branch 목록을 불러온다.
- 사용자가 명시적으로 요청한 경우에만 선택한 Sync Repository의 default branch HEAD에서 새 Sync Branch를 생성한다.
- GitHub Sync Repository, Sync Branch, Git data read API를 대상으로 connection test를 실행한다.
- Connection test는 test commit이나 branch update 같은 write 작업을 수행하지 않는다.
- GitHub access/refresh token과 Retry Bundle code가 local storage에 저장된다는 사실을 명시한다.

### Popup
- Auto Sync toggle을 보여준다.
- Sync History는 최근 20개 항목을 보여준다.
- 성공 link, 실패 summary, 펼칠 수 있는 technical detail을 보여준다.
- retry 가능한 실패의 Retry Bundle에 대해 retry를 실행한다.
- 설정이 없으면 Options로 이동할 수 있게 한다.

### Shared Modules
- 공통 TypeScript 타입을 정의한다.
- runtime message union을 정의한다.
- versioned storage schema를 정의한다.
- LeetCode/Programmers 언어를 공통 supported language와 대상 path extension으로 매핑한다.
- Coding Platform policy로 root folder, Solution README path, Solution Catalog path, marker, commit message prefix를 제공한다.
- 결정적인 filename과 path를 생성한다.
- Solution Catalog 데이터를 merge한다.
- README managed table content를 생성한다.
- GitHub Git Data API tree payload를 구성한다.
- 외부 API error를 사용자 메시지와 debug 메시지로 normalize한다.

## Manifest와 권한
v1 manifest는 최소 권한을 사용한다.

- `permissions`: `storage`
- `host_permissions`: `https://leetcode.com/*`, `https://school.programmers.co.kr/*`, `https://github.com/*`, `https://api.github.com/*`
- content script match: `https://leetcode.com/problems/*`, `https://school.programmers.co.kr/learn/courses/*/lessons/*`

Content script는 문제 페이지에서 Accepted 감지, Coding Platform source snapshot 추출과 toast 렌더링만 담당한다. Coding Platform network source 조회와 GitHub API 호출은 background service worker에서 수행한다.

## MV3 Service Worker 제약
- Background service worker는 언제든 suspend될 수 있으므로 진행 상태를 memory에만 두면 안 된다.
- settings, in-flight lock, processed Sync Deduplication Key, Sync History, Retry Bundle은 `chrome.storage.local`에 저장하고 재시작 후 복구 가능해야 한다.
- service worker wake-up 후 storage를 다시 읽어 현재 요청을 판단한다.
- 중복 방지는 memory cache가 아니라 storage에 저장된 processed Sync Deduplication Key와 in-flight Sync Deduplication Key를 기준으로 한다.

## 데이터 흐름
```text
Coding Platform 문제 page
→ Coding Platform adapter가 fresh Accepted transition 감지
→ content detection controller가 현재 route와 immutable Accepted event 확정
→ first-event fixed-window coalescing
→ content script가 `content:accepted_detected` 전달
→ background가 settings와 Auto Sync 확인
→ background가 Coding Platform source resolver로 problem/source/Sync Deduplication Key 확정
→ background가 Sync Deduplication Key lock 획득
→ background가 solution path, Solution Catalog 갱신, Solution README 갱신, Solution Revision Number 기반 commit message 생성
→ background가 GitHub Git Data API로 commit 생성
→ background가 processed Sync Deduplication Key와 Sync History 저장
→ content script와 popup이 결과 표시
```

## Coding Platform 공통/전용 경계
- 공통 sync orchestration은 setup, Auto Sync, duplicate, in-flight lock, GitHub commit, retry, Sync History를 처리한다.
- Content detection controller는 observer, 현재 route lifecycle, first-event coalescing과 message emission을 담당한다.
- Coding Platform adapter는 URL parsing, Accepted signal 판정과 source 수집을 담당한다.
- Coding Platform policy는 root path, Solution README path, Solution Catalog path, marker, initial Solution README title, commit message prefix를 제공한다.
- background orchestration은 DOM selector나 사이트별 결과 문구를 알면 안 된다.
- content Coding Platform adapter는 GitHub commit 방법을 알면 안 된다.

플랫폼 전용 계약은 다음 문서가 source of truth다.

- [LeetCode 연동](platforms/LEETCODE.md)
- [Programmers 연동](platforms/PROGRAMMERS.md)

## GitHub 연동
- Sync Repository는 코드 기본값이 아니라 Options에서 사용자가 선택한 값이다.
- Public GitHub App은 Device Flow를 활성화하고 expiring user access token을 사용한다. Extension에는 공개 client ID와 App slug만 build-time 환경 변수로 포함하며 client secret은 사용하지 않는다.
- 기본 runtime에서 공개 client ID 또는 App slug가 없으면 외부 인증 요청이나 tab 생성을 실행하지 않고 `github_app_not_configured`를 반환한다. 이 오류는 재시도로 해결할 수 없는 build 설정 오류이며 Options는 현재 locale로 확장 프로그램 관리자에게 문의하라는 다음 행동을 표시한다. Connection status에는 기존 `auth_failed` 표현을 사용한다.
- Device code는 `chrome.storage.session`에 저장하고 Options에는 user code, verification URL, 만료 시각, polling interval만 반환한다.
- 발급된 access token과 refresh token은 `chrome.storage.local`의 별도 `githubAuth` state에 저장한다. access token 만료 5분 전에는 refresh하며, API 401이면 강제 refresh 후 요청을 한 번만 재시도한다.
- 동시 refresh 요청은 single-flight promise로 하나만 수행한다. refresh 실패나 refresh token 만료 시 auth state를 삭제하고 재로그인을 요구한다.
- Options는 GitHub App user token으로 본인 owner repository 목록을 pagination해 불러온다. App 설치 범위 밖 repository는 GitHub가 token 권한에서 제외한다. 목록이 비면 App installation required 상태를 보여준다.
- Sync Branch picker는 선택한 Sync Repository의 branch 목록을 불러오고, 기본 선택값은 repository default branch다.
- 존재하지 않는 Sync Branch는 자동 생성하지 않는다. 사용자가 Create branch action을 실행한 경우에만 repository default branch HEAD에서 branch ref를 생성한다.
- Empty repository처럼 default branch HEAD가 없으면 branch 생성은 실패 상태로 처리한다.
- Accepted 이벤트 하나가 commit 하나가 되도록 GitHub Contents API 대신 Git Data API를 사용한다.
- sync commit에는 다음 파일이 포함된다.
  - solution file
  - Solution README
  - Solution Catalog
- commit 흐름은 다음 순서를 따른다.
  - branch ref 조회
  - base commit과 tree 조회
  - 변경 파일 blob 생성
  - 새 tree 생성
  - 새 commit 생성
  - branch ref update
- branch가 이동해 ref update가 실패하면 최신 branch 상태와 Solution Catalog를 다시 읽고 files와 commit message를 재계산한 뒤 한 번만 재시도한다.
- branch 생성 중 이미 같은 branch가 존재하게 된 race condition은 branch 목록을 다시 읽어 존재하면 성공에 준해 처리한다.
- 같은 문제/언어의 새 Accepted 제출은 같은 solution file path를 최신 풀이로 덮어쓴다.
- branch protection으로 ref update가 막히면 우회하지 않고 `github_branch_protected`로 실패 처리한다.
- GitHub rate limit은 `github_rate_limited`, token 만료나 권한 부족은 `github_token_expired` 또는 `github_auth_failed`로 normalize한다.
- commit message 형식은 Coding Platform별 prefix를 사용한다.
  - LeetCode: `solve: leetcode 0001 two sum in swift #1`
  - Programmers: `solve: programmers 120804 두 수의 곱 구하기 in swift #1`

## Sync Repository 경로
Sync Repository와 Sync Branch는 Options에서 선택한다. 특정 repository를 코드 기본값으로 고정하지 않는다.

LeetCode Swift 풀이:
```text
leetcode/swift/0001_two_sum.swift
```

LeetCode Python3 풀이:
```text
leetcode/python/0001_two_sum.py
```

Programmers Swift 풀이:
```text
programmers/swift/120804_두_수의_곱_구하기.swift
```

Programmers Python3 풀이:
```text
programmers/python/120804_두_수의_곱_구하기.py
```

Sync Repository는 Coding Platform 폴더를 먼저 두고 그 내부를 언어별로 나눈다.

공통 language registry가 display name, Coding Platform별 alias, folder, extension을 한 곳에서 관리한다.

| Key | Display | Folder | Extension |
| --- | --- | --- | --- |
| `swift` | Swift | `swift` | `.swift` |
| `python3` | Python3 | `python` | `.py` |
| `java` | Java | `java` | `.java` |
| `cpp` | C++ | `cpp` | `.cpp` |
| `javascript` | JavaScript | `javascript` | `.js` |
| `typescript` | TypeScript | `typescript` | `.ts` |
| `kotlin` | Kotlin | `kotlin` | `.kt` |
| `go` | Go | `go` | `.go` |
| `rust` | Rust | `rust` | `.rs` |

생성된 Swift 풀이 파일은 `swift/SwiftAlgorithm` 아래에 저장하지 않는다. 이 규칙은 기본 검증 저장소의 Xcode build source 충돌을 피하기 위해 시작됐지만, v1에서는 모든 Sync Repository에 같은 path convention을 적용한다.

## Missing Path Policy
- 폴더 생성 API를 호출하지 않는다. 이 사용 사례에는 GitHub 폴더 생성 API가 필요 없다.
- Coding Platform language folder가 없으면 첫 solution file을 해당 path로 commit해 GitHub가 폴더를 보이게 한다.
- Solution Catalog가 없으면 첫 synced solution과 같은 commit에서 생성한다.
- Solution README가 없으면 첫 synced solution과 같은 commit에서 생성한다.
- Solution README가 있지만 managed marker가 없으면 파일 하단에 managed marker block을 추가한다.

## Solution README와 Solution Catalog
각 Solution Catalog가 Sync Repository 안에서 Solution README와 풀이 진행표를 재생성하기 위한 source of truth다. 중복 처리, Sync History, Retry 상태의 source of truth는 각각 storage의 processed Sync Deduplication Key, Sync History, Retry Bundle이다.

v1은 Solution README를 항상 갱신한다. README 갱신을 끄는 설정이나 mode는 제공하지 않는다.

Solution Catalog는 v4 schema를 사용한다. v1-v3 catalog는 읽을 때 v4로 normalize하며 실제 파일 경로는 호환성을 위해 유지한다.
- LeetCode: `leetcode/.leetcode-sync/index.json`
- Programmers: `programmers/.programmers-sync/index.json`

Catalog entry는 다음 정보를 저장한다.
- problem id
- frontend id
- title
- title slug
- difficulty
- problem URL
- language별 solution path
- language별 Solution Revision Number
- last synced time
- language별 last accepted source id
- problem/language별 first accepted date와 last accepted date
- date별 accepted count와 new problem count activity

README 생성 규칙:
- managed marker 밖 내용은 보존한다.
- Coding Platform marker 사이 내용만 교체한다.
  - LeetCode: `<!-- LEETCODE_TABLE_START -->`, `<!-- LEETCODE_TABLE_END -->`
  - Programmers: `<!-- PROGRAMMERS_TABLE_START -->`, `<!-- PROGRAMMERS_TABLE_END -->`
- number, title, difficulty, solved date, 단일 Languages 컬럼을 생성한다.
- row는 numeric problem id 오름차순으로 정렬한다.
- Solved cell은 Solution Catalog의 problem-level first accepted date를 표시한다.
- Languages cell은 존재하는 solution path를 registry 순서로 나열하고 Solution README 기준 상대 link를 건다.

## Storage Model
`chrome.storage.local`을 사용한다.

모든 top-level persistent value는 `version` field를 포함한다. 현재 storage schema는 v5이며 malformed state만 해당 key의 empty fallback으로 복구한다.

v5 settings payload는 `syncRepository`, `syncBranch`, Auto Sync, UI language, connection status를 저장한다. Legacy v1-v4 settings parser는 old field를 읽고 PAT를 버린 뒤 현재 shape로 즉시 다시 저장한다.

Keys:
- `settings`: version, Sync Repository owner/name, Sync Branch, Auto Sync, UI language, connection status.
- `githubAuth`: version, access token/expiry, refresh token/expiry, token type, 최소 GitHub account summary. Public settings 변환에서 token field를 절대 복사하지 않는다.
- `processedSyncDeduplicationKeys`: version, 처리된 Sync Deduplication Key 목록.
- `syncHistory`: version, Sync History의 최근 20개 `SyncHistoryEntry` 항목.
- `retryBundles`: version, GitHub commit retry가 가능한 Retry Bundle 목록.
- `syncDeduplicationKeyLocks`: version, 현재 처리 중인 Sync Deduplication Key lock 목록. 각 lock은 생성 시각을 저장하고 10분 TTL을 가진다.

## 동시성과 Retry Lifecycle
- Sync Deduplication Key는 `codingPlatform`, `acceptedSourceId`, problem identifier, language 조합이다.
- 새 sync 시작 전 10분이 지난 stale in-flight lock을 정리한다.
- background는 sync 시작 전에 storage에 Sync Deduplication Key lock을 기록한다.
- 같은 Sync Deduplication Key가 이미 in-flight이면 새 요청은 중복으로 처리하지 않고 현재 상태를 반환한다.
- GitHub commit 성공 후에만 processed Sync Deduplication Key를 기록한다.
- GitHub commit 단계 실패는 processed로 기록하지 않는다.
- GitHub commit 단계까지 필요한 데이터가 준비된 실패만 Retry Bundle로 저장한다.
- Retry Bundle은 solution code가 포함될 수 있으며 최대 20개까지 보관하고 7일이 지난 bundle은 정리한다.
- sync 성공 또는 실패가 terminal 상태로 기록되면 in-flight lock을 삭제한다.
- Retry Bundle retry는 최신 Sync Branch의 Solution Catalog를 다시 읽어 files와 commit message를 재계산한다.
- Retry 성공 후에는 Retry Bundle을 삭제하고 Sync History를 성공 상태로 갱신한다.

## Runtime Messaging
모든 runtime message는 `src/shared`의 discriminated union 타입을 통과해야 한다.

Message categories:
- content to background: Accepted detected, toast action.
- popup/options to background: settings read/write, GitHub auth start/read/poll/disconnect, App install page open, repository list, branch list, branch create, connection test, retry.
- background to content/popup: sync status, Sync History update.

`content:accepted_detected`는 `codingPlatform` discriminated union이다. 각 payload의 `detectedAt`, `pageUrl`, route field와 source snapshot field는 같은 fresh Accepted event에서 확정한다. 플랫폼별 payload source는 [LeetCode 연동](platforms/LEETCODE.md)과 [Programmers 연동](platforms/PROGRAMMERS.md)을 따른다.

Runtime message type은 `surface:action_name` 형태의 stable namespaced identifier를 사용한다. Sync History와 Retry Bundle message의 정확한 old/new type string은 Domain Naming Contract의 legacy 대응 표를 따른다.

Content/popup/options로 나가는 message payload에는 GitHub access token, refresh token, device code, LeetCode/Programmers cookie나 session token을 포함하지 않는다. GitHub auth secret은 background가 storage에서 직접 읽는다.

## Error Model
모든 실패는 안정적인 error code로 normalize한다.
- `setup_required`
- `auto_sync_disabled`
- `unsupported_language`
- `github_auth_failed`
- `github_app_not_configured`
- `github_login_required`
- `github_device_flow_expired`
- `github_device_flow_denied`
- `github_token_refresh_failed`
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
- `extension_state_unavailable`

Coding Platform 전용 source error는 [LeetCode 오류 계약](platforms/LEETCODE.md#오류-계약)과 [Programmers 오류 계약](platforms/PROGRAMMERS.md#오류-계약)을 따른다.

Toast는 짧은 메시지만 보여준다. Popup은 상세 메시지와 retry 가능 여부를 보여준다.

## 테스트 전략
일반 테스트는 Vitest와 in-memory adapter만 사용한다. 실제 GitHub, LeetCode, Programmers 네트워크나 사용자 secret에 의존하지 않는다.

- language/path, Solution Catalog, Solution README, storage, error 같은 pure logic은 빠른 단위 테스트로 검증한다.
- sync orchestration은 외부 API를 mock하고 최종 commit payload를 검증한다.
- GitHub 인증 변경의 대표 happy path는 연결 해제 후 auth만 삭제되고 repository/branch 설정이 재연결 뒤에도 유지되는지 확인한다.
- 다중 언어의 대표 happy path는 같은 문제의 서로 다른 지원 언어가 각각 solution file로 저장되고 하나의 README row와 Catalog problem entry에 함께 남는지 확인한다.
- Content detection controller는 stale Accepted 무시, 동일 render burst coalescing, first immutable event 보존과 SPA route reset을 순수 단위 테스트로 검증한다. 플랫폼별 detector와 source extraction 검증은 각 platform 문서를 따른다.
- 실제 Device Flow 승인과 GitHub App 설치는 `docs/MANUAL_VALIDATION.md`, 실제 Coding Platform Accepted 제출은 각 platform 문서의 최소 release smoke로 확인한다.

모든 지원 언어와 실패 조합을 실제 계정이나 브라우저 E2E로 반복하지 않는다. 실제 GitHub repository를 자동 테스트 대상이나 코드 기본값으로 고정하지 않으며, read-only GitHub smoke script도 기본 test suite에 두지 않는다.
