# 수동 검증 체크리스트

이 문서는 v1 local unpacked Chrome extension을 실제 브라우저에서 검증하기 위한 기준이다. 자동 테스트와 build가 통과한 뒤 실행한다.

## 사전 조건
- Chrome에서 Developer mode를 켤 수 있다.
- LeetCode에 로그인되어 있다.
- Programmers에 로그인되어 있다.
- GitHub fine-grained PAT가 준비되어 있다.
- PAT는 검증 대상 저장소를 선택하고 Metadata read, Contents read/write 권한을 가진다.
- 검증 대상 저장소는 PAT를 발급한 GitHub 계정이 owner인 repository다.
- 검증 대상은 repository picker에서 선택한다. 권장 수동 검증 repository는 `zaehorang/Swift_Algorithm`이다.
- 실제 풀이 기록 branch를 오염시키지 않기 위해 `ps-lp-sync-test` 같은 별도 branch를 사용한다. 이 branch는 Options의 Create branch action으로 생성할 수 있다.

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

## LeetCode Successful Sync Flow
1. Auto Sync를 켠다.
2. LeetCode에서 Swift 또는 Python3로 Accepted 제출을 만든다.
3. 결과 panel에 `Accepted n / n testcases passed` 형태의 결과 문구가 렌더링되는지 확인한다.
4. toast가 Syncing에서 Synced로 바뀌는지 확인한다.
5. toast 또는 Popup history에서 commit link와 file link를 확인한다.
6. GitHub 대상 repository의 선택한 branch에서 solution file, `leetcode/README.md`, `leetcode/.leetcode-sync/index.json`이 같은 commit에 포함되었는지 확인한다.
7. 같은 submission이 다시 감지되어도 중복 commit이 생기지 않는지 확인한다.

## Programmers Successful Sync Flow
1. Auto Sync를 켠다.
2. Programmers에서 Swift 또는 Python3로 Accepted 제출을 만든다.
3. 제출 후 `정답입니다!` 모달이 렌더링되는지 확인한다.
4. `통과` 행이나 코드 실행 결과만으로 sync가 시작되지 않는지 확인한다.
5. editor code, 현재 language, 문제 제목, lesson id가 누락 없이 sync payload에 반영되는지 확인한다.
6. toast가 Syncing에서 Synced로 바뀌는지 확인한다.
7. GitHub 대상 repository의 선택한 branch에서 solution file, `programmers/README.md`, `programmers/.programmers-sync/index.json`이 같은 commit에 포함되었는지 확인한다.
8. 같은 code snapshot이 다시 감지되어도 중복 commit이 생기지 않는지 확인한다.

## Same Problem Update Flow
1. 같은 문제와 같은 언어로 다른 Accepted 제출을 만든다.
2. 기존 solution path가 최신 풀이로 갱신되는지 확인한다.
3. 해당 platform index의 language entry와 platform README table이 갱신되는지 확인한다.
4. 제출별 별도 solution file이 생기지 않는지 확인한다.

## Auto Sync Off Flow
1. Popup에서 Auto Sync를 끈다.
2. LeetCode 또는 Programmers에서 Accepted 제출을 만든다.
3. GitHub commit이 생성되지 않는지 확인한다.
4. toast 또는 Popup이 Auto Sync is off 상태를 보여주는지 확인한다.
5. 일반 수동 sync button이 표시되지 않는지 확인한다.

## Unsupported Language Flow
1. Swift와 Python3가 아닌 언어로 Accepted 제출을 만든다.
2. GitHub commit이 생성되지 않는지 확인한다.
3. toast 또는 Popup history가 Unsupported language 상태를 보여주는지 확인한다.

## LeetCode Accepted Detector Regression
1. LeetCode problem page에서 `Accepted Solutions`, `Accepted Submissions`, `Acceptance Rate` 같은 generic 문구가 보여도 sync가 시작되지 않는지 확인한다.
2. Wrong Answer, Runtime Error, Pending, Judging 결과에서는 toast 또는 Popup history에 sync record가 추가되지 않는지 확인한다.
3. 새 Accepted 제출 후 결과 panel이 큰 container로 바뀌어도 `Accepted n / n testcases passed` 문구를 기준으로 sync가 시작되는지 확인한다.

## Programmers Detector and Snapshot Regression
1. Programmers problem page에서 `정답입니다!` 모달이 나타날 때만 sync가 시작되는지 확인한다.
2. `통과`, `채점 결과`, `합계: 100.0 / 100.0` 문구만 있는 상태에서는 sync가 시작되지 않는지 확인한다.
3. Swift와 Python3 각각에서 editor code 전체가 누락 없이 GitHub solution file에 저장되는지 확인한다.
4. 긴 코드 또는 editor가 스크롤된 상태에서도 저장된 solution file에 보이지 않던 줄이 누락되지 않는지 확인한다.
5. editor code를 추출하지 못하는 상태를 만들 수 있으면 GitHub commit 없이 extract 실패가 history에 기록되는지 확인한다.

## Programmers Editor Extraction Probe
1. `https://school.programmers.co.kr/learn/courses/30/lessons/120804` 같은 Programmers 문제 페이지를 연다.
2. DevTools Console에서 `document.querySelector('textarea#code')?.value`가 현재 editor 전체 code와 일치하는지 확인한다.
3. Swift 기준으로 `textarea#code.value`가 code를 반환하고 `window.monaco` model이 없어도 추출이 가능한지 확인한다.
4. Python3로 language를 바꾼 뒤 같은 selector가 Python3 editor code를 반환하는지 확인한다.
5. `.cm-line` 같은 렌더된 line DOM만으로 hidden line이나 스크롤 밖 code를 source로 삼지 않는지 확인한다.

## Retry Flow
1. 유효하지 않은 branch나 일시적인 GitHub 실패 조건을 만들어 commit 실패를 발생시킨다.
2. Popup history에 실패 상세와 Retry button이 표시되는지 확인한다.
3. 설정을 정상화한 뒤 Retry를 실행한다.
4. Retry 성공 후 commit link와 file link가 표시되는지 확인한다.
5. retry payload가 삭제되고 같은 submission identity가 processed로 기록되는지 확인한다.

## Security Checks
- Options와 Popup에 PAT가 평문으로 계속 노출되지 않는지 확인한다.
- UI가 PAT와 retry payload code가 Chrome extension local storage에 저장될 수 있음을 알리는지 확인한다.
- retry payload는 최대 20개, 최대 7일 보관된다는 안내가 있는지 확인한다.
- LeetCode와 Programmers 문제 설명 전문이 GitHub commit이나 local storage에 저장되지 않는지 확인한다.
