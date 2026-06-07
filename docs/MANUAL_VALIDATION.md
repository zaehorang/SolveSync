# 수동 검증 체크리스트

> **Description**: 실제 환경에서 핵심 흐름과 회귀 위험을 확인하는 수동 검증 절차 문서다.

자동 테스트와 build가 통과한 뒤 실행한다.

## 사전 조건
- Chrome에서 Developer mode를 켤 수 있다.
- LeetCode에 로그인되어 있다.
- Programmers에 로그인되어 있다.
- GitHub fine-grained PAT가 준비되어 있다.
- PAT는 검증 대상 저장소를 선택하고 Metadata read, Contents read/write 권한을 가진다.
- 검증 대상 저장소는 PAT를 발급한 GitHub 계정이 owner인 repository다.
- 검증 대상은 repository picker에서 선택한다. 권장 수동 검증 repository는 `zaehorang/Swift_Algorithm`이다.
- 실제 풀이 기록 branch를 오염시키지 않기 위해 `solvesync-test` 같은 별도 branch를 사용한다. 이 branch는 Options의 Create branch action으로 생성할 수 있다.
- Domain naming migration의 현재 Sync Repository는 `zaehorang/Swift_Algorithm`이다. 이 migration의 Solution Catalog schema 변경은 일반 수동 검증 branch가 아니라 `main`에 직접 반영한다.

## Domain Naming Migration Checks
이번 migration phase에서는 extension 동작 검증과 별도로 문서 및 catalog 계약을 확인한다.

1. `CONTEXT.md`의 표준 용어가 `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/UI_GUIDE.md`, `docs/MANUAL_VALIDATION.md`, `docs/DEFERRED_WORK.md`, `AGENTS.md`에 반영되어 있는지 확인한다.
2. `docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`가 storage v4, runtime message rename, Solution Catalog v2, catalog file path 유지 결정을 포함하는지 확인한다.
3. Solution Catalog schema 반영 step 이후 `zaehorang/Swift_Algorithm`의 `main`에서 `leetcode/.leetcode-sync/index.json`과 `programmers/.programmers-sync/index.json`이 v3 schema, `lastAcceptedSourceId`, language별 `solutionRevisionNumber`를 사용하는지 확인한다.

## Build와 Load
1. 저장소 루트에서 build를 실행한다.

```bash
npm run build
```

2. Chrome에서 `chrome://extensions`를 연다.
3. Developer mode를 켠다.
4. `Load unpacked`로 `dist` 디렉터리를 로드한다.
5. 확장 에러가 표시되지 않는지 확인한다.
6. 특히 content script error에 `Cannot use import statement outside a module`이 없는지 확인한다.

## Setup Required Flow
1. 설정이 비어 있는 상태에서 `https://leetcode.com/problems/two-sum/` 같은 문제 페이지를 연다.
2. 확장이 GitHub connection required 상태를 toast로 보여주는지 확인한다.
3. toast의 Options action으로 Options page를 열 수 있는지 확인한다.
4. `https://school.programmers.co.kr/learn/courses/30/lessons/120804` 같은 Programmers 문제 페이지에서도 같은 상태가 표시되는지 확인한다.

## GitHub Connection Flow
1. Options page에서 PAT를 입력한다.
2. Load repositories를 실행한다.
3. `zaehorang/Swift_Algorithm` 또는 검증 대상 repository가 목록에 표시되는지 확인한다.
4. collaborator 또는 organization repository가 목록에 표시되지 않는지 확인한다.
5. repository를 선택한 뒤 branch 목록이 표시되는지 확인한다.
6. 검증 branch가 없으면 Create branch action으로 생성한다.
7. connection test를 실행한다.
8. 성공 시 Connected 상태가 표시되는지 확인한다.
9. 잘못된 PAT로 Auth failed 또는 Token expired에 해당하는 상태가 표시되는지 확인한다.
10. owner repository가 없는 PAT로 No owned repositories 상태가 표시되는지 확인한다.
11. 잘못된 branch 상태로 Branch not found 또는 Branch create failed에 해당하는 상태가 표시되는지 확인한다.
12. 설정 저장 후 Options를 다시 열어 선택한 repository와 branch가 유지되는지 확인한다.

