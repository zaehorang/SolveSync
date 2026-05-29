# Step 1: shared-ui-models

## 읽을 파일

먼저 아래 파일을 읽고 UI state와 status label 흐름을 이해한다:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/UI_GUIDE.md`
- `src/shared/i18n.ts`
- `src/shared/storageSchema.ts`
- `src/options/index.ts`
- `src/options/options.test.ts`
- `src/popup/index.ts`
- `src/popup/popup.test.ts`
- `src/content/toast.ts`
- `src/content/toast.test.ts`
- `phases/2-liquid-glass-ui/index.json`

수정하기 전에 Step 0에서 추가된 i18n API와 test summary를 확인한다.

## 작업

Options, Popup, Toast가 공유할 locale-aware UI model layer를 만든다.

- `src/shared/uiModels.ts`를 추가한다.
  - Export type `Tone = "neutral" | "success" | "warning" | "error"`.
  - Export interfaces:
    - `ConnectionStatusView { label: string; detail: string | null; tone: Tone }`
    - `SetupStatusView { label: string; detail: string; tone: Tone }`
    - `FailureDetailView { summary: string; detailLines: string[] }`
    - `ToastViewModel { title: string; detail: string | null; tone: Tone; actions: ToastActionView[]; autoDismissMs: number | null }`
  - Export functions:
    - `getConnectionStatusView(locale: UiLocale, status: ConnectionStatus | ConnectionStatusCode, error?: NormalizedError | null): ConnectionStatusView`
    - `getSetupStatusView(locale: UiLocale, settings: PublicSettingsState | null): SetupStatusView`
    - `getFailureDetailView(locale: UiLocale, record: SyncRecord): FailureDetailView | null`
    - `getSyncStatusLabel(locale: UiLocale, status: SyncStatus): string`
    - `getSyncStatusTone(status: SyncStatus): Tone`
    - `createToastViewModel(locale: UiLocale, input: ToastModelInput): ToastViewModel`
- Move duplicated status label logic out of Options/Popup/Toast where practical, but keep DOM rendering inside each surface.
- Keep platform and language labels stable:
  - `LeetCode`, `Programmers`, `Swift`, `Python3` remain as product/platform names.
  - Unknown language labels must be localized.
- Add `src/shared/uiModels.test.ts`.
  - Verify English and Korean labels for connection status, setup status, sync status, failure detail, and toast actions.
  - Verify retry action appears only when model input says retry is available.
- Update existing Options/Popup/Toast tests only as needed to use shared models or expected localized labels.

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
   - `ADR.md`의 Vanilla DOM UI decision 안에 머무르는가?
   - `AGENTS.md`의 CRITICAL rule을 위반하지 않는가?
3. 이 step에 대해 `phases/2-liquid-glass-ui/index.json`을 업데이트한다:
   - 성공: `"status": "completed"`로 설정하고 `"summary": "Added shared locale-aware UI models for status, failure, and toast rendering."`를 추가한다.
   - 3회 수정 시도 후에도 실패: `"status": "error"`로 설정하고 `"error_message": "specific error"`를 추가한다.
   - 사용자 입력 필요: `"status": "blocked"`로 설정하고 `"blocked_reason": "specific reason"`을 추가한 뒤 중단한다.

## 하지 말 것

- DOM rendering을 `src/shared`로 옮기지 말 것. 이유: shared는 순수 model과 타입만 담당해야 한다.
- GitHub, LeetCode, Programmers API client를 수정하지 말 것. 이유: UI model 작업과 API 경계는 분리되어야 한다.
- content script에 static ESM import가 남는 build 구조를 만들지 말 것. 이유: manifest content script는 classic script다.
- 하위 agent가 git commit을 만들지 말 것. 이유: `scripts/execute.py`가 step commit을 관리한다.
- 기존 test를 깨뜨리지 말 것.
