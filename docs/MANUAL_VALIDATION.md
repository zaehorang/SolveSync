# 수동 검증 체크리스트

> **Description**: 자동 테스트로 확인할 수 없는 실제 GitHub 로그인, Coding Platform Accepted 흐름과 Public Preview 배포·storage lifecycle을 검증한다.

수동 검증은 릴리즈 전에 한 번 실행한다. 모든 언어 조합, 오류 상태, token 만료를 실제 계정으로 반복 검증하지 않는다. 순수 로직과 orchestration은 Vitest가 담당하고, 이 문서는 실제 Chrome profile과 Release ZIP에서만 확인 가능한 경계를 다룬다.

## 사전 조건

- Chrome Developer mode를 사용할 수 있다.
- LeetCode와 Programmers에 로그인되어 있다.
- Device Flow와 expiring user access token을 활성화한 public SolveSync GitHub App이 준비되어 있다.
- GitHub App repository permission은 Metadata read와 Contents read/write다.
- 로그인할 GitHub 계정이 소유한 별도 test repository에 App을 설치한다.
- 실제 풀이 branch 대신 `solvesync-test` 같은 test branch를 사용한다.
- 실제 사용자 profile과 분리된 Chrome test profile을 사용한다.
- storage isolation, deletion, oversize 검증에는 실제 token, private solution code 또는 실제 풀이 repository를 사용하지 않는다.

검증 대상에 따른 추가 조건:

- source build를 검증할 때는 `.env.local`에 `VITE_GITHUB_APP_CLIENT_ID`, `VITE_GITHUB_APP_SLUG`를 설정하고 직접 `npm run build`를 실행한다.
- 이미 패키징된 Release ZIP을 검증할 때는 `.env.local`이 필요 없다. ZIP의 compiled JavaScript에 공개 App 설정이 반영되어 있어야 한다.
- 두 경우 모두 client secret은 사용하지 않는다.

특정 repository나 branch를 제품 기본값으로 고정하지 않는다. 검증할 때 Options의 picker에서 직접 선택한다.

## 1. 자동 검증

저장소 루트에서 실행한다.

```bash
npm run typecheck
npm test
npm run build
npm run package:chrome
```

source와 패키징 결과를 검증하는 maintainer는 모두 통과시켜야 한다. `package:chrome`는 `artifacts/` 아래 Release ZIP을 만들고 필수·금지 경로를 검사한다. 일반 테스트는 실제 GitHub, LeetCode, Programmers 네트워크나 사용자 secret을 사용하지 않는다. 이미 생성된 Release ZIP만 검증하는 tester는 이 절차 대신 배포자가 제공한 ZIP에서 2절부터 진행한다.

## 2. Extension Load

1. Chrome에서 `chrome://extensions`를 연다.
2. Developer mode를 켠다.
3. source build 검증은 `Load unpacked`로 `dist`를 선택한다. Release ZIP 검증은 압축을 푼 폴더를 선택한다.
4. extension error가 없는지 확인한다.
5. 문제 페이지에서 content script의 static ESM import error가 없는지 확인한다.
6. SolveSync 카드의 extension ID, version과 설치 폴더를 release 검증 기록에 남긴다. 이 기록에는 local storage 내용이나 secret을 포함하지 않는다.

## 3. GitHub 연결 Happy Path

1. Options에서 `Sign in with GitHub`를 누른다.
2. 표시된 일회용 code를 GitHub Device Flow page에서 승인한다.
3. Options에 연결된 GitHub account login이 표시되는지 확인한다.
4. `Install or configure GitHub App`에서 본인 소유 test repository를 선택한다.
5. `Load Sync Repositories`에서 해당 repository를 선택한다.
6. 기존 test branch를 선택하거나 `Create Sync Branch`를 명시적으로 실행한다.
7. Connection test를 실행한다.
8. `Connected` 상태를 확인하고 Auto Sync를 켠 뒤 저장한다.

Connection test는 repository/branch와 Git data read access만 확인하고 commit 또는 branch update를 만들지 않아야 한다. 통과하더라도 branch protection과 실제 write 가능성을 보장하지 않는다. Branch는 사용자의 Create action 없이 자동 생성되면 안 된다.

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

## 7. Release ZIP 설치, 업데이트와 rollback

