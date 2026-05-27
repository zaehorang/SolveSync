import {
  APP_NAME,
  normalizeError,
  type NormalizedError,
  type PublicSettingsState,
  type RetryPayloadSummary,
  type RuntimeMessage,
  type SyncRecord,
  type SyncStatus
} from "../shared";

type Tone = "neutral" | "success" | "warning" | "error";

interface RuntimeSuccessResponse<T> {
  ok: true;
  data: T;
}

interface RuntimeFailureResponse {
  ok: false;
  error: NormalizedError;
}

type RuntimeResponse<T> = RuntimeSuccessResponse<T> | RuntimeFailureResponse;

interface InlineMessage {
  text: string;
  tone: Tone;
}

export interface PopupSetupStatusView {
  label: string;
  detail: string;
  tone: Tone;
}

export interface FailureDetailView {
  summary: string;
  detailLines: string[];
}

export interface PopupHistoryItem {
  id: string;
  status: SyncStatus;
  title: string;
  languageLabel: string;
  meta: string;
  timeLabel: string;
  statusLabel: string;
  tone: Tone;
  commitUrl: string | null;
  fileUrl: string | null;
  failure: FailureDetailView | null;
  unsupportedReason: string | null;
  retryPayloadId: string | null;
  canRetry: boolean;
}

export interface PopupHistoryModel {
  items: PopupHistoryItem[];
  emptyText: string;
}

interface PopupRuntimeState {
  settings: PublicSettingsState | null;
  historyRecords: SyncRecord[];
  retryPayloads: RetryPayloadSummary[];
  loading: boolean;
  savingAutoSync: boolean;
  retryingPayloadIds: Set<string>;
  expandedRecordId: string | null;
  message: InlineMessage;
}

interface PopupElements {
  status: HTMLParagraphElement;
  setupSummary: HTMLDivElement;
  autoSyncToggle: HTMLInputElement;
  autoSyncCopy: HTMLElement;
  autoSyncStatus: HTMLParagraphElement;
  openOptionsButton: HTMLButtonElement;
  historyCount: HTMLParagraphElement;
  historyEmpty: HTMLParagraphElement;
  historyList: HTMLUListElement;
}

const HISTORY_LIMIT = 20;
const EMPTY_MESSAGE: InlineMessage = {
  text: "",
  tone: "neutral"
};

export function createAutoSyncToggleMessage(enabled: boolean): RuntimeMessage {
  return {
    type: "settings:write",
    payload: {
      update: {
        autoSyncEnabled: enabled
      }
    }
  };
}

export function getSetupStatusView(
  settings: PublicSettingsState | null
): PopupSetupStatusView {
  if (settings === null) {
    return {
      label: "Loading settings",
      detail: "Reading popup state from the background service worker.",
      tone: "neutral"
    };
  }

  if (!settings.hasGithubPat) {
    return {
      label: "GitHub connection required",
      detail: "Open Options and save a fine-grained PAT.",
      tone: "warning"
    };
  }

  if (settings.selectedRepository === null) {
    return {
      label: "Repository required",
      detail: "Open Options and choose an owned repository.",
      tone: "warning"
    };
  }

  if (settings.selectedBranch === null) {
    return {
      label: "Branch required",
      detail: "Open Options and choose an existing branch.",
      tone: "warning"
    };
  }

  const target = `${settings.selectedRepository.fullName} / ${settings.selectedBranch.name}`;

  if (!settings.autoSyncEnabled) {
    return {
      label: "Auto Sync off",
      detail: `Configured for ${target}. Accepted submissions will not create commits.`,
      tone: "warning"
    };
  }

  switch (settings.connectionStatus.code) {
    case "connected":
    case "branch_created":
      return {
        label: "Ready to sync",
        detail: target,
        tone: "success"
      };
    case "not_tested":
      return {
        label: "Connection not tested",
        detail: `${target}. Run a connection test in Options.`,
        tone: "neutral"
      };
    case "testing":
      return {
        label: "Testing connection",
        detail: target,
        tone: "neutral"
      };
    case "no_accessible_repositories":
      return statusFromConnection("No owned repositories", settings, "warning");
    case "repository_not_found":
      return statusFromConnection("Repository not found", settings, "error");
    case "branch_not_found":
      return statusFromConnection("Branch not found", settings, "error");
    case "branch_create_failed":
      return statusFromConnection("Branch create failed", settings, "error");
    case "auth_failed":
      return statusFromConnection("Auth failed", settings, "error");
    case "token_expired":
      return statusFromConnection("Token expired", settings, "error");
    case "rate_limited":
      return statusFromConnection("Rate limited", settings, "warning");
    case "network_failed":
      return statusFromConnection("Network failed", settings, "warning");
  }
}

