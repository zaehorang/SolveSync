# src/popup

현재 sync 상태와 최근 결과, retry action을 짧게 보여주는 Popup module이다.

## Owns
- Auto Sync toggle과 설정 미완료 시 Options 이동
- 최근 Sync History의 성공 link, 실패 summary와 technical detail
- retry 가능한 실패의 Retry Bundle 표시와 retry action

## Common changes
- Sync History 표시 변경 → [`index.ts`](index.ts)와 [`index.test.ts`](index.test.ts)의 success/failure fixture를 함께 갱신한다.
- retry UI 변경 → Retry Bundle summary runtime message와 만료·누락 상태를 검증한다.
- 문구·layout 변경 → [`styles.css`](styles.css)와 `docs/UI_GUIDE.md`의 Popup 규칙을 확인한다.

```bash
npx vitest run src/popup
```

## Non-obvious
- 주의: Retry Bundle에는 solution code가 임시 저장될 수 있다. disclosure와 TTL/cap 문구를 지운 채 UI를 바꾸지 않는다.
- 주의: technical detail은 기본으로 접어 두고 summary와 다음 action을 먼저 보여준다.
- Why: Popup은 짧게 열리는 UI이므로 storage의 전체 Retry Bundle 대신 필요한 summary만 요청한다.

## Dependencies
- imports: `src/shared`
- imported by: extension Popup entry; `src/background`는 runtime message 요청과 상태 broadcast를 담당
- 계약 문서: [ARCHITECTURE](../../docs/ARCHITECTURE.md), [UI Guide](../../docs/UI_GUIDE.md), [PRD](../../docs/PRD.md)
