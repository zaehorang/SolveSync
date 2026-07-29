# PRD: SolveSync

> **Description**: 제품 요구사항, 사용자 흐름, 범위, 성공 기준을 정리한 문서다.

## 개요
SolveSync는 LeetCode와 Programmers에서 Accepted 된 풀이를 GitHub 문제 풀이 저장소로 자동 동기화하는 개인용 Chrome 확장이다. 사용자가 문제를 푼 뒤 코드 복사, 파일 위치 선택, 커밋, README 갱신, push를 반복하지 않도록 만드는 것이 목적이다.

## 도메인 Naming 계약
표준 제품/domain 용어는 `CONTEXT.md`를 따른다. 사용자-facing 문서와 UI는 Coding Platform, Accepted Submission, Accepted Editor Snapshot, Sync Deduplication Key, Sync Repository, Sync Branch, Solution File, Solution Revision Number, Solution Catalog, Solution README, Sync History, Retry Bundle을 기준으로 쓴다.

TypeScript, runtime message, storage schema는 같은 용어 체계를 사용한다. 현재 storage schema는 GitHub App 인증을 분리한 v5이고, Solution Catalog는 다중 언어 key를 허용하는 v4에서 `lastAcceptedSourceId`와 language별 `solutionRevisionNumber`를 저장한다. Solution Catalog 실제 파일 경로는 `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json`을 유지한다.

## 해결하려는 문제
사용자는 여러 언어로 LeetCode와 Programmers 문제를 푼다. 수동으로 GitHub에 풀이를 반영하면 번거롭고 누락되기 쉽다. 기존 LeetCode-to-GitHub 확장은 풀이 sync 자체는 가능하지만, Programmers 흐름, 원하는 저장소 구조, 다중 언어 경로, Swift Xcode 빌드 제약을 함께 맞추기 어렵다.

## 대상 사용자
- 주 사용자: 코딩 테스트와 알고리즘 인터뷰를 준비하는 개발자.
- 사용 환경: Chrome, 로그인된 LeetCode 또는 Programmers 세션, 개인 GitHub 계정, 개인 문제 풀이 저장소.
- Sync Repository: 사용자가 로그인한 GitHub 계정이 소유하고 SolveSync GitHub App을 설치한 repository 중 선택한다. 특정 repository를 제품 기본값으로 고정하지 않는다.

## 목표
- LeetCode와 Programmers에서 Swift, Python3, Java, C++, JavaScript, TypeScript, Kotlin, Go, Rust로 작성한 Accepted 제출을 자동으로 GitHub에 반영한다.
- Swift 풀이 파일을 Xcode 빌드 소스 폴더 밖의 Coding Platform별 풀이 폴더에 저장한다.
- Sync Repository의 풀이 구조는 `leetcode`, `programmers` 같은 Coding Platform 폴더를 먼저 두고 그 내부를 언어별로 나눈다.
- 성공, 실패, retry 상태를 문제 풀이 흐름을 방해하지 않는 방식으로 보여준다.
- Accepted 제출 하나당 GitHub commit 하나를 만들어 Sync History를 깔끔하게 유지한다.
- Coding Platform 내부의 구조화된 Solution Catalog를 기준으로 Solution README 진행표를 자동 생성한다.

## 사용자 여정
### 첫 설치
- 사용자는 Chrome에서 확장을 unpacked extension으로 로드한다.
- 사용자가 LeetCode 또는 Programmers 문제 페이지에 들어간다.
- 설정이 없으면 확장이 작은 toast로 GitHub 연결이 필요하다고 알려준다.
- toast에는 Options 페이지로 이동하는 버튼이 있다.

