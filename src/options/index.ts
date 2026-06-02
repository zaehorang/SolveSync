import {
  APP_NAME,
  DEFAULT_SETTINGS_STATE,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  getConnectionStatusView as getSharedConnectionStatusView,
  isUiLanguagePreference,
  normalizeError,
  parseSettingsState,
  resolveUiLocale,
  t,
  type ConnectionStatus,
  type ConnectionStatusCode,
  type ConnectionStatusView,
  type I18nKey,
  type IsoDateString,
  type NormalizedError,
  type NormalizedErrorCode,
  type RuntimeMessage,
  type SettingsState,
  type SyncBranch,
  type SyncRepository,
  type Tone,
  type UiLanguagePreference,
  type UiLocale
} from "../shared";

export interface RepositoryFilterState {
  query: string;
  repositories: SyncRepository[];
  visibleRepositories: SyncRepository[];
  hasMatches: boolean;
}

export interface SettingsValidationDraft {
  githubPat: string;
  syncRepository: SyncRepository | null;
  syncBranch: SyncBranch | null;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: {
    githubPat?: string;
    repository?: string;
    branch?: string;
  };
}

interface InlineMessage {
  text: string;
  tone: Tone;
  i18nKey?: I18nKey;
  i18nParams?: Record<string, string | number>;
}

interface RepositoryListResult {
  repositories: SyncRepository[];
  page: number;
  perPage: number;
  totalCount: number;
  hasMore: boolean;
}

interface ConnectionTestResult {
  repository: SyncRepository;
  branch: SyncBranch;
  baseCommitSha: string;
  baseTreeSha: string;
}

interface RuntimeSuccessResponse<T> {
  ok: true;
  data: T;
}

interface RuntimeFailureResponse {
  ok: false;
  error: NormalizedError;
}

type RuntimeResponse<T> = RuntimeSuccessResponse<T> | RuntimeFailureResponse;

interface OptionsRuntimeState {
  githubPatInput: string;
  patVisible: boolean;
  repositories: SyncRepository[];
  repositoryQuery: string;
  syncRepository: SyncRepository | null;
  branches: SyncBranch[];
  syncBranch: SyncBranch | null;
  autoSyncEnabled: boolean;
  uiLanguage: UiLanguagePreference;
  locale: UiLocale;
  connectionStatus: ConnectionStatus;
  loadingSettings: boolean;
  loadingRepositories: boolean;
  loadingBranches: boolean;
  creatingBranch: boolean;
  testingConnection: boolean;
  savingSettings: boolean;
  patMessage: InlineMessage;
  repositoryMessage: InlineMessage;
  branchMessage: InlineMessage;
  createBranchMessage: InlineMessage;
  saveMessage: InlineMessage;
}

interface OptionsElements {
  form: HTMLFormElement;
  status: HTMLParagraphElement;
  patInput: HTMLInputElement;
  togglePatButton: HTMLButtonElement;
  patError: HTMLParagraphElement;
  loadRepositoriesButton: HTMLButtonElement;
  repositorySearchInput: HTMLInputElement;
  repositorySelect: HTMLSelectElement;
  repositoryStatus: HTMLParagraphElement;
  branchSelect: HTMLSelectElement;
  branchStatus: HTMLParagraphElement;
  createBranchInput: HTMLInputElement;
  createBranchButton: HTMLButtonElement;
  createBranchStatus: HTMLParagraphElement;
  autoSyncCheckbox: HTMLInputElement;
  languageButtons: HTMLButtonElement[];
  testConnectionButton: HTMLButtonElement;
  connectionStatusBox: HTMLDivElement;
  saveButton: HTMLButtonElement;
  saveStatus: HTMLParagraphElement;
}

const EMPTY_MESSAGE: InlineMessage = {
  text: "",
  tone: "neutral"
};

const DEFAULT_CONNECTION_STATUS: ConnectionStatus = {
  code: "not_tested",
  checkedAt: null,
  error: null
};

