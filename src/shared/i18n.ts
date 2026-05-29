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
  "status.readyToSync": "Ready to sync",
  "status.githubConnectionRequired": "GitHub connection required",
  "status.repositoryRequired": "Repository required",
  "status.branchRequired": "Branch required",
  "status.autoSyncOff": "Auto Sync off",
  "status.syncing": "Syncing",
  "status.retrying": "Retrying",
  "status.synced": "Synced",
  "status.failed": "Failed",
  "status.unsupportedLanguage": "Unsupported language",
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
  "status.readyToSync": "Sync 준비됨",
  "status.githubConnectionRequired": "GitHub 연결 필요",
  "status.repositoryRequired": "저장소 필요",
  "status.branchRequired": "Branch 필요",
  "status.autoSyncOff": "Auto Sync 꺼짐",
  "status.syncing": "Sync 중",
  "status.retrying": "재시도 중",
  "status.synced": "Synced",
  "status.failed": "Failed",
  "status.unsupportedLanguage": "미지원 언어",
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