## UI Language and Layout Checks
1. Options page에서 Language를 System, English, 한국어로 전환하고 Options, Popup, toast 문구가 선택한 언어로 표시되는지 확인한다.
2. 긴 repository 이름, 긴 branch 이름, 긴 문제 제목이 Popup 380px 폭에서 horizontal scroll이나 겹침 없이 줄바꿈되는지 확인한다.
3. LeetCode와 Programmers 문제 페이지에서 toast가 오른쪽 아래에 표시되고 좁은 viewport에서도 화면 safe margin 안에 들어오는지 확인한다.
4. toast의 Setup required, Syncing, Synced, Failed 상태에서 버튼 text와 link가 잘리지 않는지 확인한다.
5. Options page의 GitHub Connection section이 PAT, Sync Repository, Sync Branch, Connection test의 4단계 설정 흐름으로 보이고, 긴 form을 스크롤해도 Save controls에 접근할 수 있는지 확인한다.
6. Popup Sync History에서 같은 Coding Platform의 같은 문제에 대한 Swift/Python3 항목이 한 카드로 묶이고, 같은 문제/같은 언어의 반복 sync는 최신 language row 하나만 보이며, language badge와 status badge text가 `Sync/ed`처럼 깨지지 않는지 확인한다.
7. Popup Sync History에서 Commit/File은 각 language row의 primary action link로 표시되어 footer line이나 time meta와 붙어 보이지 않고, Details/Retry는 button으로 표시되며, Sync Repository/Sync Branch가 history group/row meta에 반복 표시되지 않는지 확인한다.
8. 긴 Sync History를 스크롤해도 Popup 상단 운영 상태 summary와 history row text가 서로 겹치거나 가려지지 않는지 확인한다.
9. 같은 문제 group 안의 여러 language row에 인접한 동일 retryable failure가 있으면 batch summary와 Retry all button으로 묶여 표시되는지 확인한다.
10. 실패 Sync History 항목이 Retry 가능하면 Retry button을 보여주고, Retry Bundle이 없거나 retry 불가이면 다음 행동 안내를 보여주는지 확인한다.

## LeetCode Successful Sync Flow
1. Auto Sync를 켠다.
2. LeetCode에서 Swift 또는 Python3로 Accepted 제출을 만든다.
3. 결과 panel에 `Accepted n / n testcases passed` 형태의 결과 문구가 렌더링되는지 확인한다.
4. toast가 Syncing에서 Synced로 바뀌는지 확인한다.
5. toast 또는 Popup의 Sync History에서 commit link와 file link를 확인한다.
6. GitHub Sync Repository의 Sync Branch에서 solution file, `leetcode/README.md`, `leetcode/.leetcode-sync/index.json`이 같은 commit에 포함되었는지 확인한다.
7. 같은 submission이 다시 감지되어도 중복 commit이 생기지 않는지 확인한다.

## Programmers Successful Sync Flow
1. Auto Sync를 켠다.
2. Programmers에서 Swift 또는 Python3로 Accepted 제출을 만든다.
3. 제출 후 `정답입니다!` 모달이 렌더링되는지 확인한다.
4. `통과` 행이나 코드 실행 결과만으로 sync가 시작되지 않는지 확인한다.
5. editor code, 현재 language, 문제 제목, lesson id가 누락 없이 sync payload에 반영되는지 확인한다.
6. toast가 Syncing에서 Synced로 바뀌는지 확인한다.
7. GitHub Sync Repository의 Sync Branch에서 solution file, `programmers/README.md`, `programmers/.programmers-sync/index.json`이 같은 commit에 포함되었는지 확인한다.
8. 같은 Accepted Editor Snapshot이 다시 감지되어도 중복 commit이 생기지 않는지 확인한다.

## Same Problem Update Flow
1. 같은 문제와 같은 언어로 다른 Accepted 제출을 만든다.
2. 기존 solution path가 최신 풀이로 갱신되는지 확인한다.
3. 해당 Solution Catalog의 language entry와 Solution README table이 갱신되는지 확인한다.
4. 제출별 별도 solution file이 생기지 않는지 확인한다.
5. 같은 문제와 같은 언어의 첫 성공 sync commit message가 `#1` suffix를 포함하는지 확인한다.
6. 같은 문제와 같은 언어의 다른 Accepted 재제출 commit message가 `#2` suffix를 포함하는지 확인한다.
7. 같은 Accepted가 다시 감지되어도 중복 commit이 생기지 않고 Solution Revision Number가 증가하지 않는지 확인한다.