function localizedMessage(
  i18nKey: I18nKey,
  tone: Tone,
  i18nParams: Record<string, string | number> = {}
): InlineMessage {
  return {
    text: "",
    tone,
    i18nKey,
    i18nParams
  };
}

export function getRepositoryFilterState(
  repositories: SyncRepository[],
  query: string
): RepositoryFilterState {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRepositories =
    normalizedQuery.length === 0
      ? repositories
      : repositories.filter((repository) =>
          repository.fullName.toLowerCase().includes(normalizedQuery)
        );

  return {
    query,
    repositories,
    visibleRepositories,
    hasMatches: visibleRepositories.length > 0
  };
}

export function getDefaultBranchSelection(
  repository: SyncRepository | null,
  branches: SyncBranch[],
  preferredBranchName: string | null
): string | null {
  if (branches.length === 0) {
    return null;
  }

  if (
    preferredBranchName !== null &&
    branches.some((branch) => branch.name === preferredBranchName)
  ) {
    return preferredBranchName;
  }

  if (
    repository !== null &&
    branches.some((branch) => branch.name === repository.defaultBranch)
  ) {
    return repository.defaultBranch;
  }

  return branches[0]?.name ?? null;
}

export function validateSettingsDraft(
  draft: SettingsValidationDraft,
  locale: UiLocale = "en"
): SettingsValidationResult {
  const errors: SettingsValidationResult["errors"] = {};

  if (draft.githubPat.trim().length === 0) {
    errors.githubPat = t(locale, "validation.githubPatRequired");
  }

  if (draft.syncRepository === null) {
    errors.repository = t(locale, "validation.repositoryRequired");
  }

  if (draft.syncBranch === null) {
    errors.branch = t(locale, "validation.branchRequired");
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function mapConnectionErrorCode(
  code: NormalizedErrorCode
): ConnectionStatusCode {
  switch (code) {
    case "github_no_accessible_repos":
      return "no_accessible_repositories";
    case "github_repo_not_found":
      return "repository_not_found";
    case "github_branch_not_found":
    case "github_default_branch_unavailable":
      return "branch_not_found";
    case "github_branch_create_failed":
    case "github_branch_protected":
    case "github_commit_failed":
    case "github_conflict_failed":
      return "branch_create_failed";
    case "github_auth_failed":
      return "auth_failed";
    case "github_token_expired":
      return "token_expired";
    case "github_rate_limited":
      return "rate_limited";
    case "network_failed":
      return "network_failed";
    case "setup_required":
    case "auto_sync_disabled":
    case "unsupported_language":
    case "leetcode_auth_required":
    case "leetcode_fetch_failed":
    case "programmers_extract_failed":
    case "malformed_index":
      return "branch_create_failed";
  }
}

export function getConnectionStatusView(
  status: ConnectionStatus | ConnectionStatusCode,
  error: NormalizedError | null = null,
  locale: UiLocale = "en"
): ConnectionStatusView {
  return getSharedConnectionStatusView(locale, status, error);
}

function createInitialState(): OptionsRuntimeState {
  return {
    githubPatInput: "",
    patVisible: false,
    repositories: [],
    repositoryQuery: "",
    syncRepository: null,
    branches: [],
    syncBranch: null,
    autoSyncEnabled: false,
    uiLanguage: DEFAULT_SETTINGS_STATE.uiLanguage,
    locale: getOptionsLocale(DEFAULT_SETTINGS_STATE.uiLanguage),
    connectionStatus: DEFAULT_CONNECTION_STATUS,
    loadingSettings: true,
    loadingRepositories: false,
    loadingBranches: false,
    creatingBranch: false,
    testingConnection: false,
    savingSettings: false,
    patMessage: EMPTY_MESSAGE,
    repositoryMessage: EMPTY_MESSAGE,
    branchMessage: EMPTY_MESSAGE,
    createBranchMessage: EMPTY_MESSAGE,
    saveMessage: EMPTY_MESSAGE
  };
}

async function initOptionsPage(): Promise<void> {
  const elements = collectElements();
  const state = createInitialState();

  elements.status.dataset.app = APP_NAME;
  bindEvents(elements, state);
  render(elements, state);

  try {
    const settings = await readSettings();
    applySettingsToState(state, settings);
    state.loadingSettings = false;
    state.saveMessage = EMPTY_MESSAGE;
    render(elements, state);

    if (settings.githubPat !== null && settings.syncRepository !== null) {
      void loadBranches(elements, state, settings.syncRepository);
    }
  } catch (error) {
    state.loadingSettings = false;
    state.saveMessage = {
      text: normalizeError(error).userMessage,
      tone: "error"
    };
    render(elements, state);
  }
}

function bindEvents(elements: OptionsElements, state: OptionsRuntimeState): void {
  elements.togglePatButton.addEventListener("click", () => {
    state.patVisible = !state.patVisible;
    render(elements, state);
  });

  elements.patInput.addEventListener("input", () => {
    state.githubPatInput = elements.patInput.value;
    state.patMessage = EMPTY_MESSAGE;
    render(elements, state);
  });

  elements.repositorySearchInput.addEventListener("input", () => {
    state.repositoryQuery = elements.repositorySearchInput.value;
    render(elements, state);
  });

  elements.loadRepositoriesButton.addEventListener("click", () => {
    void loadRepositories(elements, state);
  });

  elements.repositorySelect.addEventListener("change", () => {
    const selected = state.repositories.find(
      (repository) => repository.fullName === elements.repositorySelect.value
    );
    state.syncRepository = selected ?? null;
    state.branches = [];
    state.syncBranch = null;
    state.branchMessage = EMPTY_MESSAGE;
    state.createBranchMessage = EMPTY_MESSAGE;
    render(elements, state);

    if (selected !== undefined) {
      void loadBranches(elements, state, selected);
    }
  });

  elements.branchSelect.addEventListener("change", () => {
    const selected = state.branches.find(
      (branch) => branch.name === elements.branchSelect.value
    );
    state.syncBranch = selected ?? null;
    state.branchMessage = EMPTY_MESSAGE;
    render(elements, state);
  });

  elements.createBranchInput.addEventListener("input", () => {
    state.createBranchMessage = EMPTY_MESSAGE;
    render(elements, state);
  });

  elements.createBranchButton.addEventListener("click", () => {
    void createBranch(elements, state);
  });

  elements.autoSyncCheckbox.addEventListener("change", () => {
    state.autoSyncEnabled = elements.autoSyncCheckbox.checked;
    render(elements, state);
  });

  for (const languageButton of elements.languageButtons) {
    languageButton.addEventListener("click", () => {
      const preference = languageButton.dataset.languageOption;

      if (!isUiLanguagePreference(preference)) {
        return;
      }

      setUiLanguage(state, preference);
      render(elements, state);
    });
  }

  elements.testConnectionButton.addEventListener("click", () => {
    void testConnection(elements, state);
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSettingsFromForm(elements, state);
  });
}

async function loadRepositories(
  elements: OptionsElements,
  state: OptionsRuntimeState
): Promise<void> {
  state.githubPatInput = elements.patInput.value;
  state.repositoryQuery = elements.repositorySearchInput.value;
  state.patMessage = EMPTY_MESSAGE;
  state.repositoryMessage = EMPTY_MESSAGE;
  state.saveMessage = EMPTY_MESSAGE;

  if (state.githubPatInput.trim().length === 0) {
    state.patMessage = localizedMessage(
      "options.message.patRequiredBeforeLoad",
      "error"
    );
    render(elements, state);
    return;
  }

  state.loadingRepositories = true;
  render(elements, state);

  try {
    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      uiLanguage: state.uiLanguage
    });

    const response = await sendRuntimeMessage<RepositoryListResult>({
      type: "github:repositories:list",
      payload: {
        query:
          state.repositoryQuery.trim().length === 0 ? null : state.repositoryQuery,
        page: 1,
        perPage: 100
      }
    });

    if (!response.ok) {
      throw response.error;
    }

    state.repositories = response.data.repositories;

    if (
      state.syncRepository !== null &&
      !state.repositories.some(
        (repository) => repository.fullName === state.syncRepository?.fullName
      )
    ) {
      state.syncRepository = null;
      state.branches = [];
      state.syncBranch = null;
    }

    if (response.data.totalCount === 0) {
      state.connectionStatus = createConnectionStatus("no_accessible_repositories");
      state.repositoryMessage = localizedMessage(
        "options.message.noOwnedRepositories",
        "warning"
      );
      await saveSettings({
        uiLanguage: state.uiLanguage,
        connectionStatus: state.connectionStatus
      });
    } else if (response.data.hasMore) {
      state.repositoryMessage = localizedMessage(
        "options.message.repositoriesLoadedPartial",
        "neutral",
        {
          shown: response.data.repositories.length,
          total: response.data.totalCount
        }
      );
    } else {
      state.repositoryMessage = localizedMessage(
        "options.message.repositoriesLoaded",
        "success",
        {
          count: response.data.repositories.length
        }
      );
    }
  } catch (error) {
    const normalized = normalizeError(error);
    state.connectionStatus = createConnectionStatus(
      mapConnectionErrorCode(normalized.code),
      normalized
    );
    state.repositoryMessage = {
      text: normalized.userMessage,
      tone: "error"
    };
    await saveSettings({
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });
  } finally {
    state.loadingRepositories = false;
    render(elements, state);
  }
}