1. `npm run package:chrome`가 만든 ZIP의 루트에 `manifest.json`이 있고 `src/`, `docs/`, `node_modules/`, `.env`, `.env.local`, source map, local secret이 없는지 확인한다.
2. 이전 공식 Public Preview를 test profile의 고정 폴더에 압축 해제하고 `Load unpacked`로 설치한다.
3. harmless test repository/branch와 Auto Sync 설정을 저장하고 extension ID와 version을 기록한다.
4. 새 release ZIP을 별도 임시 폴더에 풀고, 기존 고정 설치 폴더의 build 파일을 새 release 내용으로 교체한다.
5. 새 경로에서 `Load unpacked`하지 않고 기존 SolveSync 카드의 `Reload`를 누른다.
6. extension ID가 같고 설정, Sync History와 retry 가능한 test state가 의도한 migration 정책대로 유지되는지 확인한다.
7. read-only Connection test와 대표 Accepted sync를 다시 실행한다.
8. 기존 고정 설치 폴더에 이전 release build 파일을 복원하고 `Reload`해 rollback한다.
9. rollback 뒤 extension error와 storage parse 오류가 없는지 확인한다. 이전 release가 새 storage schema를 지원하지 않으면 해당 rollback을 지원하지 않는 것으로 release note에 명시하고 최신 release로 복귀한다.
10. update와 rollback 동안 SolveSync instance가 두 개 생기거나 같은 Accepted에서 중복 commit이 생성되지 않았는지 확인한다.

## 8. Extension storage isolation

1. Test profile의 Coding Platform page DevTools에서 page `localStorage`와 IndexedDB에 SolveSync의 `settings`, `githubAuth`, `syncHistory`, `retryBundles` key가 생기지 않는지 확인한다.
2. 첫 설치 경로와 다른 임시 경로에서 같은 Release ZIP을 한 번 더 Load unpacked한다.
3. 두 instance의 extension ID가 다르고, 두 번째 instance의 Options가 첫 instance의 repository/branch, Sync History, auth 상태를 읽지 못하는지 확인한다.
4. 두 번째 instance를 disabled한 뒤 제거한다. 첫 instance의 local state가 영향을 받지 않는지 확인한다.
5. Content page, Popup, Options의 화면이나 runtime error에 access token, refresh token, device code가 노출되지 않는지 확인한다.

이 검증은 extension storage가 Coding Platform origin storage 및 다른 unpacked instance와 격리되는지 확인하기 위한 것이다. 두 instance를 enabled한 상태로 Accepted 제출을 만들지 않는다.

## 9. Retry Bundle cleanup alarm

Cleanup 계약:

- alarm 이름: `retry-bundle-prune`
- 주기: `periodInMinutes: 1440`
- service worker boot, `runtime.onStartup`, `runtime.onInstalled`: 즉시 expired Retry Bundle prune 후 alarm ensure
- `alarms.onAlarm`: `retry-bundle-prune`일 때 expired Retry Bundle prune

검증 절차:

1. Harmless generated solution을 사용하는 test-only retryable failure를 만들어 Retry Bundle 하나가 Popup에 표시되는지 확인한다.
2. Extension service worker DevTools에서 `chrome.alarms.get("retry-bundle-prune")`를 실행해 alarm이 존재하고 `periodInMinutes`가 `1440`인지 확인한다. 출력에 storage payload나 token을 포함하지 않는다.
3. Test-only expired Retry Bundle fixture를 사용해 service worker를 다시 시작하고, boot 직후 bundle이 local storage와 Popup Retry action에서 제거되는지 확인한다.
4. 같은 fixture로 Chrome test profile startup 또는 extension reload 후 즉시 prune되는지 확인한다.
5. Alarm을 삭제한 test-only 상태에서 service worker를 다시 시작해 alarm이 다시 생성되는지 확인한다.
6. 유효한 7일 이내 Retry Bundle과 Sync History는 cleanup 뒤에도 유지되는지 확인한다.

실제 사용자 profile의 clock이나 storage timestamp를 수정하지 않는다. Expired fixture 주입이 필요한 검증은 token과 private code가 없는 test profile에서만 수행한다.

## 10. Local data 삭제와 GitHub offboarding

