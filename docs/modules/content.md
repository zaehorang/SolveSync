# src/content

Coding Platform 문제 page를 관찰해 Accepted event와 사용자 toast feedback을 만드는 module이다.

Entrypoint: content script는 [`index.ts`](../../src/content/index.ts)([`vite.content.config.ts`](../../vite.content.config.ts)), SWEA MAIN world bridge는 [`sweaEditorBridge.ts`](../../src/content/sweaEditorBridge.ts)([`vite.swea-bridge.config.ts`](../../vite.swea-bridge.config.ts))다. 둘 다 단일 IIFE로 빌드되고 `manifest.json`의 `content_scripts`가 로드한다.

## Owns
- route lifecycle, DOM 관찰과 fresh Accepted transition 감지
- Coding Platform Adapter 구현체([`platforms/`](../../src/content/platforms/))와 그것을 구동하는 event controller
- Accepted 직후 Editor Snapshot과 immutable Accepted event 생성
- SWEA MAIN world editor bridge와 code 응답 protocol
- background messaging과 문제 page toast

## Common changes
- 플랫폼 감지 변경 → [`platforms/`](../../src/content/platforms/)의 해당 구현체와 플랫폼 문서를 함께 갱신한다. controller와 공통 순회 helper는 건드리지 않는다.
- SWEA editor source 변경 → [`sweaEditorBridge.ts`](../../src/content/sweaEditorBridge.ts), [`sweaBridgeProtocol.ts`](../../src/content/sweaBridgeProtocol.ts)과 bridge test를 확인한다.
- 새 Coding Platform 추가 → content 쪽에서는 [`platforms/`](../../src/content/platforms/)에 구현체를 만들고 [`platforms/index.ts`](../../src/content/platforms/index.ts)에 한 줄 추가한다. controller와 공통 helper는 건드리지 않는다. module 밖에서는 `src/shared`의 platform union·policy·language registry, `manifest.json`의 host permission과 match, background source resolver, `docs/platforms/` 문서, `e2e/drivers/` 등록이 함께 바뀐다.
- toast 변경 → [`toast.ts`](../../src/content/toast.ts)를 수정하고 UI locale과 action별 model test를 갱신한다.

```bash
npx vitest run src/content
npm run build
```

공통 계약이 세 구현체에 모두 걸리는지는 [`platforms/contract.test.ts`](../../src/content/platforms/contract.test.ts)가 본다. 플랫폼 고유 동작은 각 구현체 test가 맡는다.

## Non-obvious
- 주의: `content_scripts`는 classic script라 build 결과에 static ESM `import`가 남으면 안 된다. 규칙은 [ARCHITECTURE](../ARCHITECTURE.md)가 정하고 `npm run build`가 검사한다.
- 주의: SWEA bridge protocol에는 code string만 넣고 문제 metadata나 auth 정보를 넘기지 않는다.
- Why: isolated world에서는 SWEA editor state를 읽을 수 없어 최소한의 MAIN world bridge만 사용한다.
- 주의: controller에는 플랫폼 분기를 두지 않는다. `platform === "..."` 비교가 controller나 공통 helper에 나타나면 Adapter 경계가 새고 있는 것이다.
- Why: 세 플랫폼의 Accepted 전이 판정은 파라미터가 아니라 방식으로 다르다. LeetCode·SWEA는 mutation 기반 무상태, Programmers는 presentation 상태기계다. 분기로 흡수하려 하면 한쪽이 조용히 틀린다.

## Dependencies
- imports: `src/shared`
- imported by: manifest content entry; `src/background`와는 runtime message로 통신. `e2e/`가 LeetCode Adapter helper와 SWEA bridge protocol 값을 test 전용으로 직접 import한다.
- 계약 문서: [ARCHITECTURE](../ARCHITECTURE.md), [Coding Platform 공통 계약](../platforms/README.md), [UI Guide](../UI_GUIDE.md)