export function buildHistoryDisplayModel(
  records: SyncRecord[],
  retryPayloads: RetryPayloadSummary[],
  nowMs = Date.now()
): PopupHistoryModel {
  const retryPayloadIds = new Set(retryPayloads.map((payload) => payload.id));
  const items = [...records]
    .sort(compareRecordsByUpdatedAtDescending)
    .slice(0, HISTORY_LIMIT)
    .map((record) => toHistoryItem(record, retryPayloadIds, nowMs));

  return {
    items,
    emptyText: "Accepted submissions will appear here after sync runs."
  };
}

export function getFailureDetail(record: SyncRecord): FailureDetailView | null {
  if (record.error === null) {
    return null;
  }

  const detailLines = [`Code: ${record.error.code}`];

  if (record.error.debugMessage !== null && record.error.debugMessage.length > 0) {
    detailLines.push(`Detail: ${record.error.debugMessage}`);
  }

  if (record.retryPayloadId === null && record.status === "failed") {
    detailLines.push("Retry payload is unavailable. Check Options or submit again.");
  }

  return {
    summary: record.error.userMessage,
    detailLines
  };
}

function createInitialState(): PopupRuntimeState {
  return {
    settings: null,
    historyRecords: [],
    retryPayloads: [],
    loading: true,
    savingAutoSync: false,
    retryingPayloadIds: new Set(),
    expandedRecordId: null,
    message: EMPTY_MESSAGE
  };
}

async function initPopupPage(): Promise<void> {
  const elements = collectElements();
  const state = createInitialState();

  elements.status.dataset.app = APP_NAME;
  bindEvents(elements, state);
  bindRuntimeUpdates(elements, state);
  render(elements, state);

  await refreshPopupData(elements, state);
}

function bindEvents(elements: PopupElements, state: PopupRuntimeState): void {
  elements.openOptionsButton.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });

  elements.autoSyncToggle.addEventListener("change", () => {
    void updateAutoSync(elements, state, elements.autoSyncToggle.checked);
  });
}

function bindRuntimeUpdates(elements: PopupElements, state: PopupRuntimeState): void {
  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === "history:updated") {
      state.historyRecords = message.payload.history.records;
      void refreshRetryPayloads(elements, state);
      render(elements, state);
    }

    if (message.type === "sync:status" && message.payload.record !== null) {
      state.message = {
        text: getStatusLabel(message.payload.status),
        tone: getStatusTone(message.payload.status)
      };
      render(elements, state);
    }
  });
}

async function refreshPopupData(
  elements: PopupElements,
  state: PopupRuntimeState
): Promise<void> {
  state.loading = true;
  state.message = EMPTY_MESSAGE;
  render(elements, state);

  try {
    const [settings, history, retryPayloads] = await Promise.all([
      sendRuntimeMessage<PublicSettingsState>({
        type: "settings:read"
      }),
      sendRuntimeMessage<SyncRecord[]>({
        type: "history:read",
        payload: {
          limit: HISTORY_LIMIT
        }
      }),
      sendRuntimeMessage<RetryPayloadSummary[]>({
        type: "retry-payloads:read"
      })
    ]);

    if (!settings.ok) {
      throw settings.error;
    }

    if (!history.ok) {
      throw history.error;
    }

    if (!retryPayloads.ok) {
      throw retryPayloads.error;
    }

    state.settings = settings.data;
    state.historyRecords = history.data;
    state.retryPayloads = retryPayloads.data;
  } catch (error) {
    state.message = {
      text: normalizeError(error).userMessage,
      tone: "error"
    };
  } finally {
    state.loading = false;
    render(elements, state);
  }
}

