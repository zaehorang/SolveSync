export type UiLanguagePreference = "system" | "en" | "ko";
export type UiLocale = "en" | "ko";

export const DEFAULT_UI_LANGUAGE: UiLanguagePreference = "system";

const EN_TRANSLATIONS = {
  "language.system": "System",
  "language.en": "English",
  "language.ko": "한국어",
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.dismiss": "Dismiss",
  "action.retry": "Retry",
  "action.openOptions": "Open Options",
  "action.details": "Details",
  "action.hideDetails": "Hide details",
  "action.loadRepositories": "Load repositories",
  "action.createBranch": "Create branch",
  "action.testConnection": "Test connection",
  "action.commit": "Commit",
  "action.file": "File",
  "status.notTested": "Not tested",
  "status.testing": "Testing",
  "status.connected": "Connected",
  "status.noOwnedRepositories": "No owned repositories",
  "status.repositoryNotFound": "Repository not found",
  "status.branchNotFound": "Branch not found",
  "status.branchCreated": "Branch created",
  "status.branchCreateFailed": "Branch create failed",
  "status.authFailed": "Auth failed",
  "status.tokenExpired": "Token expired",
  "status.rateLimited": "Rate limited",
  "status.networkFailed": "Network failed",
  "status.loadingSettings": "Loading settings",
  "status.connectionNotTested": "Connection not tested",
  "status.readyToSync": "Ready to sync",
  "status.setupRequired": "Setup required",
  "status.githubConnectionRequired": "GitHub connection required",
  "status.repositoryRequired": "Repository required",
  "status.branchRequired": "Branch required",
  "status.autoSyncOff": "Auto Sync off",
  "status.syncing": "Syncing",
  "status.retrying": "Retrying",
  "status.synced": "Synced",
  "status.failed": "Failed",
  "status.unsupportedLanguage": "Unsupported language",
  "toast.autoSyncOffTitle": "Auto Sync is off",
  "toast.syncingTitle": "Syncing to GitHub...",
  "toast.retryingTitle": "Retrying sync...",
  "toast.syncedTitle": "Synced to GitHub",
  "toast.failedTitle": "Sync failed",
  "detail.loadingSettings": "Reading popup state from the background service worker.",
  "detail.githubConnectionRequired": "Open Options and save a fine-grained PAT.",
  "detail.repositoryRequired": "Open Options and choose an owned repository.",
  "detail.branchRequired": "Open Options and choose an existing branch.",
  "detail.autoSyncOffConfigured": "Configured for {target}. Accepted submissions will not create commits.",
  "detail.connectionNotTested": "{target}. Run a connection test in Options.",
  "detail.connectionCheckSaved": "Open Options to check the saved GitHub connection.",
  "detail.noOwnedRepositories": "Check that the token includes a repository owned by your account.",
  "detail.toastSetupRequired": "Connect a repository in Options.",
  "detail.toastAutoSyncOff": "No commit was created.",
  "detail.toastFailureFallback": "Open Options to check your GitHub connection.",
  "detail.unsupportedLanguageNamed": "{language} submissions are not synced.",
  "detail.unsupportedLanguageDefault": "Only Swift and Python3 submissions are synced.",
  "detail.unsupportedNoCommit": "No commit was created. Swift and Python3 are supported.",
  "detail.noCommitPayloadRetryUnavailable": "Retry is unavailable because no commit payload was created.",
  "detail.retryPayloadUnavailable": "Retry payload is unavailable. Check Options or submit again.",
  "detail.recordInLanguage": "{title} in {language}",
  "history.empty": "Accepted submissions will appear here after sync runs.",
  "label.unknownLanguage": "Unknown language",
  "label.platformSubmission": "{platform} submission",
  "failure.code": "Code: {code}",
  "failure.detail": "Detail: {detail}",
  "validation.required": "{field} is required.",
  "validation.githubPatRequired": "GitHub PAT is required.",
  "validation.repositoryRequired": "Choose a repository from the owned repository list.",
  "validation.branchRequired": "Choose an existing branch or create one first."
} as const;

export type I18nKey = keyof typeof EN_TRANSLATIONS;