async function loadBranches(
  elements: OptionsElements,
  state: OptionsRuntimeState,
  repository: SyncRepository
): Promise<void> {
  state.loadingBranches = true;
  state.branchMessage = localizedMessage("options.message.loadingBranches", "neutral");
  render(elements, state);

  try {
    const response = await sendRuntimeMessage<SyncBranch[]>({
      type: "github:branches:list",
      payload: {
        repository
      }
    });

    if (!response.ok) {
      throw response.error;
    }

    state.branches = response.data;
    const branchName = getDefaultBranchSelection(
      repository,
      state.branches,
      state.syncBranch?.name ?? null
    );
    state.syncBranch =
      branchName === null
        ? null
        : state.branches.find((branch) => branch.name === branchName) ?? null;

    if (state.branches.length === 0) {
      state.branchMessage = localizedMessage("options.message.noBranches", "warning");
    } else if (state.syncBranch?.name === repository.defaultBranch) {
      state.branchMessage = localizedMessage(
        "options.message.defaultBranchSelected",
        "success",
        {
          branch: repository.defaultBranch
        }
      );
    } else {
      state.branchMessage = localizedMessage(
        "options.message.branchesLoaded",
        "success",
        {
          count: state.branches.length
        }
      );
    }
  } catch (error) {
    const normalized = normalizeError(error);
    state.connectionStatus = createConnectionStatus(
      mapConnectionErrorCode(normalized.code),
      normalized
    );
    state.branchMessage = {
      text: normalized.userMessage,
      tone: "error"
    };
    await saveSettings({
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });
  } finally {
    state.loadingBranches = false;
    render(elements, state);
  }
}