async function refreshRetryPayloads(
  elements: PopupElements,
  state: PopupRuntimeState
): Promise<void> {
  const response = await sendRuntimeMessage<RetryPayloadSummary[]>({
    type: "retry-payloads:read"
  });

  if (response.ok) {
    state.retryPayloads = response.data;
    render(elements, state);
  }
}

async function updateAutoSync(
  elements: PopupElements,
  state: PopupRuntimeState,
  enabled: boolean
): Promise<void> {
  state.savingAutoSync = true;
  state.message = {
    text: enabled ? "Turning Auto Sync on..." : "Turning Auto Sync off...",
    tone: "neutral"
  };
  render(elements, state);

  try {
    const response = await sendRuntimeMessage<PublicSettingsState>(
      createAutoSyncToggleMessage(enabled)
    );

    if (!response.ok) {
      throw response.error;
    }

    state.settings = response.data;
    state.message = {
      text: enabled ? "Auto Sync enabled." : "Auto Sync disabled.",
      tone: enabled ? "success" : "warning"
    };
  } catch (error) {
    state.message = {
      text: normalizeError(error).userMessage,
      tone: "error"
    };
  } finally {
    state.savingAutoSync = false;
    render(elements, state);
  }
}

async function retrySync(
  elements: PopupElements,
  state: PopupRuntimeState,
  retryPayloadId: string
): Promise<void> {
  state.retryingPayloadIds.add(retryPayloadId);
  state.message = {
    text: "Retrying sync...",
    tone: "neutral"
  };
  render(elements, state);

  try {
    const response = await sendRuntimeMessage({
      type: "sync:retry",
      payload: {
        retryPayloadId
      }
    });

    if (!response.ok) {
      throw response.error;
    }

    await refreshPopupData(elements, state);
  } catch (error) {
    state.message = {
      text: normalizeError(error).userMessage,
      tone: "error"
    };
  } finally {
    state.retryingPayloadIds.delete(retryPayloadId);
    render(elements, state);
  }
}

function render(elements: PopupElements, state: PopupRuntimeState): void {
  elements.status.textContent = state.loading
    ? "Loading..."
    : state.message.text.length > 0
      ? state.message.text
      : "Ready";
  elements.status.className = `status-text ${state.message.tone}`;

  const setup = getSetupStatusView(state.settings);
  elements.setupSummary.className = `status-box ${setup.tone}`;
  elements.setupSummary.textContent = `${setup.label}. ${setup.detail}`;

  elements.autoSyncToggle.checked = state.settings?.autoSyncEnabled ?? false;
  elements.autoSyncToggle.disabled = state.loading || state.savingAutoSync;
  elements.autoSyncCopy.textContent =
    state.settings?.autoSyncEnabled === true
      ? "Accepted submissions sync automatically."
      : "Accepted submissions will not create commits.";
  renderInlineMessage(elements.autoSyncStatus, state.message);

  const model = buildHistoryDisplayModel(
    state.historyRecords,
    state.retryPayloads
  );
  elements.historyCount.textContent =
    model.items.length === 1 ? "1 record" : `${model.items.length} records`;
  elements.historyEmpty.hidden = model.items.length > 0;
  elements.historyEmpty.textContent = model.emptyText;
  renderHistoryList(elements, state, model);
}

function renderHistoryList(
  elements: PopupElements,
  state: PopupRuntimeState,
  model: PopupHistoryModel
): void {
  elements.historyList.replaceChildren(
    ...model.items.map((item) => createHistoryElement(elements, state, item))
  );
}

