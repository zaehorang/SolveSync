# PRD: SolveSync

> **Description**: 제품 요구사항, 사용자 흐름, 범위, 성공 기준을 정리한 문서다.

## 개요
SolveSync는 LeetCode와 Programmers에서 Accepted 된 풀이를 GitHub 문제 풀이 저장소로 자동 동기화하는 개인용 Chrome 확장이다. 사용자가 문제를 푼 뒤 코드 복사, 파일 위치 선택, 커밋, README 갱신, push를 반복하지 않도록 만드는 것이 목적이다.

## 도메인 Naming 계약
표준 제품/domain 용어는 `CONTEXT.md`를 따른다. 사용자-facing 문서와 UI는 Coding Platform, Accepted Submission, Accepted Editor Snapshot, Sync Deduplication Key, Sync Repository, Sync Branch, Solution File, Solution Catalog, Solution README, Sync History, Retry Bundle을 기준으로 쓴다.

이번 domain naming migration은 제품 동작을 바꾸지 않는다. TypeScript, runtime message, storage schema를 같은 용어 체계로 정렬하고, Solution Catalog는 v2 schema에서 `lastAcceptedSourceId`를 저장한다. Solution Catalog 실제 파일 경로는 `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json`을 유지한다.

## 해결하려는 문제
사용자는 Swift와 Python3를 번갈아 사용해 LeetCode와 Programmers 문제를 푼다. 수동으로 GitHub에 풀이를 반영하면 번거롭고 누락되기 쉽다. 기존 LeetCode-to-GitHub 확장은 풀이 sync 자체는 가능하지만, Programmers 흐름, 원하는 저장소 구조, Swift Xcode 빌드 제약을 함께 맞추기 어렵다.

## 대상 사용자
- 주 사용자: 코딩 테스트와 알고리즘 인터뷰를 준비하는 개발자.
- 사용 환경: Chrome, 로그인된 LeetCode 또는 Programmers 세션, 개인 GitHub 계정, 개인 문제 풀이 저장소.
- Sync Repository: 사용자가 GitHub fine-grained PAT로 접근 가능한 본인 owner repository 중 선택한다. 특정 repository를 제품 기본값으로 고정하지 않는다.

## 목표
- LeetCode와 Programmers Swift/Python3 Accepted 제출을 자동으로 GitHub에 반영한다.
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
- Options는 fine-grained GitHub PAT 생성 방법을 체크리스트로 안내한다.
- 사용자는 GitHub에서 Sync Repository만 선택하고 Metadata read, Contents read/write 권한을 부여한다.
- 사용자는 PAT를 입력한 뒤 repository 목록을 불러온다.
- Options는 입력된 PAT로 접근 가능한 본인 owner repository 목록을 보여주고 사용자가 Sync Repository를 선택하게 한다.
- repository 목록이 비어 있거나 불러오기에 실패하면 Options는 원인과 다음 행동을 보여준다.
- 사용자가 Sync Repository를 선택하면 Options는 branch 목록을 불러오고 기본 선택값으로 repository default branch를 보여준다.
- 원하는 Sync Branch가 없으면 사용자는 명시적인 Create branch action으로 repository default branch HEAD에서 새 branch를 만들 수 있다.
- Options는 필수 입력값 누락과 명백히 잘못된 Sync Repository/Sync Branch 상태를 저장 전에 표시한다.
- 사용자는 connection test를 실행한다.
- 확장은 선택한 Sync Repository와 Sync Branch로 sync할 수 있는지 확인한다. Connection test는 test commit을 만들지 않는다.
- 사용자는 connection test 성공 여부와 무관하게 설정을 저장할 수 있다.
- 테스트가 실패하면 Options는 auth failed, token expired, no owned repositories, repository not found, branch not found, branch create failed, rate limited, network failed 중 가장 가까운 복구 가능한 상태를 보여준다.

### Auto Sync on 문제 풀이
- 사용자는 LeetCode 또는 Programmers에서 Swift 또는 Python3로 문제를 푼다.
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
- 사용자가 Swift 또는 Python3가 아닌 언어로 Accepted를 받으면 확장은 GitHub commit을 만들지 않는다.
- toast는 `Unsupported language` 상태를 짧게 보여준다.
- Popup의 Sync History에는 unsupported 상태를 기록해 사용자가 commit이 생기지 않은 이유를 확인할 수 있게 한다.

### 일시 중지 흐름
- 사용자는 Popup에서 Auto Sync를 끌 수 있다.
- Auto Sync가 꺼져 있으면 Accepted 제출도 commit하지 않는다.
- 확장은 사용자가 이유를 알 수 있도록 `Auto Sync is off` 상태를 보여줄 수 있다.
- v1은 일반 수동 sync action을 제공하지 않는다. Popup의 Retry는 retry 가능한 실패 항목에만 제공된다.