async function createBranch(
  elements: OptionsElements,
  state: OptionsRuntimeState
): Promise<void> {
  const branchName = elements.createBranchInput.value.trim();

  if (state.syncRepository === null) {
    state.createBranchMessage = localizedMessage(
      "options.message.chooseRepositoryBeforeBranch",
      "error"
    );
    render(elements, state);
    return;
  }

  if (branchName.length === 0) {
    state.createBranchMessage = localizedMessage(
      "options.message.enterBranchName",
      "error"
    );
    render(elements, state);
    return;
  }

  if (state.branches.some((branch) => branch.name === branchName)) {
    state.createBranchMessage = localizedMessage(
      "options.message.branchAlreadyExists",
      "warning"
    );
    render(elements, state);
    return;
  }

  state.creatingBranch = true;
  state.createBranchMessage = localizedMessage("action.creating", "neutral");
  render(elements, state);

  try {
    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      uiLanguage: state.uiLanguage
    });

    const response = await sendRuntimeMessage<SyncBranch>({
      type: "github:branch:create",
      payload: {
        repository: state.syncRepository,
        branchName
      }
    });

    if (!response.ok) {
      throw response.error;
    }

    state.branches = mergeBranches(state.branches, [response.data]);
    state.syncBranch = response.data;
    state.connectionStatus = createConnectionStatus("branch_created");
    state.createBranchMessage = localizedMessage(
      "options.message.branchCreated",
      "success",
      {
        branch: response.data.name
      }
    );
    elements.createBranchInput.value = "";

    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      syncRepository: state.syncRepository,
      syncBranch: state.syncBranch,
      autoSyncEnabled: state.autoSyncEnabled,
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });
  } catch (error) {
    const normalized = normalizeError(error);
    state.connectionStatus = createConnectionStatus(
      mapConnectionErrorCode(normalized.code),
      normalized
    );
    state.createBranchMessage = {
      text: normalized.userMessage,
      tone: "error"
    };
    await saveSettings({
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });
  } finally {
    state.creatingBranch = false;
    render(elements, state);
  }
}

