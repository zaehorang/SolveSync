# Step 0: docs-scope-lock

## 읽을 파일

먼저 아래 파일을 읽고 이번 phase가 기존 제품 범위와 설계 결정 안에 머무르는지 확인한다:

- `AGENTS.md`
- `CONTEXT.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/MANUAL_VALIDATION.md`
- `docs/adr/0020-user-selected-sync-repository-and-branch.md`
- `docs/adr/0023-separate-iife-content-script-bundle.md`
- `docs/adr/0026-domain-naming-v4-storage-runtime-and-catalog-migration.md`
- `docs/adr/0027-solution-revision-numbered-commit-message.md`

## 작업

이번 UI/runtime polish의 문서 scope를 잠근다.

- `docs/ARCHITECTURE.md`의 Error Model에 `extension_state_unavailable`이 포함되어 있는지 확인한다.
- `docs/UI_GUIDE.md`에 아래 UI 계약이 있는지 확인한다.
  - Solution Revision Number는 commit message와 Solution Catalog 추적 정보이며 Popup, Toast, Options, Solution README에는 표시하지 않는다.
  - Sync Repository picker의 empty/loading/no-match 상태는 선택된 repository처럼 보이면 안 되며 실제 repository option과 시각적으로 구분한다.
- `docs/MANUAL_VALIDATION.md`에 Popup, toast, Options, Solution README에서 Solution Revision Number가 별도 badge나 metadata로 보이지 않는지 확인하는 체크가 있는지 확인한다.
- 누락된 문서 항목이 있으면 위 세 파일 안에서만 짧게 보강한다.
- 새 ADR은 만들지 않는다. 이번 작업은 기존 UI/error handling 계약 구현이며 제품 scope 변경이 아니다.
- `CONTEXT.md`는 수정하지 않는다. 새 domain term을 도입하지 않는다.

## 인수 기준

```bash
npm test -- --run src/shared/errorNormalize.test.ts src/shared/errors.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 작업이 `ARCHITECTURE.md`의 Error Model과 UI surface 책임을 따르는가?
   - `docs/adr/0027-solution-revision-numbered-commit-message.md`의 UI 비노출 결정을 훼손하지 않는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/10-ui-state-runtime-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Locked UI/runtime polish docs around extension state errors, repository picker states, and Solution Revision Number non-display"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- 새 ADR을 만들지 말 것. 이유: 이번 작업은 기존 결정 구현이며 새로운 architecture decision이 아니다.
- `CONTEXT.md`를 수정하지 말 것. 이유: 새 domain term을 도입하지 않는다.
- Popup, Toast, Options, Solution README에 Solution Revision Number 표시를 추가하지 말 것. 이유: ADR 0027과 UI Guide가 비노출을 요구한다.
- README를 수정하지 말 것. 이유: 사용자가 명시적으로 요청하지 않았다.
- 기존 test를 깨뜨리지 말 것.