function createHistoryElement(
  elements: PopupElements,
  state: PopupRuntimeState,
  item: PopupHistoryItem
): HTMLLIElement {
  const entry = document.createElement("li");
  entry.className = `history-item ${item.tone}`;

  const header = document.createElement("div");
  header.className = "history-header";

  const titleBlock = document.createElement("div");
  titleBlock.className = "history-title-block";

  const title = document.createElement("h3");
  title.textContent = item.title;

  const meta = document.createElement("p");
  meta.className = "history-meta";
  meta.textContent = item.meta;

  titleBlock.append(title, meta);

  const badge = document.createElement("span");
  badge.className = `status-badge ${item.tone}`;
  badge.textContent = item.statusLabel;

  header.append(titleBlock, badge);
  entry.append(header);

  const detailText = item.failure?.summary ?? item.unsupportedReason;
  if (detailText !== null) {
    const detail = document.createElement("p");
    detail.className = "history-detail";
    detail.textContent = detailText;
    entry.append(detail);
  }

  const links = createLinksRow(item);
  if (links !== null) {
    entry.append(links);
  }

  const controls = createControlsRow(elements, state, item);
  if (controls !== null) {
    entry.append(controls);
  }

  if (state.expandedRecordId === item.id && item.failure !== null) {
    entry.append(createFailureDetailPanel(item.failure));
  }

  return entry;
}

function createLinksRow(item: PopupHistoryItem): HTMLDivElement | null {
  const links: HTMLAnchorElement[] = [];

  if (item.commitUrl !== null) {
    links.push(createExternalLink(item.commitUrl, "Commit"));
  }

  if (item.fileUrl !== null) {
    links.push(createExternalLink(item.fileUrl, "File"));
  }

  if (links.length === 0) {
    return null;
  }

  const row = document.createElement("div");
  row.className = "link-row";
  row.append(...links);

  return row;
}

function createControlsRow(
  elements: PopupElements,
  state: PopupRuntimeState,
  item: PopupHistoryItem
): HTMLDivElement | null {
  if (item.failure === null) {
    return null;
  }

  const row = document.createElement("div");
  row.className = "control-row";

  const detailsButton = document.createElement("button");
  detailsButton.className = "button secondary compact";
  detailsButton.type = "button";
  detailsButton.textContent =
    state.expandedRecordId === item.id ? "Hide details" : "Details";
  detailsButton.addEventListener("click", () => {
    state.expandedRecordId = state.expandedRecordId === item.id ? null : item.id;
    render(elements, state);
  });
  row.append(detailsButton);

  if (item.canRetry && item.retryPayloadId !== null) {
    const retryButton = document.createElement("button");
    const retrying = state.retryingPayloadIds.has(item.retryPayloadId);
    retryButton.className = "button primary compact";
    retryButton.type = "button";
    retryButton.disabled = retrying;
    retryButton.textContent = retrying ? "Retrying..." : "Retry";
    retryButton.addEventListener("click", () => {
      if (item.retryPayloadId !== null) {
        void retrySync(elements, state, item.retryPayloadId);
      }
    });
    row.append(retryButton);
  }

  return row;
}

function createFailureDetailPanel(failure: FailureDetailView): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "failure-detail";

  const list = document.createElement("ul");
  for (const line of failure.detailLines) {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }

  panel.append(list);
  return panel;
}

function createExternalLink(url: string, label: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;

  return link;
}

function toHistoryItem(
  record: SyncRecord,
  retryPayloadIds: Set<string>,
  nowMs: number
): PopupHistoryItem {
  const retryPayloadId = record.retryPayloadId;
  const canRetry =
    record.status === "failed" &&
    retryPayloadId !== null &&
    retryPayloadIds.has(retryPayloadId);

  return {
    id: record.id,
    status: record.status,
    title: getRecordTitle(record),
    languageLabel: getLanguageLabel(record),
    meta: getRecordMeta(record, nowMs),
    timeLabel: formatRelativeTime(record.updatedAt, nowMs),
    statusLabel: getStatusLabel(record.status),
    tone: getStatusTone(record.status),
    commitUrl: record.commitUrl,
    fileUrl: record.fileUrl,
    failure: record.status === "failed" ? getFailureDetail(record) : null,
    unsupportedReason:
      record.status === "unsupported_language"
        ? "No commit was created. Swift and Python3 are supported."
        : null,
    retryPayloadId,
    canRetry
  };
}

