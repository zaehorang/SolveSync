# src/options

GitHub 연결과 Sync Repository·Sync Branch 설정을 관리하는 Options page module이다.

Entrypoint: `vite.config.ts`의 `options` input은 [`index.html`](../../src/options/index.html)이고, 그 page가 [`index.ts`](../../src/options/index.ts)를 로드한다. `manifest.json`의 options page다.

## Owns
- GitHub App Device Flow, 설치 안내와 연결 해제 UI
- Sync Repository·Sync Branch 조회, 선택과 명시적 branch 생성 action
- Auto Sync 설정과 connection test
- 사용자가 명시적으로 실행하는 저장소 파일 정리(Solution README projection) action과 결과 표시
- 설정 disclosure, locale과 view model

## Common changes
- GitHub 연결 흐름 변경 → [`index.ts`](../../src/options/index.ts)와 [`viewModels.ts`](../../src/options/viewModels.ts)를 함께 수정하고 auth 상태별 UI test를 갱신한다.
- repository·branch 선택 변경 → runtime message 계약과 empty/loading/error 상태를 함께 검증한다.
- 문구·layout 변경 → [`styles.css`](../../src/options/styles.css)와 `docs/UI_GUIDE.md`의 locale·접근성 규칙을 확인한다.

```bash
npx vitest run src/options
```

## Non-obvious
- 주의: Sync Branch 자동 생성 금지는 [ARCHITECTURE](../ARCHITECTURE.md)가 정한다. 이 module은 명시적 create action의 확인 UI와 상태 처리만 맡고, create 요청은 사용자 click 없이 보내지 않는다.
- 주의: connection test는 test commit이나 branch update를 수행하지 않는다.
- Why: repository write와 credential storage disclosure는 사용자가 action 전에 이해할 수 있어야 한다.

## Dependencies
- imports: `src/shared`
- imported by: extension Options entry; `src/background`는 runtime message 요청을 처리
- 계약 문서: [ARCHITECTURE](../ARCHITECTURE.md), [UI Guide](../UI_GUIDE.md), [PRD](../PRD.md)
