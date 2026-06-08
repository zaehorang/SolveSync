# Step 1: shared-error-model

## 읽을 파일

먼저 아래 파일을 읽고 shared error model과 이전 step의 문서 계약을 이해한다:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_GUIDE.md`
- `docs/adr/0018-typed-runtime-message-union.md`
- `phases/10-ui-state-runtime-polish/index.json`
- `src/shared/errors.ts`
- `src/shared/errorNormalize.ts`
- `src/shared/errors.test.ts`
- `src/shared/errorNormalize.test.ts`
- `src/shared/i18n.ts`

수정하기 전에 Step 0 summary와 문서 변경 여부를 확인한다.

## 작업

extension-local state failure를 normalized error model에 추가한다.

- `src/shared/errors.ts`
  - `NORMALIZED_ERROR_CODES`에 `extension_state_unavailable`을 추가한다.
  - `NormalizedErrorCode`와 `isNormalizedErrorCode`가 새 code를 자연스럽게 포함하게 한다.
- `src/shared/errorNormalize.ts`
  - descriptor를 추가한다.
  - English user message: `Could not read extension settings. Reload the extension or reopen Options.`
  - `retryable: false`
  - global `normalizeError()` fallback은 계속 `github_commit_failed`여야 한다.
  - extension-local failure만 명시적으로 `extension_state_unavailable`이 되도록 helper를 추가하거나 기존 `normalizeError({ code })` 입력 경로를 명확히 사용 가능하게 한다.
- `src/shared/errors.test.ts`, `src/shared/errorNormalize.test.ts`
  - 새 code가 목록과 descriptor에 포함되는지 검증한다.
  - unknown generic error가 여전히 `github_commit_failed`로 fallback되는지 검증한다.

## 인수 기준

```bash
npm test -- --run src/shared/errors.test.ts src/shared/errorNormalize.test.ts
```

## 검증

1. 인수 기준 command를 실행한다.
2. Architecture checklist를 확인한다:
   - 외부 API error normalize 규칙을 shared layer 안에 유지했는가?
   - `normalizeError()`의 unknown fallback을 바꾸지 않았는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/10-ui-state-runtime-polish/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Added extension_state_unavailable to shared normalized errors without changing github_commit_failed fallback"`를 추가한다.
   - 현재 runner attempt에서 AC를 통과하지 못함: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- `normalizeError()`의 unknown fallback을 `extension_state_unavailable`로 바꾸지 말 것. 이유: unknown GitHub/API failures는 기존 sync failure 의미를 유지해야 한다.
- UI component 안에 새 error string을 hard-code하지 말 것. 이유: 사용자-visible copy는 shared/i18n/error descriptor 경로를 따라야 한다.
- Retry 가능한 sync failure를 non-retryable extension state failure로 재분류하지 말 것. 이유: Retry Bundle 정책과 Popup retry 동작이 달라진다.
- 기존 test를 깨뜨리지 말 것.