### GitHub 연결
- 사용자가 Options 페이지를 연다.
- 사용자는 `Sign in with GitHub`를 눌러 GitHub Device Flow를 시작한다.
- Options는 일회용 user code와 GitHub verification URL을 보여주며, 사용자는 GitHub에서 SolveSync를 승인한다.
- 사용자는 SolveSync GitHub App을 본인 소유 Sync Repository에 설치한다. App 권한은 repository Metadata read와 Contents read/write로 제한한다.
- Options는 로그인 계정이 소유하고 App이 설치된 repository 목록을 보여주며 사용자가 Sync Repository를 선택하게 한다.
- repository 목록이 비어 있거나 불러오기에 실패하면 Options는 원인과 다음 행동을 보여준다.
- 사용자가 Sync Repository를 선택하면 Options는 branch 목록을 불러오고 기본 선택값으로 repository default branch를 보여준다.
- 원하는 Sync Branch가 없으면 사용자는 명시적인 Create branch action으로 repository default branch HEAD에서 새 branch를 만들 수 있다.
- Options는 필수 입력값 누락과 명백히 잘못된 Sync Repository/Sync Branch 상태를 저장 전에 표시한다.
- 사용자는 connection test를 실행한다.
- 확장은 선택한 Sync Repository와 Sync Branch의 repository, branch, Git data read access를 확인한다. Connection test는 test commit이나 branch update를 만들지 않으며 branch protection 또는 실제 write 가능성을 보장하지 않는다.
- 사용자는 connection test 성공 여부와 무관하게 설정을 저장할 수 있다.
- 테스트가 실패하면 Options는 login required, authorization pending/denied/expired, App installation required, token refresh failed, repository not found, branch not found, branch create failed, rate limited, network failed 중 가장 가까운 복구 가능한 상태를 보여준다.

### Auto Sync on 문제 풀이
- 사용자는 LeetCode 또는 Programmers에서 지원 언어로 문제를 푼다.
- 사용자는 평소처럼 제출한다.
- 결과가 Accepted가 아니면 확장은 아무 commit도 만들지 않는다.
- 결과가 Accepted면 확장은 `Syncing to GitHub...` toast를 보여준다.
- 확장은 제출 코드, 문제 메타데이터, Sync Deduplication Key를 Coding Platform별 방식으로 확정한다.
- 같은 Sync Deduplication Key가 이미 처리되었거나 처리 중이면 중복 commit을 만들지 않는다.
- 같은 문제/언어의 새 Accepted 제출이면 기존 solution path를 최신 풀이로 덮어쓴다.

### 성공 흐름
- toast가 `Synced to GitHub` 상태로 바뀐다.
- toast는 commit link와 file link를 제공한다.
- Popup의 Sync History에는 문제 제목, 언어, 시간, 상태, GitHub 링크가 표시된다.
- Sync Repository에는 solution file, README 갱신, Solution Catalog 갱신이 한 commit으로 반영된다.
- commit 성공 후에만 성공 기록을 저장한다.

### 실패 흐름
- toast는 짧은 실패 원인을 보여준다.
- Popup은 상세 error 정보를 보여준다.
- Retry 가능한 실패만 Retry Bundle로 저장하고 Popup에 Retry 버튼을 보여준다.
- Retry는 저장된 Retry Bundle을 사용해 실패한 sync를 다시 시도한다.
- Retry 성공 후에는 성공 기록을 저장하고 Retry Bundle을 삭제한다.
- Retry 실패 후에는 Retry Bundle을 유지하고 상세 원인을 갱신한다.

### 미지원 언어 흐름
- 사용자가 지원 목록에 없는 언어로 Accepted를 받으면 확장은 GitHub commit을 만들지 않는다.
- toast는 `Unsupported language` 상태를 짧게 보여준다.
- Popup의 Sync History에는 unsupported 상태를 기록해 사용자가 commit이 생기지 않은 이유를 확인할 수 있게 한다.

### 일시 중지 흐름
- 사용자는 Popup에서 Auto Sync를 끌 수 있다.
- Auto Sync가 꺼져 있으면 Accepted 제출도 commit하지 않는다.
- 확장은 사용자가 이유를 알 수 있도록 `Auto Sync is off` 상태를 보여줄 수 있다.
- v1은 일반 수동 sync action을 제공하지 않는다. Popup의 Retry는 retry 가능한 실패 항목에만 제공된다.

### 로컬 데이터 관리
- 사용자는 Options에서 Retry Data만 삭제할 수 있다.
- Retry Data를 삭제하면 Retry Bundle과 Sync History의 retry action은 제거되지만 Sync History 자체, GitHub auth와 설정은 유지된다.
- 사용자는 Options에서 모든 SolveSync local data를 삭제할 수 있다.
- 전체 삭제는 GitHub auth, 진행 중 Device Flow, 설정, Sync History, Retry Bundle, lock과 processed Sync Deduplication Key를 현재 Chrome profile에서 제거한다.
- 두 삭제 action은 실행 전에 범위와 비가역성을 보여주는 inline confirmation을 요구한다.
- Local data 삭제나 extension 제거는 GitHub App 설치, authorization 또는 이미 생성된 GitHub commit을 자동으로 제거하지 않는다.

