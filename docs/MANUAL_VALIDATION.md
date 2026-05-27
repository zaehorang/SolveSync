# 수동 검증 체크리스트

이 문서는 v1 local unpacked Chrome extension을 실제 브라우저에서 검증하기 위한 기준이다. 자동 테스트와 build가 통과한 뒤 실행한다.

## 사전 조건
- Chrome에서 Developer mode를 켤 수 있다.
- LeetCode에 로그인되어 있다.
- GitHub fine-grained PAT가 준비되어 있다.
- PAT는 대상 저장소만 선택하고 Contents read/write 권한을 가진다.
- 대상 branch 이름을 알고 있다. 기본값은 `main`이다.

## Build와 Load
1. 저장소 루트에서 build를 실행한다.

```bash
npm run build
```

2. Chrome에서 `chrome://extensions`를 연다.
3. Developer mode를 켠다.
4. `Load unpacked`로 `dist` 디렉터리를 로드한다.
5. 확장 에러가 표시되지 않는지 확인한다.

## Setup Required Flow
1. 설정이 비어 있는 상태에서 `https://leetcode.com/problems/two-sum/` 같은 문제 페이지를 연다.
2. 확장이 GitHub connection required 상태를 toast로 보여주는지 확인한다.
3. toast의 Options action으로 Options page를 열 수 있는지 확인한다.

## GitHub Connection Flow
1. Options page에서 PAT, owner, repo, branch를 입력한다.
2. connection test를 실행한다.
3. 성공 시 Connected 상태가 표시되는지 확인한다.
4. 잘못된 PAT로 Auth failed 또는 Token expired에 해당하는 상태가 표시되는지 확인한다.
5. 잘못된 repo나 branch로 Repository not found 또는 Branch not found가 표시되는지 확인한다.
6. 설정 저장 후 Options를 다시 열어 값이 유지되는지 확인한다.

## Successful Sync Flow
1. Auto Sync를 켠다.
2. LeetCode에서 Swift 또는 Python3로 Accepted 제출을 만든다.
3. toast가 Syncing에서 Synced로 바뀌는지 확인한다.
4. toast 또는 Popup history에서 commit link와 file link를 확인한다.
5. GitHub 대상 저장소에서 solution file, `README.md`, `.leetcode-sync/index.json`이 같은 commit에 포함되었는지 확인한다.
6. 같은 submission이 다시 감지되어도 중복 commit이 생기지 않는지 확인한다.

## Same Problem Update Flow
1. 같은 문제와 같은 언어로 다른 Accepted 제출을 만든다.
2. 기존 solution path가 최신 풀이로 갱신되는지 확인한다.
3. `.leetcode-sync/index.json`의 해당 language entry와 README table이 갱신되는지 확인한다.
4. 제출별 별도 solution file이 생기지 않는지 확인한다.

## Auto Sync Off Flow
1. Popup에서 Auto Sync를 끈다.
2. LeetCode에서 Accepted 제출을 만든다.
3. GitHub commit이 생성되지 않는지 확인한다.
4. toast 또는 Popup이 Auto Sync is off 상태를 보여주는지 확인한다.
5. 일반 수동 sync button이 표시되지 않는지 확인한다.

## Unsupported Language Flow
1. Swift와 Python3가 아닌 언어로 Accepted 제출을 만든다.
2. GitHub commit이 생성되지 않는지 확인한다.
3. toast 또는 Popup history가 Unsupported language 상태를 보여주는지 확인한다.

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
- LeetCode 문제 설명 전문이 GitHub commit이나 local storage에 저장되지 않는지 확인한다.
