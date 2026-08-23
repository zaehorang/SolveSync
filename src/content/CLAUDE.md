# src/content

Coding Platform 문제 page를 관찰해 Accepted event와 사용자 toast feedback을 만드는 module이다.

## Owns
- route lifecycle, DOM 관찰과 fresh Accepted transition 감지
- Accepted 직후 Editor Snapshot과 immutable Accepted event 생성
- SWEA MAIN world editor bridge와 code 응답 protocol
- background messaging과 문제 page toast

## Common changes
- 플랫폼 감지 변경 → [`detector.ts`](detector.ts), [`acceptedDetectionController.ts`](acceptedDetectionController.ts)와 해당 플랫폼 문서를 함께 갱신한다.
- SWEA editor source 변경 → [`sweaEditorBridge.ts`](sweaEditorBridge.ts), [`sweaBridgeProtocol.ts`](sweaBridgeProtocol.ts)과 bridge test를 확인한다.
- toast 변경 → [`toast.ts`](toast.ts)를 수정하고 UI locale과 action별 model test를 갱신한다.

```bash
npx vitest run src/content
npm run build
```

## Non-obvious
- 주의: `content_scripts`는 classic script다. content entry와 SWEA bridge build 결과에 static ESM `import`가 남으면 안 된다.
- 주의: SWEA bridge protocol에는 code string만 넣고 문제 metadata나 auth 정보를 넘기지 않는다.
- Why: isolated world에서는 SWEA editor state를 읽을 수 없어 최소한의 MAIN world bridge만 사용한다.

## Dependencies
- imports: `src/shared`
- imported by: manifest content entry; `src/background`와는 runtime message로 통신
- 계약 문서: [ARCHITECTURE](../../docs/ARCHITECTURE.md), [Coding Platform 공통 계약](../../docs/platforms/README.md), [UI Guide](../../docs/UI_GUIDE.md)