## MVP 기능
- Local unpacked Chrome extension.
- GitHub App Device Flow 로그인, App 설치, repository picker, branch picker, branch 생성, Auto Sync, connection test와 local data 삭제를 제공하는 Options 페이지.
- Auto Sync 토글, 최근 20개 기록, 실패 상세, retry를 제공하는 Popup.
- LeetCode와 Programmers Accepted 감지와 toast feedback을 담당하는 content script.
- LeetCode Accepted 제출의 문제 메타데이터와 solution code 조회.
- Programmers Accepted 제출의 solution code 수집.
- solution code, Solution README, Coding Platform별 Solution Catalog를 하나의 GitHub commit으로 반영.
- README는 v1에서 항상 갱신한다.
- Swift path 생성: `leetcode/swift`, `programmers/swift`.
- Python3 path 생성: `leetcode/python`, `programmers/python`.
- Java, C++, JavaScript, TypeScript, Kotlin, Go, Rust path는 각각 `java`, `cpp`, `javascript`, `typescript`, `kotlin`, `go`, `rust` 언어 폴더와 `.java`, `.cpp`, `.js`, `.ts`, `.kt`, `.go`, `.rs` 확장자를 사용한다.
- Sync Repository의 폴더, README, Solution Catalog가 없을 때도 첫 sync에서 생성한다.

## v1 제외 사항
- Chrome Web Store 배포.
- GitHub App이 설치되지 않은 repository와 organization/team repository workflow.
- LeetCode 또는 Programmers 문제 설명 전문 저장.
- 다중 GitHub 계정 동시 저장과 계정 전환 관리. 현재 연결을 해제한 뒤 다른 계정으로 다시 로그인할 수 있다.
- 팀 또는 조직 워크플로우.
- 별도 cloud backend service.
- Programmers 비공식 제출 상세 API 의존. v1 Programmers sync는 현재 페이지 DOM과 Accepted Editor Snapshot 기반으로만 동작한다.
- LeetCode와 Programmers 외 다른 Coding Platform 자동 sync.
- 일반 수동 sync. v1에서 사용자가 직접 실행할 수 있는 것은 실패 항목 Retry뿐이다.

## Programmers Accepted Editor Snapshot 신뢰 범위
- LeetCode는 Accepted 제출 상세를 API로 다시 확인하지만, Programmers는 안정적인 공식 제출 상세 API를 전제로 하지 않는다.
- v1은 Programmers에서 `정답입니다!` 감지 직후 현재 페이지의 Accepted Editor Snapshot을 solution source로 사용한다.
- 이 결정은 Programmers origin DOM이나 script가 compromise된 경우 committed solution source가 영향을 받을 수 있는 residual risk를 가진다.
- 이 risk는 현재 local release에서 수용한다. 동기화 대상은 사용자가 푼 solution code이고, content message에는 GitHub access/refresh token, cookie, session token을 포함하지 않으며, GitHub write 대상은 사용자가 선택한 Sync Repository와 Sync Branch로 제한된다.