async function testConnection(
  elements: OptionsElements,
  state: OptionsRuntimeState
): Promise<void> {
  state.githubPatInput = elements.patInput.value;
  state.autoSyncEnabled = elements.autoSyncCheckbox.checked;

  const validation = validateSettingsDraft({
    githubPat: state.githubPatInput,
    syncRepository: state.syncRepository,
    syncBranch: state.syncBranch
  }, state.locale);
  applyValidationMessages(state, validation);

  if (!validation.isValid) {
    render(elements, state);
    return;
  }

  state.testingConnection = true;
  state.connectionStatus = createConnectionStatus("testing");
  state.saveMessage = EMPTY_MESSAGE;
  render(elements, state);

  try {
    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      syncRepository: state.syncRepository,
      syncBranch: state.syncBranch,
      autoSyncEnabled: state.autoSyncEnabled,
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });

    const response = await sendRuntimeMessage<ConnectionTestResult>({
      type: "github:connection:test",
      payload: {
        repository: state.syncRepository as SyncRepository,
        branchName: (state.syncBranch as SyncBranch).name
      }
    });

    if (!response.ok) {
      throw response.error;
    }

    state.syncRepository = response.data.repository;
    state.syncBranch = response.data.branch;
    state.repositories = mergeRepositories(state.repositories, [response.data.repository]);
    state.branches = mergeBranches(state.branches, [response.data.branch]);
    state.connectionStatus = createConnectionStatus("connected");

    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      syncRepository: state.syncRepository,
      syncBranch: state.syncBranch,
      autoSyncEnabled: state.autoSyncEnabled,
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });
  } catch (error) {
    const normalized = normalizeError(error);
    state.connectionStatus = createConnectionStatus(
      mapConnectionErrorCode(normalized.code),
      normalized
    );
    await saveSettings({
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });
  } finally {
    state.testingConnection = false;
    render(elements, state);
  }
}

async function saveSettingsFromForm(
  elements: OptionsElements,
  state: OptionsRuntimeState
): Promise<void> {
  state.githubPatInput = elements.patInput.value;
  state.autoSyncEnabled = elements.autoSyncCheckbox.checked;

  const validation = validateSettingsDraft({
    githubPat: state.githubPatInput,
    syncRepository: state.syncRepository,
    syncBranch: state.syncBranch
  }, state.locale);
  applyValidationMessages(state, validation);

  if (!validation.isValid) {
    state.saveMessage = localizedMessage(
      "options.message.completeRequiredSettings",
      "error"
    );
    render(elements, state);
    return;
  }

  state.savingSettings = true;
  state.saveMessage = localizedMessage("options.message.savingSettings", "neutral");
  render(elements, state);

  try {
    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      syncRepository: state.syncRepository,
      syncBranch: state.syncBranch,
      autoSyncEnabled: state.autoSyncEnabled,
      uiLanguage: state.uiLanguage,
      connectionStatus: state.connectionStatus
    });
    state.saveMessage = localizedMessage("options.message.settingsSaved", "success");
  } catch (error) {
    state.saveMessage = {
      text: normalizeError(error).userMessage,
      tone: "error"
    };
  } finally {
    state.savingSettings = false;
    render(elements, state);
  }
}

