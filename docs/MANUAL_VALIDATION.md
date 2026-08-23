# 수동 검증 체크리스트

> **Description**: 자동 테스트로 확인할 수 없는 실제 GitHub 로그인과 Coding Platform Accepted 흐름의 최소 happy path를 검증한다.

수동 검증은 릴리즈 전에 한 번 실행한다. 모든 언어 조합, 오류 상태, token 만료를 실제 계정으로 반복 검증하지 않는다. 순수 로직과 orchestration은 Vitest가 담당한다.

## 사전 조건

- Chrome Developer mode를 사용할 수 있다.
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
VITE_GITHUB_APP_CLIENT_ID= npm run package:chrome
VITE_GITHUB_APP_SLUG= npm run package:chrome
npm run package:chrome
```

`npm run build`는 GitHub App 공개 설정이 없는 checkout에서도 manifest 선언과 content IIFE 검증을 포함하여 통과해야 한다. 설정을 비운 두 `package:chrome` 명령은 각각 `VITE_GITHUB_APP_CLIENT_ID`, `VITE_GITHUB_APP_SLUG` 변수명을 포함한 release packaging 오류와 함께 non-zero로 종료해야 한다. 마지막 `npm run package:chrome`은 `.env.local`의 두 공개 설정을 bundle에서 확인하고 Chrome ZIP을 만들어야 한다. `npm run typecheck`와 `npm test`도 통과해야 한다. 일반 테스트는 실제 GitHub나 Coding Platform 네트워크, 사용자 secret을 사용하지 않는다.

## 2. Extension Load

1. Chrome에서 `chrome://extensions`를 연다.
2. Developer mode를 켠다.
3. `Load unpacked`로 `dist`를 선택한다.
4. extension error가 없는지 확인한다.
5. 문제 페이지에서 content script의 static ESM import error가 없는지 확인한다.

## 3. GitHub 연결 Happy Path

1. Options에서 `Sign in with GitHub`를 누른다.
2. GitHub tab이 자동으로 열리지 않고 Options에 일회용 code와 `Copy code and open GitHub` action이 먼저 표시되는지 확인한다.
3. `Copy code and open GitHub`를 누르고 일회용 code가 clipboard에 복사되며 GitHub Device Flow page가 새 tab에서 열리는지 확인한다.
4. Options의 `aria-live="polite"` 인증 상태 영역에 현재 locale의 복사 성공 안내가 표시되는지 확인한다. Clipboard 쓰기를 차단한 환경에서는 실패 안내가 표시되고, 화면의 일회용 code와 열린 GitHub page를 계속 사용할 수 있는지 확인한다.
5. 복사한 일회용 code를 GitHub Device Flow page에 입력하고 승인한다.
6. Options의 기존 polling이 승인을 감지하고 연결된 GitHub account login을 표시하는지 확인한다.
7. `Install or configure GitHub App`에서 본인 소유 test repository를 선택한다.
8. `Load Sync Repositories`에서 해당 repository를 선택한다.
9. 기존 test branch를 선택하거나 `Create Sync Branch`를 명시적으로 실행한다.
10. Connection test를 실행한다.
11. `Connected` 상태를 확인하고 Auto Sync를 켠 뒤 저장한다.

Connection test는 commit을 만들지 않아야 한다. Branch는 사용자의 Create action 없이 자동 생성되면 안 된다.

## 4. GitHub 재연결 Happy Path

1. Options에서 GitHub 연결을 해제한다.
2. 다시 `Sign in with GitHub`로 같은 계정을 연결한다.
3. 기존 Sync Repository와 Sync Branch 선택이 유지되는지 확인한다.
4. Connection test를 다시 실행해 Connected 상태를 확인한다.

연결 해제는 auth session만 삭제하며 사용자가 선택한 repository와 branch 설정은 유지한다.

## 5. Coding Platform 검증