function getRecordTitle(record: SyncRecord): string {
  if (record.problemTitle !== null && record.problemFrontendId !== null) {
    return `${record.problemFrontendId}. ${record.problemTitle}`;
  }

  return record.problemTitle ?? record.titleSlug;
}

function getRecordMeta(record: SyncRecord, nowMs: number): string {
  const parts = [getLanguageLabel(record), formatRelativeTime(record.updatedAt, nowMs)];

  if (record.repository !== null && record.branchName !== null) {
    parts.push(`${record.repository.fullName}@${record.branchName}`);
  }

  return parts.join(" / ");
}

function getLanguageLabel(record: SyncRecord): string {
  if (record.supportedLanguage === "python3") {
    return "Python3";
  }

  if (record.supportedLanguage === "swift") {
    return "Swift";
  }

  return record.language.length > 0 ? record.language : "Unknown language";
}

function getStatusLabel(status: SyncStatus): string {
  switch (status) {
    case "setup_required":
      return "Setup required";
    case "auto_sync_disabled":
      return "Auto Sync off";
    case "syncing":
      return "Syncing";
    case "synced":
      return "Synced";
    case "unsupported_language":
      return "Unsupported language";
    case "failed":
      return "Failed";
    case "retrying":
      return "Retrying";
  }
}

function getStatusTone(status: SyncStatus): Tone {
  switch (status) {
    case "synced":
      return "success";
    case "setup_required":
    case "auto_sync_disabled":
    case "unsupported_language":
      return "warning";
    case "failed":
      return "error";
    case "syncing":
    case "retrying":
      return "neutral";
  }
}

function formatRelativeTime(value: string, nowMs: number): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Unknown time";
  }

  const diffMs = Math.max(0, nowMs - timestamp);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays}d ago`;
}

function compareRecordsByUpdatedAtDescending(
  left: SyncRecord,
  right: SyncRecord
): number {
  return parseRecordTimestamp(right) - parseRecordTimestamp(left);
}

function parseRecordTimestamp(record: SyncRecord): number {
  const updatedAt = Date.parse(record.updatedAt);

  if (Number.isFinite(updatedAt)) {
    return updatedAt;
  }

  const createdAt = Date.parse(record.createdAt);

  return Number.isFinite(createdAt) ? createdAt : 0;
}

function statusFromConnection(
  label: string,
  settings: PublicSettingsState,
  tone: Tone
): PopupSetupStatusView {
  return {
    label,
    detail:
      settings.connectionStatus.error?.userMessage ??
      "Open Options to check the saved GitHub connection.",
    tone
  };
}

function renderInlineMessage(element: HTMLParagraphElement, message: InlineMessage): void {
  element.className = `field-message ${message.tone === "neutral" ? "" : message.tone}`.trim();
  element.textContent = message.text;
}

function collectElements(): PopupElements {
  return {
    status: requireElement("popup-status", HTMLParagraphElement),
    setupSummary: requireElement("setup-summary", HTMLDivElement),
    autoSyncToggle: requireElement("auto-sync-toggle", HTMLInputElement),
    autoSyncCopy: requireElement("auto-sync-copy", HTMLElement),
    autoSyncStatus: requireElement("auto-sync-status", HTMLParagraphElement),
    openOptionsButton: requireElement("open-options", HTMLButtonElement),
    historyCount: requireElement("history-count", HTMLParagraphElement),
    historyEmpty: requireElement("history-empty", HTMLParagraphElement),
    historyList: requireElement("history-list", HTMLUListElement)
  };
}

function requireElement<T extends HTMLElement>(
  id: string,
  constructor: { new (...args: never[]): T }
): T {
  const element = document.getElementById(id);

  if (!(element instanceof constructor)) {
    throw new Error(`Missing popup element: ${id}`);
  }

  return element;
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

if (typeof document !== "undefined") {
  void initPopupPage();
}
