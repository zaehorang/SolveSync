# src/background

Chrome MV3 service worker에서 sync state machine과 외부 API 경계를 소유하는 module이다.

Entrypoint: [`index.ts`](../../src/background/index.ts)가 `vite.config.ts`의 `background` input이고 `manifest.json`의 service worker다.

## Owns
- sync orchestration, Coding Platform source resolver와 storage-backed deduplication lock
- settings, GitHub auth, Retry Bundle과 Sync History persistence
- `client/` 아래의 GitHub Git Data API와 LeetCode GraphQL 경계
- content, options와 popup이 사용하는 runtime message 처리

## Common changes
- sync 순서 변경 → [`sync.ts`](../../src/background/sync.ts)와 [`sync.test.ts`](../../src/background/sync.test.ts)를 먼저 바꾸고 commit 성공·실패별 storage 기록을 검증한다.
- runtime/storage 계약 변경 → [`runtime.ts`](../../src/background/runtime.ts), [`storage.ts`](../../src/background/storage.ts)와 `src/shared` 계약을 함께 갱신한다.
- 외부 API 변경 → [`client/github.ts`](../../src/background/client/github.ts) 또는 [`client/leetcode.ts`](../../src/background/client/leetcode.ts) 안에서 흡수하고 normalized error를 검증한다.

```bash
npx vitest run src/background
```

```mermaid
sequenceDiagram
  content->>background: content:accepted_detected
  background->>client: source 조회 및 Git commit
  client-->>background: source 또는 commit 결과
  background-->>content: sync status
```

## Non-obvious
- 주의: processed Sync Deduplication Key 기록 시점은 [ARCHITECTURE](../ARCHITECTURE.md)와 [ADR 0042](../adr/0042-skip-commit-for-accepted-already-in-solution-catalog.md)가 정한다. 이 module에서는 `sync.test.ts`가 commit 성공·실패·건너뜀 세 경로의 storage 기록을 각각 단언한다.
- 주의: MV3 service worker의 장기 in-memory state를 source of truth로 쓰지 않는다.
- Why: service worker는 언제든 suspend될 수 있으므로 lock, history와 retry 상태가 storage에서 복구되어야 한다.

## Dependencies
- imports: `src/shared`, `src/background/client`
- imported by: extension service worker entry; `src/content`, `src/options`, `src/popup`은 runtime message로 호출
- 계약 문서: [ARCHITECTURE](../ARCHITECTURE.md), [Coding Platform 공통 계약](../platforms/README.md), [ADR 목록](../adr/README.md)