공통 build, extension load와 GitHub 연결이 끝나면 [공통 수동 검증 골격](platforms/README.md#검증-공통-계약)을 각 Coding Platform에서 실행하고, 이어서 플랫폼 문서의 추가 절차를 실행한다.

- LeetCode [자동 검증](platforms/LEETCODE.md#자동-검증)과 [수동 검증](platforms/LEETCODE.md#수동-검증)
- Programmers [자동 검증](platforms/PROGRAMMERS.md#자동-검증)과 [수동 검증](platforms/PROGRAMMERS.md#수동-검증)
- SWEA [자동 검증](platforms/SWEA.md#자동-검증)과 [수동 검증](platforms/SWEA.md#수동-검증). 감지부터 commit까지와 Run·임시저장·컴파일 오류·오답의 non-Accepted 경로를 2026-08-18 실제 제출로 확인했다. 결과는 [확인된 전제](platforms/SWEA.md#확인된-전제)에 있다.

골격(플랫폼 login, Accepted happy path, Run/실패 제출 회귀, 두 번째 Solution Revision, route 이동)은 [Coding Platform 연동 계약](platforms/README.md)이 소유하고, 각 플랫폼 문서는 그 골격에서 벗어나는 절차만 소유한다. 모든 지원 언어를 실제 계정으로 반복 제출하지 않으며, 특정 Coding Platform의 label이나 editor 추출 회귀가 의심될 때만 해당 언어를 추가로 수동 검증한다.

기존 Sync Repository 마이그레이션은 정상 Accepted sync에서도 그대로 일어난다. LeetCode v3
Catalog와 언어별 개별 column README 또는 Difficulty column이 남은 Programmers README는
다음 정상 Accepted sync에서 managed marker 내부만 현재 형식으로 바뀌는지 확인한다. 기존
solution link, 날짜와 marker 밖 수동 내용이 유지되고, 같은 Catalog를 다시 렌더링했을 때
구조적 diff가 반복되지 않아야 한다. 이 전환을 풀이 commit과 분리하려면 sync 전에 6절의
저장소 파일 정리를 먼저 실행한다.

## 6. 저장소 파일 정리

1. 선택한 test branch에 유효한 LeetCode, Programmers와 SWEA Solution Catalog를 준비하고, Solution README managed marker 내부는 legacy 표 형식으로 만든다. marker 앞뒤에는 줄바꿈과 trailing space를 포함한 식별 가능한 수동 내용을 둔다.
2. Options에서 해당 Sync Repository와 Sync Branch가 선택되었는지 확인한다. 둘 중 하나를 선택하지 않은 상태에서는 정리 button이 disabled인지 확인한다.
3. `Clean up now` 또는 `지금 정리하기`를 누르고 진행 중 button이 disabled이며 `aria-live="polite"` 영역에 현재 locale의 진행 상태가 표시되는지 확인한다.
4. GitHub에서 `chore: README 표 형식을 정리한다` commit이 정확히 하나 생성되었는지 확인한다. 파일 목록에는 실제로 달라진 `leetcode/README.md`, `programmers/README.md`와 `swea/README.md`만 있어야 하며 Solution File과 Solution Catalog는 없어야 한다. 정리 대상 Coding Platform 목록은 `cleanupRepository`가 갖고 있으므로 Coding Platform을 추가하면 여기도 함께 확인한다.
5. 각 Solution README의 managed marker 내부가 현재 플랫폼별 표 형식으로 바뀌고 marker 앞뒤의 수동 bytes, 기존 solution link와 날짜가 보존되는지 확인한다. 선택한 Sync Branch 외 branch는 변하지 않고 새 branch도 생성되지 않아야 한다.
6. 같은 action을 다시 실행해 Options에 변경 없음 상태가 표시되고 두 번째 commit이 생성되지 않는지 확인한다.
7. Catalog 하나를 잠시 malformed JSON으로 만든 test branch에서 실행해 현재 locale의 실패 상태가 표시되고 정리 commit이 생성되지 않는지 확인한다. 검증 뒤 Catalog를 복구한다.

정리 action은 legacy README 전환을 Accepted sync commit과 분리하기 위한 projection 전용 action이다. Coding Platform에서 데이터를 다시 가져오거나 Solution File과 Solution Catalog를 변경하지 않는다.

## 7. 최소 보안 확인

- Options, Popup, toast에 access token, refresh token, device code가 표시되지 않는다.
- 지원 Coding Platform 문제 설명 전문이 local storage나 GitHub commit에 저장되지 않는다.
- 실제 token, cookie, session 값, private solution code를 screenshot, issue, fixture, log에 남기지 않는다.

지원 언어와 path 계약은 `docs/ARCHITECTURE.md`의 registry 표와 자동 테스트가 검증한다.