function applySettingsToState(
  state: OptionsRuntimeState,
  settings: SettingsState
): void {
  state.githubPatInput = settings.githubPat ?? "";
  state.syncRepository = settings.syncRepository;
  state.syncBranch = settings.syncBranch;
  state.repositories =
    settings.syncRepository === null ? [] : [settings.syncRepository];
  state.branches = settings.syncBranch === null ? [] : [settings.syncBranch];
  state.autoSyncEnabled = settings.autoSyncEnabled;
  setUiLanguage(state, settings.uiLanguage);
  state.connectionStatus = settings.connectionStatus;
}

function applyValidationMessages(
  state: OptionsRuntimeState,
  validation: SettingsValidationResult
): void {
  state.patMessage =
    validation.errors.githubPat === undefined
      ? EMPTY_MESSAGE
      : localizedMessage("validation.githubPatRequired", "error");
  state.repositoryMessage =
    validation.errors.repository === undefined
      ? state.repositoryMessage
      : localizedMessage("validation.repositoryRequired", "error");
  state.branchMessage =
    validation.errors.branch === undefined
      ? state.branchMessage
      : localizedMessage("validation.branchRequired", "error");
}

function render(elements: OptionsElements, state: OptionsRuntimeState): void {
  state.locale = getOptionsLocale(state.uiLanguage);
  document.documentElement.lang = state.locale;
  renderStaticText(state.locale);

  elements.status.textContent = state.loadingSettings
    ? t(state.locale, "options.status.loadingSettings")
    : t(state.locale, "options.status.storedProfile");

  elements.patInput.type = state.patVisible ? "text" : "password";
  elements.patInput.value = state.githubPatInput;
  elements.togglePatButton.textContent = state.patVisible
    ? t(state.locale, "action.hide")
    : t(state.locale, "action.show");
  renderInlineMessage(elements.patError, state.patMessage, state.locale);

  elements.repositorySearchInput.value = state.repositoryQuery;
  elements.loadRepositoriesButton.disabled = state.loadingRepositories;
  elements.loadRepositoriesButton.textContent = state.loadingRepositories
    ? t(state.locale, "action.loading")
    : t(state.locale, "action.loadRepositories");
  renderRepositorySelect(elements, state);
  renderInlineMessage(elements.repositoryStatus, state.repositoryMessage, state.locale);

  renderBranchSelect(elements, state);
  renderInlineMessage(elements.branchStatus, state.branchMessage, state.locale);

  renderCreateBranchControls(elements, state);
  renderInlineMessage(elements.createBranchStatus, state.createBranchMessage, state.locale);

  elements.autoSyncCheckbox.checked = state.autoSyncEnabled;
  renderLanguageControls(elements, state);

  elements.testConnectionButton.disabled =
    state.testingConnection || state.syncRepository === null || state.syncBranch === null;
  elements.testConnectionButton.textContent = state.testingConnection
    ? t(state.locale, "status.testing")
    : t(state.locale, "action.testConnection");
  renderConnectionStatus(elements.connectionStatusBox, state.connectionStatus, state.locale);

  elements.saveButton.disabled = state.savingSettings;
  elements.saveButton.textContent = state.savingSettings
    ? t(state.locale, "action.saving")
    : t(state.locale, "action.save");
  renderInlineMessage(elements.saveStatus, state.saveMessage, state.locale);
}

function renderStaticText(locale: UiLocale): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;

    if (key !== undefined) {
      element.textContent = t(locale, key as I18nKey);
    }
  }

  for (const element of document.querySelectorAll<HTMLInputElement>(
    "[data-i18n-placeholder]"
  )) {
    const key = element.dataset.i18nPlaceholder;

    if (key !== undefined) {
      element.placeholder = t(locale, key as I18nKey);
    }
  }
}

