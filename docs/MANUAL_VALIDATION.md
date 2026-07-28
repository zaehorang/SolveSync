# 수동 검증 체크리스트

> **Description**: 자동 테스트로 확인할 수 없는 실제 GitHub 로그인과 Coding Platform Accepted 흐름의 최소 happy path를 검증한다.

수동 검증은 릴리즈 전에 한 번 실행한다. 모든 언어 조합, 오류 상태, token 만료를 실제 계정으로 반복 검증하지 않는다. 순수 로직과 orchestration은 Vitest가 담당한다.

## 사전 조건

- Chrome Developer mode를 사용할 수 있다.
- LeetCode와 Programmers에 로그인되어 있다.
- Device Flow와 expiring user access token을 활성화한 public SolveSync GitHub App이 준비되어 있다.
- GitHub App repository permission은 Metadata read와 Contents read/write다.
- `.env.local`에 `VITE_GITHUB_APP_CLIENT_ID`, `VITE_GITHUB_APP_SLUG`를 설정한다. client secret은 사용하지 않는다.
- 로그인할 GitHub 계정이 소유한 별도 test repository에 App을 설치한다.
- 실제 풀이 branch 대신 `solvesync-test` 같은 test branch를 사용한다.

특정 repository나 branch를 제품 기본값으로 고정하지 않는다. 검증할 때 Options의 picker에서 직접 선택한다.

## 1. 자동 검증

저장소 루트에서 실행한다.

```bash
npm run typecheck
npm test
npm run build
```

모두 통과해야 한다. 일반 테스트는 실제 GitHub, LeetCode, Programmers 네트워크나 사용자 secret을 사용하지 않는다.

## 2. Extension Load

1. Chrome에서 `chrome://extensions`를 연다.
2. Developer mode를 켠다.
3. `Load unpacked`로 `dist`를 선택한다.
4. extension error가 없는지 확인한다.
5. 문제 페이지에서 content script의 static ESM import error가 없는지 확인한다.

## 3. GitHub 연결 Happy Path

1. Options에서 `Sign in with GitHub`를 누른다.
2. 표시된 일회용 code를 GitHub Device Flow page에서 승인한다.
3. Options에 연결된 GitHub account login이 표시되는지 확인한다.
4. `Install or configure GitHub App`에서 본인 소유 test repository를 선택한다.
5. `Load Sync Repositories`에서 해당 repository를 선택한다.
6. 기존 test branch를 선택하거나 `Create Sync Branch`를 명시적으로 실행한다.
7. Connection test를 실행한다.
8. `Connected` 상태를 확인하고 Auto Sync를 켠 뒤 저장한다.

Connection test는 commit을 만들지 않아야 한다. Branch는 사용자의 Create action 없이 자동 생성되면 안 된다.

## 4. Programmers 다중 언어 Happy Path

같은 문제에서 실제로 선택 가능한 지원 언어 두 개를 사용한다. 기본 검증 조합은 Swift와 Python3다.

1. 첫 번째 언어로 Accepted 제출을 만든다.
2. toast가 Syncing에서 Synced로 바뀌는지 확인한다.
3. 같은 문제를 두 번째 언어로 Accepted 제출한다.
4. 두 번째 sync도 Synced가 되는지 확인한다.
5. Sync Repository의 test branch에서 두 solution file이 모두 존재하는지 확인한다.
6. `programmers/README.md`의 같은 문제 한 행, 단일 `Languages` cell에 두 solution link가 표시되는지 확인한다.
7. `programmers/.programmers-sync/index.json`이 v4이고 두 language entry를 모두 보존하는지 확인한다.
8. 두 언어의 첫 commit message가 각각 `#1`을 포함하는지 확인한다.
9. 각 commit이 solution file, Solution README, Solution Catalog를 함께 변경했는지 확인한다.

## 5. GitHub 재연결 Happy Path

1. Options에서 GitHub 연결을 해제한다.
2. 다시 `Sign in with GitHub`로 같은 계정을 연결한다.
3. 기존 Sync Repository와 Sync Branch 선택이 유지되는지 확인한다.
4. Connection test를 다시 실행해 Connected 상태를 확인한다.

연결 해제는 auth session만 삭제하며 사용자가 선택한 repository와 branch 설정은 유지한다.

## 6. LeetCode Happy Path

1. LeetCode에서 실제로 선택 가능한 지원 언어 하나로 Accepted 제출을 만든다.
2. toast가 Syncing에서 Synced로 바뀌는지 확인한다.
3. Popup Sync History에서 Commit과 File link를 확인한다.
4. test branch에서 solution file, `leetcode/README.md`, `leetcode/.leetcode-sync/index.json`이 같은 commit에 포함됐는지 확인한다.

## 7. 최소 보안 확인

- Options, Popup, toast에 access token, refresh token, device code가 표시되지 않는다.
- LeetCode와 Programmers 문제 설명 전문이 local storage나 GitHub commit에 저장되지 않는다.
- 실제 token, cookie, session 값, private solution code를 screenshot, issue, fixture, log에 남기지 않는다.

지원 언어와 path 계약은 `docs/ARCHITECTURE.md`의 registry 표와 자동 테스트가 검증한다. 모든 언어를 실제 계정으로 반복 제출하는 것은 릴리즈 필수 조건이 아니다. 특정 Coding Platform의 label이나 editor 추출 회귀가 의심될 때만 해당 언어를 추가로 수동 검증한다.