1. GitHub 연결 상태에서 Sync Repository/Sync Branch, harmless Sync History와 test Retry Bundle을 준비한다.
2. Options에서 `Delete Retry Data`를 실행하고 확인 단계에서 취소했을 때 아무 data도 바뀌지 않는지 확인한다.
3. 다시 실행해 삭제를 확인하고 Retry Bundle과 retry action만 제거되며 Sync History, settings와 auth session은 유지되는지 확인한다.
4. 새 harmless Retry Bundle을 만든 뒤 Options에서 `Disconnect GitHub`를 실행한다.
5. GitHub auth session과 pending Device Flow만 삭제되고 repository/branch 설정, Sync History와 Retry Bundle은 유지되는지 확인한다.
6. 다시 로그인해 test state를 준비하고 `Delete all local data`의 확인 단계에서 취소했을 때 아무 data도 바뀌지 않는지 확인한다.
7. 삭제를 확인하고 GitHub auth와 pending Device Flow, repository/branch 설정, Sync History, Retry Bundle, lock과 processed state가 초기 상태인지 확인한다.
8. `chrome://extensions`에서 SolveSync를 `Remove`한 뒤 같은 release를 같은 경로에서 다시 Load unpacked하고 초기 상태인지 확인한다.
9. GitHub App installation과 authorization은 local data 삭제나 extension 제거만으로 없어지지 않는지 GitHub `Settings → Applications`에서 확인한다.
10. GitHub authorization을 revoke하고 Installed GitHub App의 test repository access를 제거한다.
11. 이미 생성된 test commit과 solution file은 남아 있으며 extension이 자동 삭제하지 않는지 확인한다. 검증이 끝나면 test branch를 사용자 승인 범위에서 정리한다.

## 11. Payload size boundary와 storage quota failure

실제 solution이나 secret 대신 UTF-8 byte 길이를 정확히 제어할 수 있는 generated text를 사용하는 test-only build/profile에서 수행한다. Accepted code runtime payload 제한은 256 KiB, 즉 262,144 UTF-8 bytes다.

1. `TextEncoder().encode(code).byteLength`가 정확히 `262144`인 generated code payload를 준비한다.
2. 이 payload가 runtime ingress에서 `payload_too_large`로 거부되지 않고 정상 orchestration 경계까지 전달되는지 확인한다.
3. 같은 방식으로 정확히 `262145` UTF-8 bytes인 payload를 준비한다.
4. `262145` bytes payload가 sender/schema 검증은 통과하되 source validation에서 `payload_too_large` non-retryable Sync History로 기록되는지 확인한다.
5. 제한을 초과한 payload로 GitHub API request, GitHub commit, Retry Bundle, processed Sync Deduplication Key가 생성되지 않는지 확인한다.
6. Boundary 검증과 별도로 Chrome extension local storage quota를 초과하는 test-only failure를 실행한다.
7. Storage write failure가 Popup/Toast의 `storage_quota_exceeded` normalized failure로 표시되고 service worker가 unhandled rejection으로 중단되지 않는지 확인한다.
8. Storage quota 실패한 Sync Deduplication Key가 processed success로 기록되지 않고 GitHub branch에 partial commit이 생기지 않는지 확인한다.
9. 저장에 실패한 Retry Bundle에 Retry button이 잘못 표시되지 않는지 확인한다.
10. 기존의 작은 Retry Bundle, Sync History, settings와 GitHub auth state가 손상되지 않는지 확인한다.
11. Test-only generated text를 issue, screenshot 또는 release artifact에 포함하지 않고 test profile을 제거한다.

## 12. 최소 보안 확인

- Options, Popup, toast에 access token, refresh token, device code가 표시되지 않는다.
- LeetCode와 Programmers 문제 설명 전문이 local storage나 GitHub commit에 저장되지 않는다.
- 실제 token, cookie, session 값, private solution code를 screenshot, issue, fixture, log에 남기지 않는다.
- 일반 bug는 issue form을 사용하고, 취약점은 GitHub Private Vulnerability Reporting으로만 제보할 수 있는지 공개 링크를 확인한다.

지원 언어와 path 계약은 `docs/ARCHITECTURE.md`의 registry 표와 자동 테스트가 검증한다. 모든 언어를 실제 계정으로 반복 제출하는 것은 릴리즈 필수 조건이 아니다. 특정 Coding Platform의 label이나 editor 추출 회귀가 의심될 때만 해당 언어를 추가로 수동 검증한다.