function renderLanguageControls(
  elements: OptionsElements,
  state: OptionsRuntimeState
): void {
  for (const button of elements.languageButtons) {
    const isSelected = button.dataset.languageOption === state.uiLanguage;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function renderRepositorySelect(
  elements: OptionsElements,
  state: OptionsRuntimeState
): void {
  const filterState = getRepositoryFilterState(
    state.repositories,
    state.repositoryQuery
  );

  elements.repositorySelect.replaceChildren(
    ...filterState.visibleRepositories.map((repository) => {
      const option = document.createElement("option");
      option.value = repository.fullName;
      option.textContent = repository.private
        ? `${repository.fullName} (${t(state.locale, "options.suffix.private")})`
        : repository.fullName;
      return option;
    })
  );

  if (state.syncRepository === null) {
    elements.repositorySelect.selectedIndex = -1;
  } else {
    elements.repositorySelect.value = state.syncRepository.fullName;

    if (elements.repositorySelect.value !== state.syncRepository.fullName) {
      elements.repositorySelect.selectedIndex = -1;
    }
  }

  if (
    state.repositories.length > 0 &&
    !filterState.hasMatches &&
    state.repositoryMessage.tone !== "error"
  ) {
    state.repositoryMessage = localizedMessage(
      "options.message.noRepositorySearchMatches",
      "warning"
    );
  }
}

function renderBranchSelect(
  elements: OptionsElements,
  state: OptionsRuntimeState
): void {
  elements.branchSelect.disabled =
    state.syncRepository === null || state.loadingBranches || state.branches.length === 0;

  elements.branchSelect.replaceChildren(
    ...state.branches.map((branch) => {
      const option = document.createElement("option");
      option.value = branch.name;
      option.textContent = branch.protected
        ? `${branch.name} (${t(state.locale, "options.suffix.protected")})`
        : branch.name;
      return option;
    })
  );

  if (state.syncBranch === null) {
    elements.branchSelect.selectedIndex = -1;
  } else {
    elements.branchSelect.value = state.syncBranch.name;
  }
}

function renderCreateBranchControls(
  elements: OptionsElements,
  state: OptionsRuntimeState
): void {
  const branchName = elements.createBranchInput.value.trim();
  const branchAlreadyExists = state.branches.some((branch) => branch.name === branchName);
  const canCreate =
    state.syncRepository !== null &&
    !state.loadingBranches &&
    !state.creatingBranch &&
    state.branches.length > 0 &&
    branchName.length > 0 &&
    !branchAlreadyExists;

  elements.createBranchInput.disabled =
    state.syncRepository === null || state.loadingBranches || state.creatingBranch;
  elements.createBranchButton.disabled = !canCreate;
  elements.createBranchButton.textContent = state.creatingBranch
    ? t(state.locale, "action.creating")
    : t(state.locale, "action.createBranch");

  if (
    branchName.length > 0 &&
    branchAlreadyExists &&
    state.createBranchMessage.text.length === 0
  ) {
    state.createBranchMessage = localizedMessage(
      "options.message.branchAlreadyExists",
      "warning"
    );
  }
}

function renderConnectionStatus(
  element: HTMLDivElement,
  status: ConnectionStatus,
  locale: UiLocale
): void {
  const view = getSharedConnectionStatusView(locale, status);
  element.className = `status-box ${view.tone}`;
  element.textContent = view.detail === null ? view.label : `${view.label}. ${view.detail}`;
}

function getOptionsLocale(preference: UiLanguagePreference): UiLocale {
  return resolveUiLocale(preference, getBrowserLanguage());
}

function setUiLanguage(
  state: OptionsRuntimeState,
  preference: UiLanguagePreference
): void {
  state.uiLanguage = preference;
  state.locale = getOptionsLocale(preference);
}

function getBrowserLanguage(): string | null {
  return typeof navigator === "undefined" ? null : navigator.language;
}

function renderInlineMessage(
  element: HTMLParagraphElement,
  message: InlineMessage,
  locale: UiLocale
): void {
  element.className = `field-message ${message.tone === "neutral" ? "" : message.tone}`.trim();
  element.textContent =
    message.i18nKey === undefined
      ? message.text
      : t(locale, message.i18nKey, message.i18nParams ?? {});
}

function collectElements(): OptionsElements {
  return {
    form: requireElement("options-form", HTMLFormElement),
    status: requireElement("options-status", HTMLParagraphElement),
    patInput: requireElement("github-pat", HTMLInputElement),
    togglePatButton: requireElement("toggle-pat", HTMLButtonElement),
    patError: requireElement("pat-error", HTMLParagraphElement),
    loadRepositoriesButton: requireElement("load-repositories", HTMLButtonElement),
    repositorySearchInput: requireElement("repository-search", HTMLInputElement),
    repositorySelect: requireElement("repository-select", HTMLSelectElement),
    repositoryStatus: requireElement("repository-status", HTMLParagraphElement),
    branchSelect: requireElement("branch-select", HTMLSelectElement),
    branchStatus: requireElement("branch-status", HTMLParagraphElement),
    createBranchInput: requireElement("create-branch-name", HTMLInputElement),
    createBranchButton: requireElement("create-branch", HTMLButtonElement),
    createBranchStatus: requireElement("create-branch-status", HTMLParagraphElement),
    autoSyncCheckbox: requireElement("auto-sync-enabled", HTMLInputElement),
    languageButtons: collectLanguageButtons(),
    testConnectionButton: requireElement("test-connection", HTMLButtonElement),
    connectionStatusBox: requireElement("connection-status", HTMLDivElement),
    saveButton: requireElement("save-settings", HTMLButtonElement),
    saveStatus: requireElement("save-status", HTMLParagraphElement)
  };
}

function collectLanguageButtons(): HTMLButtonElement[] {
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-language-option]")
  ];

  if (buttons.length === 0) {
    throw new Error("Missing options element: language selector");
  }

  return buttons;
}

