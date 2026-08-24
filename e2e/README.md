# 검증 하네스

> **Description**: Sealed E2E, GitHub write, Contract Check와 풀사이클을 실행하는 하네스다. 계층의 정의와 각 계층이 잡지 못하는 것은 [Coding Platform 연동 계약](../docs/platforms/README.md#검증-공통-계약)을 따른다.

## 왜 `src/` 밖인가

vite 진입점에 걸리지 않아 **확장 번들에 절대 포함되지 않는다.** 제출 버튼처럼 제품이 쓰지 않는 selector가 여기에만 존재할 수 있고, 그것이 프로덕션에 실릴 걱정을 구조가 대신 막는다. 별도 구획 분리나 build 검사가 필요 없는 이유다.

타입은 `e2e/tsconfig.json`으로 따로 검사한다. root `tsconfig.json`은 `types: ["chrome", "vitest/globals"]`라 Playwright 타입과 한 program에 섞을 수 없다.

## 구조

```text
e2e/
├── drivers/     # Platform E2E Driver. 플랫폼별 fixture, 기준 문제, 제출 조작
├── fixtures/    # 실제 page에서 캡처한 sanitized DOM. 캡처 절차는 Phase 1
└── support/     # 확장 로드, route 가로채기, Verification Profile 부트스트랩
```

## 실행

```bash
npm run build   # dist/를 그대로 로드하므로 최신 빌드가 필요하다
npm run e2e
```

## 캡처

Sealed E2E의 입력이 되는 실제 DOM을 만든다. 플랫폼당 성공 1회 + 실패 1회가 필요하며, **두 신호가 겹치지 않는 것을 실측해야** "실패는 event 0회"가 진짜 검증이 된다.

```bash
# 1회: Verification Profile에 세 플랫폼 로그인
CAPTURE_PLATFORM=leetcode npm run e2e:capture   # 열리면 로그인만 하고 닫는다

# 캡처
CAPTURE_PLATFORM=programmers CAPTURE_OUTCOME=accepted npm run e2e:capture
CAPTURE_PLATFORM=programmers CAPTURE_OUTCOME=rejected npm run e2e:capture
```

브라우저가 뜨고 recorder가 무장된 뒤 제출을 만들면, 변화가 4초 이상 멎을 때 `e2e/fixtures/{platform}/{outcome}.json`에 저장된다.

**확장 없이 뜬다.** 확장이 켜진 채로 실제 제출을 하면 진짜 sync가 돌아 실사용 Sync Repository에 commit이 생기고 processed Sync Deduplication Key까지 남는다. 나중에 같은 문제를 실제로 풀었을 때 commit이 조용히 안 생긴다.

**제출은 자동화하지 않았다.** 제출 버튼 selector는 실제 page를 보고 확정해야 한다. 추측한 selector를 코드에 박는 것이 이 계층이 없애려는 문제 그 자체다.

### 남기지 않는 것

redaction은 회수 경로에 박혀 있고 저장 직전에 한 번 더 검사한다. 새면 저장하지 않고 멈춘다. 규칙은 [`capture/redact.ts`](capture/redact.ts)에 있고 [`capture/redact.test.ts`](capture/redact.test.ts)가 고정한다.

## 상태

하네스 배선은 동작한다. 확장이 로드되고 실제 도메인 URL에서 content script가 주입되는 것까지 확인한다.

- 드라이버 계약: [`drivers/types.ts`](drivers/types.ts)
- 구축 계획: [`docs/plans/e2e/`](../docs/plans/e2e/)

아직 없는 것: 캡처 fixture 기반 Sealed E2E, GitHub write 계층, Contract Check, 풀사이클.

## headless에서 확장을 로드하려면 채널을 명시해야 한다

Playwright의 `headless: true` 기본값은 `chromium_headless_shell`을 쓰는데 **그 바이너리는 확장을 지원하지 않는다.** service worker가 기동하지 않고 timeout으로만 드러나 원인이 보이지 않는다. `channel: "chromium"`을 명시한다.

## 절대 남기지 않을 것

fixture, log, screenshot 어디에도 두지 않는다.

- solution code 원문 (줄 수·길이·해시로만 남긴다)
- GitHub token, Coding Platform cookie와 session token
- 계정 식별자, 문제 설명 전문

alert layer의 UI 문구는 사용자 데이터가 아니므로 보존한다.
