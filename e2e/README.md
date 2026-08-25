# 검증 하네스

> **Description**: Sealed E2E, GitHub write, Contract Check와 풀사이클을 실행하는 하네스다. 계층의 정의와 각 계층이 잡지 못하는 것은 [Coding Platform 연동 계약](../docs/platforms/README.md#검증-공통-계약)을 따른다.

## 왜 `src/` 밖인가

vite 진입점에 걸리지 않아 **확장 번들에 절대 포함되지 않는다.** 제출 버튼처럼 제품이 쓰지 않는 selector가 여기에만 존재할 수 있고, 그것이 프로덕션에 실릴 걱정을 구조가 대신 막는다. 별도 구획 분리나 build 검사가 필요 없는 이유다.

타입은 `e2e/tsconfig.json`으로 따로 검사한다. root `tsconfig.json`은 `types: ["chrome", "vitest/globals"]`라 Playwright 타입과 한 program에 섞을 수 없다.

## 구조

```text
e2e/
├── capture/     # 캡처 도구. 플랫폼별 제출 driver, recorder, redaction
├── drivers/     # Platform E2E Driver. 플랫폼별 fixture, 기준 문제, 제출 조작
├── fixtures/    # 실제 page에서 캡처한 sanitized DOM과 검증용 풀이
└── support/     # 확장 로드, route 가로채기, 확장 page 메시징,
                 # Verification Profile, Verification Repository, 자격증명
```

드라이버는 [`drivers/index.ts`](drivers/index.ts)에 등록한 것만 spec이 돈다. 새 플랫폼은 드라이버 파일 하나와 거기 한 줄로 붙는다.

## 실행

```bash
npm run build   # dist/를 그대로 로드하므로 최신 빌드가 필요하다
npm run e2e
```

## 캡처

Sealed E2E의 입력이 되는 실제 DOM을 만든다. 플랫폼당 성공 1회 + 실패 1회가 필요하며, **두 신호가 겹치지 않는 것을 실측해야** "실패는 event 0회"가 진짜 검증이 된다.

```bash
# 1회: Verification Profile에 LeetCode·Programmers 로그인
npm run e2e:login

# 캡처
CAPTURE_PLATFORM=leetcode CAPTURE_OUTCOME=accepted npm run e2e:capture
npm run e2e:capture:swea   # SWEA는 로그인과 정답·오답 캡처를 한 세션에서 끝낸다
```

`npm run e2e:login`은 탭을 띄운다. 로그인을 마치고 브라우저를 닫으면 세션이 `.verification-profile/`에 남는다. SWEA는 `/main/identity/anonymous/loginPage.do`로 연다 — `/main/login.do`도 200을 주지만 본문이 비어 있어 빈 화면만 뜬다.

**SWEA 세션만 디스크에 남지 않는다.** `SESSION` 쿠키가 만료 기한 없이 발급되는 진짜 session cookie라 브라우저 프로세스가 끝나면 사라진다(2026-08-25 실측). 그래서 SWEA는 "미리 로그인해 두고 나중에 캡처"가 통하지 않고, 전용 spec이 로그인과 캡처를 한 프로세스 안에서 잇는다. `.env`에 `E2E_SWEA_ID`/`E2E_SWEA_PASSWORD`가 있으면 로그인까지 자동이고, 없으면 사람이 로그인할 때까지 최대 5분 기다린다. `.env`는 `.gitignore`에 있고 견본은 `.env.example`이다.

결과는 `e2e/fixtures/{platform}/{outcome}.json`에 저장된다. 언제 끝났다고 볼지는 플랫폼마다 다르다 — Programmers·SWEA는 변화가 멎는 것으로 보고, **LeetCode는 침묵이 오지 않아** 대기 text가 판정으로 바뀌는 전이를 신호로 쓴다.

**확장 없이 뜬다.** 확장이 켜진 채로 실제 제출을 하면 진짜 sync가 돌아 실사용 Sync Repository에 commit이 생기고 processed Sync Deduplication Key까지 남는다. 나중에 같은 문제를 실제로 풀었을 때 commit이 조용히 안 생긴다.

**제출은 자동화돼 있다.** selector는 전부 실제 page를 열어 확인한 것이고 [`capture/drivers.ts`](capture/drivers.ts)에 근거와 함께 적혀 있다. 추측한 selector를 코드에 박는 것이 이 계층이 없애려는 문제 그 자체이므로, 그 값을 바꿀 때는 반드시 실제 page에서 다시 확인한다.

**제출 앞에 문이 둘 있다.** 제출은 되돌릴 수 없고 SWEA는 횟수 상한까지 있다.

- editor가 넣으려던 code를 실제로 들고 있는지 확인한다. editor는 입력을 조용히 바꾸고(auto-indent), page가 저장된 풀이로 덮어쓰기도 한다.
- SWEA는 채점 제출 없이 먼저 실행해 예제 입출력과 대조한다. 정답본이 어긋나거나 오답본이 정답을 내면 제출하지 않는다.

둘 다 실제로 잘못된 제출을 여러 번 막았다. 우회하지 않는다.

### 남기지 않는 것

redaction은 회수 경로에 박혀 있고 저장 직전에 한 번 더 검사한다. 새면 저장하지 않고 멈춘다. 규칙은 [`capture/redact.ts`](capture/redact.ts)에 있고 [`capture/redact.test.ts`](capture/redact.test.ts)가 고정한다.

**solution code는 세 경로로 샜었다**(2026-08-25에 찾아 막았다). 어느 것도 `<textarea>` 비우기로는 잡히지 않는다.

- Monaco와 CodeMirror는 code를 `<textarea>`가 아니라 DOM span으로 그린다.
- LeetCode 제출 결과 panel이 방금 제출한 source를 줄 번호와 함께 다시 렌더한다. 하필 판정 text가 오는 바로 그 node다.
- hydration `<script>`에 직전 제출 code가 JSON으로 들어 있다. 화면에 보이지도 않는다.

그래서 editor·`<script>`·`<style>` 안의 mutation은 기록하지 않고, 그것들을 품은 바깥 wrapper가 직렬화될 때는 복제본에서 해당 subtree를 비우며, 제출한 code의 특징적인 줄은 redaction 대상으로 등록한다. **새 플랫폼을 추가하면 이 세 경로를 다시 확인한다.** 저장 직전 검사가 마지막 문이지만, 그것에만 기대지 않는다.

## Sealed E2E

실제 도메인 URL로 **최소 뼈대** page를 띄우고 캡처에서 온 판정 text를 그대로 나타나게 한 뒤, 프로덕션 content script가 그것을 Accepted로 읽어 background까지 보내는지 본다. 관측점은 Sync History다 — `onMessage`를 후킹하면 service worker가 잠들 때 날아가고, storage에 남는 것은 "도달했다"보다 강한 것을 본다.

**GitHub를 설정하지 않고 돌린다.** `setup_required` entry가 남고 거기에 platform·problem이 들어 있다. 네트워크를 타지 않아 secret 없이 fork PR에서도 돈다.

### 왜 뼈대는 짓고 text는 짓지 않는가

캡처는 DOM snapshot이 아니라 **mutation 기록**이고, mutation의 `target`에 node 경로가 없어(`{kind, name}`뿐) 기록을 그대로 되감을 수 없다. 그래서 뼈대는 드라이버가 최소한으로 짓는다.

그 자유도가 판정 text까지 번지면 **우리가 상상한 DOM으로 우리 adapter를 검증하는 순환**이 되어 통과해도 아무것도 보장하지 않는다. 그래서 판정 text는 드라이버에 상수로 두되 [`support/capturedResult.ts`](support/capturedResult.ts)가 그 값이 캡처에 실재하는지 재생 전에 확인한다. 플랫폼이 문구를 바꿔 새 캡처가 들어오면 이 확인이 먼저 깨진다.

## GitHub write 계층

확장 options page에서 `content:accepted_detected`를 보내 **플랫폼 page 없이** orchestration 전 구간을 태우고, Verification Repository에 실제로 생긴 commit을 GitHub API로 밖에서 확인한다. 여기서 실패하면 원인이 GitHub 경로 하나로 좁혀진다.

설정은 캡처용 자격증명과 같은 자리, `.env`에 둔다. `playwright.config.ts`가 읽고 견본은 [`.env.example`](../.env.example)에 있다. **`.env`는 worktree 안에 있어야 한다** — 주 디렉터리에 두면 조용히 무시된다.

```bash
E2E_GITHUB_REPOSITORY=owner/verification-repository
E2E_GITHUB_TOKEN=...
```

- 합성 payload가 없는 플랫폼은 이 계층을 돌지 않는다. **LeetCode가 그렇다** — source 조회가 플랫폼 세션을 요구해 합성 event로는 GitHub까지 닿지 못한다. 그 경로는 풀사이클이 실증한다.
- 환경 변수가 없으면 **spec이 스스로 건너뛴다.** fork PR에는 secret이 없어 자동으로 그렇게 되고, Sealed 계층만 남아 그대로 통과한다.
- 대상은 전용 **Verification Repository**다. 기본값을 두지 않아 설정 실수로 실사용 Sync Repository를 쓸 경로 자체가 없다.
- token은 그 저장소 한 곳에만 쓰기 권한을 가진 fine-grained token이다.
- 실행마다 `e2e/{uuid}` branch를 하네스가 만들고 끝나면 지운다. 동시 PR이 서로를 밟지 않는다. **제품이 만드는 branch가 아니므로 자동 생성 금지 규칙은 그대로다.**

### 두 가지 전제에 기대고 있다

`content:accepted_detected`는 **sender가 content script인지 검사하지 않는다.** `externally_connectable`이 없어 외부 web page는 못 보내지만 같은 확장의 어느 context든 보낼 수 있다. 나중에 sender 검증을 조이면 이 계층도 함께 고쳐야 한다.

auth session은 `chrome.storage.local`에 직접 심는다. `BackgroundRuntimeOptions.authManager` 주입은 프로덕션이 아닌 번들을 로드하게 되어 이 계층의 전제를 깨기 때문이다. 대가는 **storage schema가 바뀌면 하네스가 조용히 어긋난다**는 것이고, [`auth-seed.spec.ts`](auth-seed.spec.ts)가 제품 parser로 그것을 막는다. secret 없이 돈다.

이 계층이 잡지 못하는 것은 **실제 인증 경로**다. Device Flow와 token refresh는 세션을 심어 건너뛰므로 풀사이클이 실증한다.

## 상태

하네스 배선, Sealed E2E, GitHub write 계층이 동작한다. 확장이 로드되고, 캡처에서 온 판정 text가 Sync History까지 도달하고, 합성 event가 Verification Repository의 commit이 되는 것까지 확인한다. 세 플랫폼 드라이버가 모두 Sealed를 통과한다.

- 드라이버 계약: [`drivers/types.ts`](drivers/types.ts)
- 구축 계획: [`docs/plans/e2e/`](../docs/plans/e2e/)

세 플랫폼의 정답·오답 fixture 여섯 개가 `fixtures/`에 있다. 각 fixture가 담고 있는 판정과 재생할 때 주의할 점은 [Phase 3 계획](../docs/plans/e2e/phase-3-harness.md#phase-1이-넘긴-것)에 정리돼 있다.

아직 없는 것: Contract Check, 풀사이클. 둘 다 Verification Profile의 로그인 세션이 필요해 CI에 배선하지 않는다.

## Verification Profile은 실제 Chrome으로 띄운다

Playwright 번들 Chromium을 기본 설정으로 띄우면 **LeetCode 로그인이 Cloudflare Turnstile에 막힌다**(Error 600010). 원인은 두 가지 자동화 신호다.

- `--enable-automation` 기본 인자가 `navigator.webdriver`를 켠다.
- 번들 Chromium 자체가 흔한 자동화 지문이다.

그래서 `channel: "chrome"`으로 실제 Chrome을 쓰고 `ignoreDefaultArgs: ["--enable-automation"]`와 `--disable-blink-features=AutomationControlled`를 준다. 이러면 `navigator.webdriver`가 `false`가 되고 로그인 폼이 정상적으로 뜬다.

Sealed E2E는 이 조건이 필요 없다. 실제 플랫폼을 상대하지 않기 때문이며, CI에는 Chrome이 없으므로 [`support/extension.ts`](support/extension.ts)는 계속 번들 Chromium을 쓴다.

## headless에서 확장을 로드하려면 채널을 명시해야 한다

Playwright의 `headless: true` 기본값은 `chromium_headless_shell`을 쓰는데 **그 바이너리는 확장을 지원하지 않는다.** service worker가 기동하지 않고 timeout으로만 드러나 원인이 보이지 않는다. `channel: "chromium"`을 명시한다.

## 절대 남기지 않을 것

fixture, log, screenshot 어디에도 두지 않는다.

- solution code 원문 (줄 수·길이·해시로만 남긴다)
- GitHub token, Coding Platform cookie와 session token
- 계정 식별자, 문제 설명 전문

alert layer의 UI 문구는 사용자 데이터가 아니므로 보존한다.
