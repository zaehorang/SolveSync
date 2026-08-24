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
