import {
  APP_NAME,
  DEFAULT_UI_LANGUAGE,
  getFailureDetailView as getSharedFailureDetailView,
  getPlatformLabel,
  getSetupStatusView as getSharedSetupStatusView,
  getSyncRecordLanguageLabel,
  getSyncStatusLabel,
  getSyncStatusTone,
  getUnsupportedLanguageReason,
  normalizeError,
  resolveUiLocale,
  t,
  type FailureDetailView,
  type NormalizedError,
  type PublicSettingsState,
  type RetryPayloadSummary,
  type RuntimeMessage,
  type SetupStatusView,
  type SyncRecord,
  type SyncStatus,
  type Tone,
  type UiLocale
} from "../shared";

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

export type PopupSetupStatusView = SetupStatusView;

export interface PopupHistoryItem {
  id: string;
  status: SyncStatus;
  platformLabel: string;
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
  return getSharedSetupStatusView("en", settings);
}

export function buildHistoryDisplayModel(
  records: SyncRecord[],
  retryPayloads: RetryPayloadSummary[],
  nowMs = Date.now(),
  locale: UiLocale = "en"
): PopupHistoryModel {
  const retryPayloadIds = new Set(retryPayloads.map((payload) => payload.id));
  const items = [...records]
    .sort(compareRecordsByUpdatedAtDescending)
    .slice(0, HISTORY_LIMIT)
    .map((record) => toHistoryItem(record, retryPayloadIds, nowMs, locale));

  return {
    items,
    emptyText: t(locale, "history.empty")
  };
}

export function getFailureDetail(record: SyncRecord): FailureDetailView | null {
  return getSharedFailureDetailView("en", record);
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
      const locale = getPopupLocale(state.settings);
      state.message = {
        text: getSyncStatusLabel(locale, message.payload.status),
        tone: getSyncStatusTone(message.payload.status)
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
  const locale = getPopupLocale(state.settings);

  elements.status.textContent = state.loading
    ? "Loading..."
    : state.message.text.length > 0
      ? state.message.text
      : "Ready";
  elements.status.className = `status-text ${state.message.tone}`;

  const setup = getSharedSetupStatusView(locale, state.settings);
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
    state.retryPayloads,
    Date.now(),
    locale
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
  nowMs: number,
  locale: UiLocale
): PopupHistoryItem {
  const retryPayloadId = record.retryPayloadId;
  const canRetry =
    record.status === "failed" &&
    retryPayloadId !== null &&
    retryPayloadIds.has(retryPayloadId) &&
    record.error?.retryable !== false;

  return {
    id: record.id,
    status: record.status,
    platformLabel: getPlatformLabel(record.platform),
    title: getRecordTitle(record),
    languageLabel: getSyncRecordLanguageLabel(locale, record),
    meta: getRecordMeta(record, nowMs, locale),
    timeLabel: formatRelativeTime(record.updatedAt, nowMs),
    statusLabel: getSyncStatusLabel(locale, record.status),
    tone: getSyncStatusTone(record.status),
    commitUrl: record.commitUrl,
    fileUrl: record.fileUrl,
    failure: record.status === "failed" ? getSharedFailureDetailView(locale, record) : null,
    unsupportedReason:
      record.status === "unsupported_language"
        ? getUnsupportedLanguageReason(locale)
        : null,
    retryPayloadId,
    canRetry
  };
}

function getRecordTitle(record: SyncRecord): string {
  const title = record.problemTitle?.trim() ?? "";
  const frontendId = record.problemFrontendId?.trim() ?? "";
  const titleSlug = record.titleSlug.trim();

  if (title.length > 0 && frontendId.length > 0) {
    return `${frontendId}. ${title}`;
  }

  if (title.length > 0) {
    return title;
  }

  if (titleSlug.length > 0) {
    return titleSlug;
  }

  if (frontendId.length > 0) {
    return `${getPlatformLabel(record.platform)} ${frontendId}`;
  }

  return `${getPlatformLabel(record.platform)} submission`;
}

function getRecordMeta(record: SyncRecord, nowMs: number, locale: UiLocale): string {
  const parts = [
    getPlatformLabel(record.platform),
    getSyncRecordLanguageLabel(locale, record),
    formatRelativeTime(record.updatedAt, nowMs)
  ];

  if (record.repository !== null && record.branchName !== null) {
    parts.push(`${record.repository.fullName}@${record.branchName}`);
  }

  return parts.join(" / ");
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

function renderInlineMessage(element: HTMLParagraphElement, message: InlineMessage): void {
  element.className = `field-message ${message.tone === "neutral" ? "" : message.tone}`.trim();
  element.textContent = message.text;
}

function getPopupLocale(settings: PublicSettingsState | null): UiLocale {
  return resolveUiLocale(settings?.uiLanguage ?? DEFAULT_UI_LANGUAGE, getBrowserLanguage());
}

function getBrowserLanguage(): string | null {
  return typeof navigator === "undefined" ? null : navigator.language;
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