const KO_TRANSLATIONS = {
  "language.system": "System",
  "language.en": "English",
  "language.ko": "한국어",
  "action.save": "저장",
  "action.cancel": "취소",
  "action.dismiss": "닫기",
  "action.retry": "재시도",
  "action.openOptions": "Options 열기",
  "action.details": "상세",
  "action.hideDetails": "상세 숨기기",
  "action.loadRepositories": "저장소 불러오기",
  "action.createBranch": "Branch 만들기",
  "action.testConnection": "연결 테스트",
  "action.commit": "Commit",
  "action.file": "File",
  "status.notTested": "테스트 안 됨",
  "status.testing": "테스트 중",
  "status.connected": "연결됨",
  "status.noOwnedRepositories": "본인 저장소 없음",
  "status.repositoryNotFound": "저장소를 찾을 수 없음",
  "status.branchNotFound": "Branch를 찾을 수 없음",
  "status.branchCreated": "Branch 생성됨",
  "status.branchCreateFailed": "Branch 생성 실패",
  "status.authFailed": "인증 실패",
  "status.tokenExpired": "Token 만료",
  "status.rateLimited": "Rate limit 초과",
  "status.networkFailed": "네트워크 실패",
  "status.loadingSettings": "설정을 읽는 중",
  "status.connectionNotTested": "연결 테스트 안 됨",
  "status.readyToSync": "Sync 준비됨",
  "status.setupRequired": "설정 필요",
  "status.githubConnectionRequired": "GitHub 연결 필요",
  "status.repositoryRequired": "저장소 필요",
  "status.branchRequired": "Branch 필요",
  "status.autoSyncOff": "Auto Sync 꺼짐",
  "status.syncing": "Sync 중",
  "status.retrying": "재시도 중",
  "status.synced": "동기화됨",
  "status.failed": "실패",
  "status.unsupportedLanguage": "미지원 언어",
  "toast.autoSyncOffTitle": "Auto Sync 꺼짐",
  "toast.syncingTitle": "GitHub에 Sync 중...",
  "toast.retryingTitle": "Sync 재시도 중...",
  "toast.syncedTitle": "GitHub에 동기화됨",
  "toast.failedTitle": "Sync 실패",
  "detail.loadingSettings": "background service worker에서 Popup 상태를 읽고 있습니다.",
  "detail.githubConnectionRequired": "Options에서 fine-grained PAT를 저장하세요.",
  "detail.repositoryRequired": "Options에서 본인 저장소를 선택하세요.",
  "detail.branchRequired": "Options에서 기존 branch를 선택하세요.",
  "detail.autoSyncOffConfigured": "{target}에 설정되어 있습니다. Accepted 제출은 commit을 만들지 않습니다.",
  "detail.connectionNotTested": "{target}. Options에서 연결 테스트를 실행하세요.",
  "detail.connectionCheckSaved": "Options에서 저장된 GitHub 연결을 확인하세요.",
  "detail.noOwnedRepositories": "Token에 본인 소유 저장소가 포함되어 있는지 확인하세요.",
  "detail.toastSetupRequired": "Options에서 저장소를 연결하세요.",
  "detail.toastAutoSyncOff": "Commit이 생성되지 않았습니다.",
  "detail.toastFailureFallback": "Options에서 GitHub 연결을 확인하세요.",
  "detail.unsupportedLanguageNamed": "{language} 제출은 sync하지 않습니다.",
  "detail.unsupportedLanguageDefault": "Swift와 Python3 제출만 sync합니다.",
  "detail.unsupportedNoCommit": "Commit이 생성되지 않았습니다. Swift와 Python3만 지원합니다.",
  "detail.noCommitPayloadRetryUnavailable": "Commit payload가 생성되지 않아 재시도할 수 없습니다.",
  "detail.retryPayloadUnavailable": "Retry payload가 없습니다. Options를 확인하거나 다시 제출하세요.",
  "detail.recordInLanguage": "{title}, {language}",
  "history.empty": "Accepted 제출이 sync되면 여기에 표시됩니다.",
  "label.unknownLanguage": "알 수 없는 언어",
  "label.platformSubmission": "{platform} 제출",
  "failure.code": "Code: {code}",
  "failure.detail": "Detail: {detail}",
  "validation.required": "{field}은(는) 필수입니다.",
  "validation.githubPatRequired": "GitHub PAT가 필요합니다.",
  "validation.repositoryRequired": "본인 저장소 목록에서 저장소를 선택하세요.",
  "validation.branchRequired": "기존 branch를 선택하거나 먼저 생성하세요."
} as const satisfies Record<I18nKey, string>;

const TRANSLATIONS = {
  en: EN_TRANSLATIONS,
  ko: KO_TRANSLATIONS
} as const satisfies Record<UiLocale, Record<I18nKey, string>>;

export function isUiLanguagePreference(
  value: unknown
): value is UiLanguagePreference {
  return value === "system" || value === "en" || value === "ko";
}

export function resolveUiLocale(
  preference: UiLanguagePreference,
  browserLanguage: string | null | undefined
): UiLocale {
  if (preference === "en" || preference === "ko") {
    return preference;
  }

  const normalizedBrowserLanguage = browserLanguage?.trim().toLowerCase();

  return normalizedBrowserLanguage === "ko" ||
    normalizedBrowserLanguage?.startsWith("ko-") === true
    ? "ko"
    : "en";
}

export function t(
  locale: UiLocale,
  key: I18nKey,
  params: Record<string, string | number> = {}
): string {
  return TRANSLATIONS[locale][key].replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, name) => {
    const value = params[name];

    return value === undefined ? match : String(value);
  });
}
