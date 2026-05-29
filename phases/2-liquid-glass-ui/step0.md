# Step 0: i18n-storage-foundation

## 읽을 파일

먼저 아래 파일을 읽고 product, architecture, UI intent를 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/UI_GUIDE.md`
- `src/shared/storageSchema.ts`
- `src/shared/storageSchema.test.ts`
- `src/shared/messages.ts`
- `src/shared/index.ts`
- `src/background/storage.ts`
- `src/background/runtime.ts`

수정하기 전에 기존 storage migration과 public settings 흐름을 주의 깊게 읽는다.

## 작업

UI 언어 설정의 shared foundation을 만든다.

- `src/shared/i18n.ts`를 추가한다.
  - Export type `UiLanguagePreference = "system" | "en" | "ko"`.
  - Export type `UiLocale = "en" | "ko"`.
  - Export constant `DEFAULT_UI_LANGUAGE: UiLanguagePreference = "system"`.
  - Export function `isUiLanguagePreference(value: unknown): value is UiLanguagePreference`.
  - Export function `resolveUiLocale(preference: UiLanguagePreference, browserLanguage: string | null | undefined): UiLocale`.
  - Export function `t(locale: UiLocale, key: I18nKey, params?: Record<string, string | number>): string`.
  - Define `I18nKey` from the translation dictionary keys, not as a loose `string`.
  - Include only foundational/common strings in this step: language labels, common actions, common status labels, and generic validation strings needed by existing tests.
- `src/shared/index.ts`에서 i18n exports를 공개한다.
- `src/shared/storageSchema.ts`를 update한다.
  - `SettingsState`에 `uiLanguage: UiLanguagePreference`를 추가한다.
  - `PublicSettingsState`와 `PublicSettingsUpdate`에 `uiLanguage`가 포함되게 한다.
  - `DEFAULT_SETTINGS_STATE.uiLanguage`는 `"system"`으로 둔다.
  - storage schema version을 1 증가시킨다.
  - legacy settings migration은 version 1과 이전 current version 모두에 대해 missing `uiLanguage`를 `"system"`으로 보정한다.
  - malformed `uiLanguage`는 parse 실패로 처리하지 말고 `"system"`으로 normalize한다. 이유: 기존 사용자의 settings를 삭제하지 않기 위함이다.
- `src/shared/storageSchema.test.ts`를 update한다.
  - public settings에 `uiLanguage`가 포함되는지 검증한다.
  - legacy settings가 `uiLanguage: "system"`으로 migrate되는지 검증한다.
  - invalid language preference가 `"system"`으로 normalize되는지 검증한다.
- `src/shared/i18n.test.ts`를 추가한다.
  - `system + ko-KR -> ko`, `system + en-US -> en`, 명시적 `ko/en` 우선순위, unknown browser language fallback을 검증한다.
  - interpolation이 동작하고 missing param이 unsafe하게 throw하지 않는지 검증한다.

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
3. 이 step에 대해 `phases/2-liquid-glass-ui/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Added i18n foundation and persisted uiLanguage in settings storage."`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- PAT, cookie, session token, 실제 사용자 secret을 fixture나 문서 예시에 넣지 말 것. 이유: AGENTS.md CRITICAL 보안 규칙 위반이다.
- Options, Popup, Toast를 이 step에서 리디자인하지 말 것. 이유: 이 step은 shared storage/i18n foundation만 다룬다.
- 기존 storage key를 삭제하거나 기존 settings를 임의 초기화하지 말 것. 이유: 사용자 설정을 보존해야 한다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