## MVP 기능
- Local unpacked Chrome extension.
- GitHub PAT, repository picker, branch picker, branch 생성, Auto Sync, connection test를 설정하는 Options 페이지.
- Auto Sync 토글, 최근 20개 기록, 실패 상세, retry를 제공하는 Popup.
- LeetCode와 Programmers Accepted 감지와 toast feedback을 담당하는 content script.
- LeetCode Accepted 제출의 문제 메타데이터와 solution code 조회.
- Programmers Accepted 제출의 solution code 수집.
- solution code, Solution README, Coding Platform별 Solution Catalog를 하나의 GitHub commit으로 반영.
- README는 v1에서 항상 갱신한다.
- Swift path 생성: `leetcode/swift`, `programmers/swift`.
- Python3 path 생성: `leetcode/python`, `programmers/python`.
- Sync Repository의 폴더, README, Solution Catalog가 없을 때도 첫 sync에서 생성한다.

## v1 제외 사항
- Chrome Web Store 배포.
- GitHub OAuth 로그인.
- Swift/Python3 외 언어 지원.
- LeetCode 또는 Programmers 문제 설명 전문 저장.
- 다중 GitHub 계정 저장과 계정 전환 관리. 단일 PAT를 교체해 다른 사용자나 다른 계정의 repository를 사용하는 것은 가능하다.
- 팀 또는 조직 워크플로우.
- 별도 cloud backend service.
- Programmers 비공식 제출 상세 API 의존. v1 Programmers sync는 현재 페이지 DOM과 Accepted Editor Snapshot 기반으로만 동작한다.
- LeetCode와 Programmers 외 다른 Coding Platform 자동 sync.
- 일반 수동 sync. v1에서 사용자가 직접 실행할 수 있는 것은 실패 항목 Retry뿐이다.

## 성공 기준
- LeetCode Swift Accepted 제출이 Sync Repository에 `leetcode/swift/0001_two_sum.swift` 형식 파일을 생성하거나 갱신한다.
- LeetCode Python3 Accepted 제출이 Sync Repository에 `leetcode/python/0001_two_sum.py` 형식 파일을 생성하거나 갱신한다.
- Programmers Swift Accepted 제출이 Sync Repository에 `programmers/swift/120804_두_수의_곱_구하기.swift` 형식 파일을 생성하거나 갱신한다.
- Programmers Python3 Accepted 제출이 Sync Repository에 `programmers/python/120804_두_수의_곱_구하기.py` 형식 파일을 생성하거나 갱신한다.
- `leetcode/README.md`와 `leetcode/.leetcode-sync/index.json`이 solution file과 같은 commit에 포함된다.
- `programmers/README.md`와 `programmers/.programmers-sync/index.json`이 solution file과 같은 commit에 포함된다.
- 같은 Sync Deduplication Key가 반복 감지되어도 중복 commit이 생기지 않는다.
- 같은 문제/언어의 새 Accepted 제출은 기존 solution file을 최신 풀이로 갱신한다.
- GitHub commit 실패는 성공 처리되지 않고 retry 가능한 실패로 남는다.
- Sync Repository 폴더가 없어도 sync가 실패하지 않는다.
- Sync Repository는 코드 기본값이 아니라 Options에서 선택한 repository여야 한다.
- 존재하지 않는 Sync Branch는 자동 생성되지 않고, 사용자가 명시적으로 Create branch를 실행한 경우에만 생성된다.
- 일반적인 실패는 DevTools 없이 Popup에서 원인과 다음 행동을 이해할 수 있다.
- Chrome unpacked extension으로 setup required, repository selection, branch selection/creation, connection test, successful sync, Auto Sync off, unsupported language, retry success 시나리오를 수동 검증할 수 있다.

## 보안과 개인정보 요구사항
- PAT는 사용자가 직접 입력하고 v1에서는 Chrome extension local storage에만 저장한다.
- 확장은 PAT와 Retry Bundle code가 local storage에 저장된다는 사실을 UI에서 명시해야 한다.
- Retry Bundle은 최대 20개, 최대 7일 보관하고 retry 성공 후 삭제한다.
- solution code는 의도한 sync 흐름에서 설정된 Sync Repository로만 전송된다.
- LeetCode와 Programmers 문제 설명 전문은 저장하지 않는다.
- test fixture에는 실제 token, cookie, private code를 넣지 않는다.

## 릴리즈 전략
- v1: LeetCode/Programmers Accepted-to-GitHub 전체 흐름을 검증하기 위한 개인용 local unpacked extension.
- Domain naming migration: 현재 Sync Repository는 `zaehorang/Swift_Algorithm`이며, Solution Catalog v2 변경은 `main`에 직접 반영한다.
- v2: v1 안정화 후 Chrome Web Store 패키징, 아이콘, 스크린샷, privacy policy, 권한 설명, 심사 대응을 진행한다.