## 성공 기준
- LeetCode Swift Accepted 제출이 Sync Repository에 `leetcode/swift/0001_two_sum.swift` 형식 파일을 생성하거나 갱신한다.
- LeetCode Python3 Accepted 제출이 Sync Repository에 `leetcode/python/0001_two_sum.py` 형식 파일을 생성하거나 갱신한다.
- Programmers Swift Accepted 제출이 Sync Repository에 `programmers/swift/120804_두_수의_곱_구하기.swift` 형식 파일을 생성하거나 갱신한다.
- Programmers Python3 Accepted 제출이 Sync Repository에 `programmers/python/120804_두_수의_곱_구하기.py` 형식 파일을 생성하거나 갱신한다.
- 각 신규 지원 언어는 registry에 정의된 동일한 Coding Platform-first path로 solution file을 생성하거나 갱신한다.
- Solution README는 문제당 한 행과 단일 `Languages` column을 사용하며, 해당 문제에 존재하는 언어별 solution link를 registry 순서로 표시한다.
- `leetcode/README.md`와 `leetcode/.leetcode-sync/index.json`이 solution file과 같은 commit에 포함된다.
- `programmers/README.md`와 `programmers/.programmers-sync/index.json`이 solution file과 같은 commit에 포함된다.
- 같은 Sync Deduplication Key가 반복 감지되어도 중복 commit이 생기지 않는다.
- 같은 문제/언어의 새 Accepted 제출은 기존 solution file을 최신 풀이로 갱신한다.
- commit message는 같은 Coding Platform, 문제, 언어의 Solution Revision Number를 `#n` suffix로 포함한다.
- GitHub commit 실패는 성공 처리되지 않고 retry 가능한 실패로 남는다.
- Sync Repository 폴더가 없어도 sync가 실패하지 않는다.
- Sync Repository는 코드 기본값이 아니라 Options에서 선택한 repository여야 한다.
- 존재하지 않는 Sync Branch는 자동 생성되지 않고, 사용자가 명시적으로 Create branch를 실행한 경우에만 생성된다.
- 제한을 초과하거나 유효하지 않은 Accepted source는 GitHub 요청과 Retry Bundle 생성 전에 non-retryable 실패로 기록된다.
- Retry Data 삭제 후 Sync History는 남되 retry action은 제거되고, 전체 local data 삭제 후 Options는 초기 설정 상태를 보여준다.
- 일반적인 실패는 DevTools 없이 Popup에서 원인과 다음 행동을 이해할 수 있다.
- Chrome unpacked extension에서 GitHub Device Flow와 App 설치, repository/branch 선택, Programmers 동일 문제 다중 언어 sync, GitHub 재연결 후 설정 보존, LeetCode 대표 Accepted sync happy path를 수동 검증할 수 있다.

## 보안과 개인정보 요구사항
- GitHub App client ID와 slug는 공개 build-time 설정이며 client secret은 사용하거나 저장하지 않는다.
- Device Flow의 pending device code는 `chrome.storage.session`에만 저장한다.
- GitHub access token과 refresh token은 `chrome.storage.local`의 별도 auth state에 저장하고 public settings/runtime 응답에는 포함하지 않는다.
- `chrome.storage.local`은 content script가 직접 읽을 수 없도록 trusted extension context로 제한한다.
- Runtime ingress는 extension ID, 실제 sender surface, message별 payload shape와 Coding Platform page URL을 검증한다.
- Content script는 전체 public settings가 아니라 UI locale preference만 background를 통해 읽는다.
- access token은 만료 5분 전 또는 GitHub API 401 응답 시 refresh token으로 한 번 갱신한다. refresh 실패나 refresh token 만료 시 auth state를 삭제하고 재로그인을 요구한다.
- 확장은 GitHub session token과 Retry Bundle code가 local storage에 저장된다는 사실을 UI에서 명시해야 한다.
- Retry Bundle은 retry 가능한 실패에만 만들고 최대 20개, 생성 후 최대 7일 보관하며 retry 성공 후 삭제한다.
- 만료 Retry Bundle은 service worker/Chrome 시작, install/update, 관련 storage 접근과 하루 주기 cleanup에서 제거한다.
- Accepted solution code는 UTF-8 기준 최대 262,144 bytes다. 공백뿐인 code와 제한 초과 code는 GitHub 요청이나 Retry Bundle 생성 전에 거부한다.
- Accepted source metadata는 title 300 Unicode code points, platform ID/title slug 128자, language 64자, URL 2,048자를 넘지 않는다.
- 사용자는 Retry Data와 모든 SolveSync local data를 Options에서 명시적으로 삭제할 수 있어야 한다.
- solution code는 의도한 sync 흐름에서 설정된 Sync Repository로만 전송된다.
- LeetCode와 Programmers 문제 설명 전문은 저장하지 않는다.
- test fixture에는 실제 token, cookie, private code를 넣지 않는다.

## 릴리즈 전략
- 현재 release: GitHub App Device Flow와 9개 언어를 포함한 LeetCode/Programmers Accepted-to-GitHub 흐름을 GitHub Releases의 ZIP으로 배포하는 public preview. 사용자는 ZIP을 풀고 Chrome Developer mode에서 local unpacked extension으로 로드한다.
- Domain naming migration: Solution Catalog schema 변경은 사용자가 선택한 Sync Repository의 검증 branch에서 확인하며, 특정 repository를 제품 기본값으로 고정하지 않는다.
- v2: v1 안정화 후 Chrome Web Store 패키징, 아이콘, 스크린샷, privacy policy, 권한 설명, 심사 대응을 진행한다.