## Auto Sync Off Flow
1. Popup에서 Auto Sync를 끈다.
2. LeetCode 또는 Programmers에서 Accepted 제출을 만든다.
3. GitHub commit이 생성되지 않는지 확인한다.
4. toast 또는 Popup이 Auto Sync is off 상태를 보여주는지 확인한다.
5. 일반 수동 sync button이 표시되지 않는지 확인한다.

## Unsupported Language Flow
1. Swift와 Python3가 아닌 언어로 Accepted 제출을 만든다.
2. GitHub commit이 생성되지 않는지 확인한다.
3. toast 또는 Popup의 Sync History가 Unsupported language 상태를 보여주는지 확인한다.

## LeetCode Accepted Detector Regression
1. LeetCode problem page에서 `Accepted Solutions`, `Accepted Submissions`, `Acceptance Rate` 같은 generic 문구가 보여도 sync가 시작되지 않는지 확인한다.
2. Wrong Answer, Runtime Error, Pending, Judging 결과에서는 toast 또는 Popup의 Sync History에 항목이 추가되지 않는지 확인한다.
3. 새 Accepted 제출 후 결과 panel이 큰 container로 바뀌어도 `Accepted n / n testcases passed` 문구를 기준으로 sync가 시작되는지 확인한다.

## Programmers Detector and Snapshot Regression
1. Programmers problem page에서 `정답입니다!` 모달이 나타날 때만 sync가 시작되는지 확인한다.
2. `통과`, `채점 결과`, `합계: 100.0 / 100.0` 문구만 있는 상태에서는 sync가 시작되지 않는지 확인한다.
3. Swift와 Python3 각각에서 editor code 전체가 누락 없이 GitHub solution file에 저장되는지 확인한다.
4. 긴 코드 또는 editor가 스크롤된 상태에서도 저장된 solution file에 보이지 않던 줄이 누락되지 않는지 확인한다.
5. editor code를 추출하지 못하는 상태를 만들 수 있으면 GitHub commit 없이 extract 실패가 Sync History에 기록되는지 확인한다.

## Programmers Editor Extraction Probe
1. `https://school.programmers.co.kr/learn/courses/30/lessons/120804` 같은 Programmers 문제 페이지를 연다.
2. DevTools Console에서 `document.querySelector('textarea#code')?.value`가 현재 editor 전체 code와 일치하는지 확인한다.
3. Swift 기준으로 `textarea#code.value`가 code를 반환하고 `window.monaco` model이 없어도 추출이 가능한지 확인한다.
4. Python3로 language를 바꾼 뒤 같은 selector가 Python3 editor code를 반환하는지 확인한다.
5. `.cm-line` 같은 렌더된 line DOM만으로 hidden line이나 스크롤 밖 code를 source로 삼지 않는지 확인한다.

## Retry Flow
1. 유효하지 않은 branch나 일시적인 GitHub 실패 조건을 만들어 commit 실패를 발생시킨다.
2. Popup의 Sync History에 실패 상세와 Retry button이 표시되는지 확인한다.
3. 같은 문제 group 안의 여러 language row에 동일 retryable failure가 있으면 Retry all button이 표시되고, Retry Bundle이 없는 실패는 Retry all 대상에 포함되지 않는지 확인한다.
4. 설정을 정상화한 뒤 Retry 또는 Retry all을 실행한다.
5. Retry 성공 후 commit link와 file link가 표시되는지 확인한다.
6. Retry Bundle이 삭제되고 같은 Sync Deduplication Key가 processed로 기록되는지 확인한다.

## Security Checks
- Options와 Popup에 PAT가 평문으로 계속 노출되지 않는지 확인한다.
- UI가 PAT와 Retry Bundle code가 Chrome extension local storage에 저장될 수 있음을 알리는지 확인한다.
- Retry Bundle은 최대 20개, 최대 7일 보관된다는 안내가 있는지 확인한다.
- LeetCode와 Programmers 문제 설명 전문이 GitHub commit이나 local storage에 저장되지 않는지 확인한다.
