# src/options

GitHub 연결과 Sync Repository·Sync Branch 설정을 관리하는 Options page module이다.

## Owns
- GitHub App Device Flow, 설치 안내와 연결 해제 UI
- Sync Repository·Sync Branch 조회, 선택과 명시적 branch 생성 action
- Auto Sync 설정과 connection test
- 설정 disclosure, locale과 view model

## Common changes
- GitHub 연결 흐름 변경 → [`index.ts`](index.ts)와 [`viewModels.ts`](viewModels.ts)를 함께 수정하고 auth 상태별 UI test를 갱신한다.
- repository·branch 선택 변경 → runtime message 계약과 empty/loading/error 상태를 함께 검증한다.
- 문구·layout 변경 → [`styles.css`](styles.css)와 `docs/UI_GUIDE.md`의 locale·접근성 규칙을 확인한다.

```bash
npx vitest run src/options
```

## Non-obvious
- 주의: Sync Branch는 자동 생성하지 않는다. 사용자의 명시적 create action이 있을 때만 default branch HEAD에서 만든다.
- 주의: connection test는 test commit이나 branch update를 수행하지 않는다.
- Why: repository write와 credential storage disclosure는 사용자가 action 전에 이해할 수 있어야 한다.

## Dependencies
- imports: `src/shared`
- imported by: extension Options entry; `src/background`는 runtime message 요청을 처리
- 계약 문서: [ARCHITECTURE](../../docs/ARCHITECTURE.md), [UI Guide](../../docs/UI_GUIDE.md), [PRD](../../docs/PRD.md)
