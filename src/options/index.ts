import {
  APP_NAME,
  DEFAULT_SETTINGS_STATE,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  getConnectionStatusView as getSharedConnectionStatusView,
  normalizeError,
  parseSettingsState,
  resolveUiLocale,
  type BranchRef,
  type ConnectionStatus,
  type ConnectionStatusCode,
  type ConnectionStatusView,
  type IsoDateString,
  type NormalizedError,
  type NormalizedErrorCode,
  type RepositoryRef,
  type RuntimeMessage,
  type SettingsState,
  type Tone,
  type UiLanguagePreference,
  type UiLocale
} from "../shared";

export interface RepositoryFilterState {
  query: string;
  repositories: RepositoryRef[];
  visibleRepositories: RepositoryRef[];
  hasMatches: boolean;
}

export interface SettingsValidationDraft {
  githubPat: string;
  selectedRepository: RepositoryRef | null;
  selectedBranch: BranchRef | null;
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
}

interface RepositoryListResult {
  repositories: RepositoryRef[];
  page: number;
  perPage: number;
  totalCount: number;
  hasMore: boolean;
}

interface ConnectionTestResult {
  repository: RepositoryRef;
  branch: BranchRef;
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
  repositories: RepositoryRef[];
  repositoryQuery: string;
  selectedRepository: RepositoryRef | null;
  branches: BranchRef[];
  selectedBranch: BranchRef | null;
  autoSyncEnabled: boolean;
  uiLanguage: UiLanguagePreference;
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

export function getRepositoryFilterState(
  repositories: RepositoryRef[],
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
  repository: RepositoryRef | null,
  branches: BranchRef[],
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
  draft: SettingsValidationDraft
): SettingsValidationResult {
  const errors: SettingsValidationResult["errors"] = {};

  if (draft.githubPat.trim().length === 0) {
    errors.githubPat = "GitHub PAT is required.";
  }

  if (draft.selectedRepository === null) {
    errors.repository = "Choose a repository from the owned repository list.";
  }

  if (draft.selectedBranch === null) {
    errors.branch = "Choose an existing branch or create one first.";
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
  error: NormalizedError | null = null
): ConnectionStatusView {
  return getSharedConnectionStatusView("en", status, error);
}

function createInitialState(): OptionsRuntimeState {
  return {
    githubPatInput: "",
    patVisible: false,
    repositories: [],
    repositoryQuery: "",
    selectedRepository: null,
    branches: [],
    selectedBranch: null,
    autoSyncEnabled: false,
    uiLanguage: DEFAULT_SETTINGS_STATE.uiLanguage,
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

    if (settings.githubPat !== null && settings.selectedRepository !== null) {
      void loadBranches(elements, state, settings.selectedRepository);
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
    state.selectedRepository = selected ?? null;
    state.branches = [];
    state.selectedBranch = null;
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
    state.selectedBranch = selected ?? null;
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
    state.patMessage = {
      text: "GitHub PAT is required before loading repositories.",
      tone: "error"
    };
    render(elements, state);
    return;
  }

  state.loadingRepositories = true;
  render(elements, state);

  try {
    await saveSettings({
      githubPat: normalizePat(state.githubPatInput)
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
      state.selectedRepository !== null &&
      !state.repositories.some(
        (repository) => repository.fullName === state.selectedRepository?.fullName
      )
    ) {
      state.selectedRepository = null;
      state.branches = [];
      state.selectedBranch = null;
    }

    if (response.data.totalCount === 0) {
      state.connectionStatus = createConnectionStatus("no_accessible_repositories");
      state.repositoryMessage = {
        text:
          "No owned repositories. Check that the token includes a repository owned by your account.",
        tone: "warning"
      };
      await saveSettings({
        connectionStatus: state.connectionStatus
      });
    } else if (response.data.hasMore) {
      state.repositoryMessage = {
        text: `Loaded ${response.data.repositories.length} of ${response.data.totalCount} repositories. Use search to narrow the list.`,
        tone: "neutral"
      };
    } else {
      state.repositoryMessage = {
        text: `Loaded ${response.data.repositories.length} repositories.`,
        tone: "success"
      };
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
  repository: RepositoryRef
): Promise<void> {
  state.loadingBranches = true;
  state.branchMessage = {
    text: "Loading branches...",
    tone: "neutral"
  };
  render(elements, state);

  try {
    const response = await sendRuntimeMessage<BranchRef[]>({
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
      state.selectedBranch?.name ?? null
    );
    state.selectedBranch =
      branchName === null
        ? null
        : state.branches.find((branch) => branch.name === branchName) ?? null;

    if (state.branches.length === 0) {
      state.branchMessage = {
        text: "No branches found. Empty repositories cannot create a branch from default branch HEAD.",
        tone: "warning"
      };
    } else if (state.selectedBranch?.name === repository.defaultBranch) {
      state.branchMessage = {
        text: `Default branch selected: ${repository.defaultBranch}.`,
        tone: "success"
      };
    } else {
      state.branchMessage = {
        text: `Loaded ${state.branches.length} branches.`,
        tone: "success"
      };
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

  if (state.selectedRepository === null) {
    state.createBranchMessage = {
      text: "Choose a repository before creating a branch.",
      tone: "error"
    };
    render(elements, state);
    return;
  }

  if (branchName.length === 0) {
    state.createBranchMessage = {
      text: "Enter a branch name.",
      tone: "error"
    };
    render(elements, state);
    return;
  }

  if (state.branches.some((branch) => branch.name === branchName)) {
    state.createBranchMessage = {
      text: "Branch already exists. Select it from the branch picker.",
      tone: "warning"
    };
    render(elements, state);
    return;
  }

  state.creatingBranch = true;
  state.createBranchMessage = {
    text: "Creating branch...",
    tone: "neutral"
  };
  render(elements, state);

  try {
    await saveSettings({
      githubPat: normalizePat(state.githubPatInput)
    });

    const response = await sendRuntimeMessage<BranchRef>({
      type: "github:branch:create",
      payload: {
        repository: state.selectedRepository,
        branchName
      }
    });

    if (!response.ok) {
      throw response.error;
    }

    state.branches = mergeBranches(state.branches, [response.data]);
    state.selectedBranch = response.data;
    state.connectionStatus = createConnectionStatus("branch_created");
    state.createBranchMessage = {
      text: `Created branch ${response.data.name}.`,
      tone: "success"
    };
    elements.createBranchInput.value = "";

    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      selectedRepository: state.selectedRepository,
      selectedBranch: state.selectedBranch,
      autoSyncEnabled: state.autoSyncEnabled,
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
    selectedRepository: state.selectedRepository,
    selectedBranch: state.selectedBranch
  });
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
      selectedRepository: state.selectedRepository,
      selectedBranch: state.selectedBranch,
      autoSyncEnabled: state.autoSyncEnabled,
      connectionStatus: state.connectionStatus
    });

    const response = await sendRuntimeMessage<ConnectionTestResult>({
      type: "github:connection:test",
      payload: {
        repository: state.selectedRepository as RepositoryRef,
        branchName: (state.selectedBranch as BranchRef).name
      }
    });

    if (!response.ok) {
      throw response.error;
    }

    state.selectedRepository = response.data.repository;
    state.selectedBranch = response.data.branch;
    state.repositories = mergeRepositories(state.repositories, [response.data.repository]);
    state.branches = mergeBranches(state.branches, [response.data.branch]);
    state.connectionStatus = createConnectionStatus("connected");

    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      selectedRepository: state.selectedRepository,
      selectedBranch: state.selectedBranch,
      autoSyncEnabled: state.autoSyncEnabled,
      connectionStatus: state.connectionStatus
    });
  } catch (error) {
    const normalized = normalizeError(error);
    state.connectionStatus = createConnectionStatus(
      mapConnectionErrorCode(normalized.code),
      normalized
    );
    await saveSettings({
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
    selectedRepository: state.selectedRepository,
    selectedBranch: state.selectedBranch
  });
  applyValidationMessages(state, validation);

  if (!validation.isValid) {
    state.saveMessage = {
      text: "Complete the required settings before saving.",
      tone: "error"
    };
    render(elements, state);
    return;
  }

  state.savingSettings = true;
  state.saveMessage = {
    text: "Saving settings...",
    tone: "neutral"
  };
  render(elements, state);

  try {
    await saveSettings({
      githubPat: normalizePat(state.githubPatInput),
      selectedRepository: state.selectedRepository,
      selectedBranch: state.selectedBranch,
      autoSyncEnabled: state.autoSyncEnabled,
      connectionStatus: state.connectionStatus
    });
    state.saveMessage = {
      text: "Settings saved.",
      tone: "success"
    };
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
  state.selectedRepository = settings.selectedRepository;
  state.selectedBranch = settings.selectedBranch;
  state.repositories =
    settings.selectedRepository === null ? [] : [settings.selectedRepository];
  state.branches = settings.selectedBranch === null ? [] : [settings.selectedBranch];
  state.autoSyncEnabled = settings.autoSyncEnabled;
  state.uiLanguage = settings.uiLanguage;
  state.connectionStatus = settings.connectionStatus;
}

function applyValidationMessages(
  state: OptionsRuntimeState,
  validation: SettingsValidationResult
): void {
  state.patMessage =
    validation.errors.githubPat === undefined
      ? EMPTY_MESSAGE
      : {
          text: validation.errors.githubPat,
          tone: "error"
        };
  state.repositoryMessage =
    validation.errors.repository === undefined
      ? state.repositoryMessage
      : {
          text: validation.errors.repository,
          tone: "error"
        };
  state.branchMessage =
    validation.errors.branch === undefined
      ? state.branchMessage
      : {
          text: validation.errors.branch,
          tone: "error"
        };
}

function render(elements: OptionsElements, state: OptionsRuntimeState): void {
  const locale = getOptionsLocale(state.uiLanguage);

  elements.status.textContent = state.loadingSettings
    ? "Loading settings..."
    : "Settings are stored in this browser profile.";

  elements.patInput.type = state.patVisible ? "text" : "password";
  elements.patInput.value = state.githubPatInput;
  elements.togglePatButton.textContent = state.patVisible ? "Hide" : "Show";
  renderInlineMessage(elements.patError, state.patMessage);

  elements.repositorySearchInput.value = state.repositoryQuery;
  elements.loadRepositoriesButton.disabled = state.loadingRepositories;
  elements.loadRepositoriesButton.textContent = state.loadingRepositories
    ? "Loading..."
    : "Load repositories";
  renderRepositorySelect(elements, state);
  renderInlineMessage(elements.repositoryStatus, state.repositoryMessage);

  renderBranchSelect(elements, state);
  renderInlineMessage(elements.branchStatus, state.branchMessage);

  renderCreateBranchControls(elements, state);
  renderInlineMessage(elements.createBranchStatus, state.createBranchMessage);

  elements.autoSyncCheckbox.checked = state.autoSyncEnabled;

  elements.testConnectionButton.disabled =
    state.testingConnection || state.selectedRepository === null || state.selectedBranch === null;
  elements.testConnectionButton.textContent = state.testingConnection
    ? "Testing..."
    : "Test connection";
  renderConnectionStatus(elements.connectionStatusBox, state.connectionStatus, locale);

  elements.saveButton.disabled = state.savingSettings;
  elements.saveButton.textContent = state.savingSettings ? "Saving..." : "Save settings";
  renderInlineMessage(elements.saveStatus, state.saveMessage);
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
      option.textContent = `${repository.fullName}${repository.private ? " (private)" : ""}`;
      return option;
    })
  );

  if (state.selectedRepository === null) {
    elements.repositorySelect.selectedIndex = -1;
  } else {
    elements.repositorySelect.value = state.selectedRepository.fullName;

    if (elements.repositorySelect.value !== state.selectedRepository.fullName) {
      elements.repositorySelect.selectedIndex = -1;
    }
  }

  if (
    state.repositories.length > 0 &&
    !filterState.hasMatches &&
    state.repositoryMessage.tone !== "error"
  ) {
    state.repositoryMessage = {
      text: "No repositories match the search.",
      tone: "warning"
    };
  }
}

function renderBranchSelect(
  elements: OptionsElements,
  state: OptionsRuntimeState
): void {
  elements.branchSelect.disabled =
    state.selectedRepository === null || state.loadingBranches || state.branches.length === 0;

  elements.branchSelect.replaceChildren(
    ...state.branches.map((branch) => {
      const option = document.createElement("option");
      option.value = branch.name;
      option.textContent = branch.protected ? `${branch.name} (protected)` : branch.name;
      return option;
    })
  );

  if (state.selectedBranch === null) {
    elements.branchSelect.selectedIndex = -1;
  } else {
    elements.branchSelect.value = state.selectedBranch.name;
  }
}

function renderCreateBranchControls(
  elements: OptionsElements,
  state: OptionsRuntimeState
): void {
  const branchName = elements.createBranchInput.value.trim();
  const branchAlreadyExists = state.branches.some((branch) => branch.name === branchName);
  const canCreate =
    state.selectedRepository !== null &&
    !state.loadingBranches &&
    !state.creatingBranch &&
    state.branches.length > 0 &&
    branchName.length > 0 &&
    !branchAlreadyExists;

  elements.createBranchInput.disabled =
    state.selectedRepository === null || state.loadingBranches || state.creatingBranch;
  elements.createBranchButton.disabled = !canCreate;
  elements.createBranchButton.textContent = state.creatingBranch
    ? "Creating..."
    : "Create branch";

  if (
    branchName.length > 0 &&
    branchAlreadyExists &&
    state.createBranchMessage.text.length === 0
  ) {
    state.createBranchMessage = {
      text: "Branch already exists. Select it from the branch picker.",
      tone: "warning"
    };
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

function getBrowserLanguage(): string | null {
  return typeof navigator === "undefined" ? null : navigator.language;
}

function renderInlineMessage(element: HTMLParagraphElement, message: InlineMessage): void {
  element.className = `field-message ${message.tone === "neutral" ? "" : message.tone}`.trim();
  element.textContent = message.text;
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
    testConnectionButton: requireElement("test-connection", HTMLButtonElement),
    connectionStatusBox: requireElement("connection-status", HTMLDivElement),
    saveButton: requireElement("save-settings", HTMLButtonElement),
    saveStatus: requireElement("save-status", HTMLParagraphElement)
  };
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
  repositories: RepositoryRef[],
  additional: RepositoryRef[]
): RepositoryRef[] {
  const byFullName = new Map<string, RepositoryRef>();

  for (const repository of [...repositories, ...additional]) {
    byFullName.set(repository.fullName, repository);
  }

  return [...byFullName.values()].sort((left, right) =>
    left.fullName.localeCompare(right.fullName)
  );
}

function mergeBranches(branches: BranchRef[], additional: BranchRef[]): BranchRef[] {
  const byName = new Map<string, BranchRef>();

  for (const branch of [...branches, ...additional]) {
    byName.set(branch.name, branch);
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

if (typeof document !== "undefined") {
  void initOptionsPage();
}
