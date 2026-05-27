# Step 3: background-storage

## 읽을 파일

먼저 아래 파일을 읽고 architecture와 design intent를 이해한다:

- `/AGENTS.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/src/shared/types.ts`
- `/src/shared/storageSchema.ts`
- `/src/shared/errors.ts`
- `/src/shared/errorNormalize.ts`
- `/phases/0-mvp-extension/index.json`

수정하기 전에 이전 step에서 작성된 shared logic을 주의 깊게 읽는다.

## 작업

`chrome.storage.local` 기준의 background storage adapter와 lifecycle helper를 구현한다.

생성 또는 수정할 파일:

- `src/background/storage.ts`
- `src/background/storage.test.ts`
- `src/background/index.ts`는 필요한 export/import만 정리
- 필요한 shared 타입 보강

필수 기능:

- settings read/write
- processed submissions read/add/check
- sync history append/read, 최근 20개 유지
- retry payload add/read/remove/prune, 최대 20개, 최대 7일 TTL
- in-flight lock acquire/release/prune, 10분 TTL
- storage version field 유지
- Chrome API를 테스트할 수 있도록 storage area abstraction 또는 mock 가능한 wrapper 제공

필수 함수 예시:

- `createExtensionStorage(area): ExtensionStorage`
- `getSettings()`
- `saveSettings(settings)`
- `isProcessed(identity)`
- `markProcessed(identity)`
- `appendHistory(record)`
- `listHistory()`
- `saveRetryPayload(payload)`
- `removeRetryPayload(id)`
- `pruneRetryPayloads(now)`
- `acquireInFlightLock(identity, now)`
- `releaseInFlightLock(identity)`
- `pruneInFlightLocks(now)`

요구사항:

- MV3 service worker가 suspend되어도 복구 가능하도록 source of truth는 storage다.
- In-flight lock stale cleanup은 새 lock 획득 전에 실행한다.
- GitHub commit 성공 전에는 processed로 기록하지 않는 인터페이스를 유지한다.
- retry payload에는 code가 포함될 수 있으므로 테스트 fixture에는 실제 private code나 secret을 넣지 않는다.

테스트:

- duplicate processed identity check
- history 20개 cap
- retry payload 20개 cap
- retry payload 7일 TTL
- in-flight lock acquire/release
- stale in-flight lock 10분 TTL cleanup

## 인수 기준

```bash
npm run typecheck
npm test
npm run build
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 directory structure를 따르는가?
   - `ADR.md`의 stack decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/0-mvp-extension/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "background storage adapter for settings, processed identities, history, retry payloads, and in-flight locks"`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 오래 유지되는 module-level memory cache를 source of truth로 만들지 말 것. 이유: MV3 service worker는 언제든 suspend될 수 있다.
- retry payload 성공 후 삭제할 수 없는 형태로 저장하지 말 것. 이유: 보안 규칙상 성공 후 삭제해야 한다.
- processedSubmissions를 commit 전 기록하도록 설계하지 말 것. 이유: ADR-015 위반이다.
- 기존 test를 깨뜨리지 말 것.