function requireElement<T extends HTMLElement>(
  id: string,
  constructor: { new (...args: never[]): T }
): T {
  const element = document.getElementById(id);

  if (!(element instanceof constructor)) {
    throw new Error(`Missing options element: ${id}`);
  }

  return element;
}

async function readSettings(): Promise<SettingsState> {
  const values = await chrome.storage.local.get([STORAGE_KEYS.settings]);
  const value = values[STORAGE_KEYS.settings];

  return parseSettingsState(value) ?? DEFAULT_SETTINGS_STATE;
}

async function saveSettings(
  update: Partial<Omit<SettingsState, "version" | "updatedAt">>
): Promise<SettingsState> {
  const current = await readSettings();
  const next: SettingsState = {
    ...current,
    ...update,
    version: STORAGE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: next
  });

  return next;
}

function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: RuntimeResponse<T> | undefined) => {
      const lastError = chrome.runtime.lastError;

      if (lastError !== undefined) {
        resolve({
          ok: false,
          error: normalizeError(new Error(lastError.message))
        });
        return;
      }

      if (response === undefined) {
        resolve({
          ok: false,
          error: normalizeError(new Error("Background service worker did not respond."))
        });
        return;
      }

      resolve(response);
    });
  });
}

function normalizePat(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function createConnectionStatus(
  code: ConnectionStatusCode,
  error: NormalizedError | null = null,
  checkedAt: IsoDateString | null = new Date().toISOString()
): ConnectionStatus {
  return {
    code,
    checkedAt,
    error
  };
}

function mergeRepositories(
  repositories: SyncRepository[],
  additional: SyncRepository[]
): SyncRepository[] {
  const byFullName = new Map<string, SyncRepository>();

  for (const repository of [...repositories, ...additional]) {
    byFullName.set(repository.fullName, repository);
  }

  return [...byFullName.values()].sort((left, right) =>
    left.fullName.localeCompare(right.fullName)
  );
}

function mergeBranches(branches: SyncBranch[], additional: SyncBranch[]): SyncBranch[] {
  const byName = new Map<string, SyncBranch>();

  for (const branch of [...branches, ...additional]) {
    byName.set(branch.name, branch);
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

if (typeof document !== "undefined") {
  void initOptionsPage();
}
