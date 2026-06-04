import {
  APP_NAME,
  DEFAULT_UI_LANGUAGE,
  RETRY_BUNDLES_READ_TYPE,
  SYNC_HISTORY_READ_TYPE,
  SYNC_HISTORY_UPDATED_TYPE,
  getConnectionStatusView as getSharedConnectionStatusView,
  getFailureDetailView as getSharedFailureDetailView,
  getPlatformLabel,
  getSetupStatusView as getSharedSetupStatusView,
  getSyncHistoryEntryLanguageLabel,
  getSyncStatusLabel,
  getSyncStatusSemanticTone,
  getSyncStatusTone,
  getUnsupportedLanguageReason,
  normalizeError,
  resolveUiLocale,
  t,
  type FailureDetailView,
  type I18nKey,
  type NormalizedError,
  type PublicSettingsState,
  type RetryBundleSummary,
  type RuntimeMessage,
  type SemanticStateTone,
  type SetupStatusView,
  type SyncHistoryEntry,
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
  i18nKey?: I18nKey;
  i18nParams?: Record<string, string | number>;
}

export type PopupSetupStatusView = SetupStatusView;

export interface PopupHistoryItem {
  id: string;
  groupKey: string;
  languageKey: string;
  status: SyncStatus;
  platformLabel: string;
  title: string;
  languageLabel: string;
  meta: string;
  entryMeta: string;
  timeLabel: string;
  statusLabel: string;
  tone: SemanticStateTone;
  commitUrl: string | null;
  fileUrl: string | null;
  failure: FailureDetailView | null;
  failureCode: NormalizedError["code"] | null;
  unsupportedReason: string | null;
  recoveryHint: string | null;
  retryBundleId: string | null;
  canRetry: boolean;
}

export interface PopupHistoryBatch {
  id: string;
  count: number;
  summary: string;
  retryBundleIds: string[];
  entryIds: string[];
}

export interface PopupHistoryGroup {
  id: string;
  platformLabel: string;
  title: string;
  meta: string;
  tone: SemanticStateTone;
  errorBatches: PopupHistoryBatch[];
  entries: PopupHistoryItem[];
}

export interface PopupHistoryModel {
  items: PopupHistoryItem[];
  groups: PopupHistoryGroup[];
  entryCount: number;
  emptyText: string;
}

interface PopupRuntimeState {
  settings: PublicSettingsState | null;
  syncHistoryEntries: SyncHistoryEntry[];
  retryBundles: RetryBundleSummary[];
  loading: boolean;
  savingAutoSync: boolean;
  retryingBundleIds: Set<string>;
  expandedSyncHistoryEntryId: string | null;
  message: InlineMessage;
}

interface PopupElements {
  status: HTMLParagraphElement;
  setupCard: HTMLElement;
  setupMarker: HTMLDivElement;
  setupTitle: HTMLHeadingElement;
  setupDetail: HTMLParagraphElement;
  autoSyncToggle: HTMLInputElement;
  autoSyncCopy: HTMLElement;
  autoSyncStatus: HTMLParagraphElement;
  openOptionsButton: HTMLButtonElement;
  connectionSummary: HTMLElement;
  connectionDetail: HTMLElement;
  repositorySummary: HTMLElement;
  branchSummary: HTMLElement;
  historyCount: HTMLParagraphElement;
  historyEmpty: HTMLParagraphElement;
  historyList: HTMLUListElement;
}

const HISTORY_LIMIT = 20;
const EMPTY_MESSAGE: InlineMessage = {
  text: "",
  tone: "neutral"
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
  settings: PublicSettingsState | null,
  locale: UiLocale = "en"
): PopupSetupStatusView {
  return getSharedSetupStatusView(locale, settings);
}

export function buildHistoryDisplayModel(
  syncHistoryEntries: SyncHistoryEntry[],
  retryBundles: RetryBundleSummary[],
  nowMs = Date.now(),
  locale: UiLocale = "en"
): PopupHistoryModel {
  const retryBundleIds = new Set(retryBundles.map((bundle) => bundle.id));
  const items = [...syncHistoryEntries]
    .sort(compareSyncHistoryEntriesByUpdatedAtDescending)
    .slice(0, HISTORY_LIMIT)
    .map((entry) => toHistoryItem(entry, retryBundleIds, nowMs, locale));

  return {
    items,
    groups: groupHistoryItems(items, locale),
    entryCount: items.length,
    emptyText: t(locale, "history.empty")
  };
}

export function getFailureDetail(
  syncHistoryEntry: SyncHistoryEntry,
  locale: UiLocale = "en"
): FailureDetailView | null {
  return getSharedFailureDetailView(locale, syncHistoryEntry);
}

function createInitialState(): PopupRuntimeState {
  return {
    settings: null,
    syncHistoryEntries: [],
    retryBundles: [],
    loading: true,
    savingAutoSync: false,
    retryingBundleIds: new Set(),
    expandedSyncHistoryEntryId: null,
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
    if (message.type === SYNC_HISTORY_UPDATED_TYPE) {
      state.syncHistoryEntries = message.payload.syncHistory.entries;
      void refreshRetryBundles(elements, state);
      render(elements, state);
    }

    if (message.type === "sync:status" && message.payload.syncHistoryEntry !== null) {
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
    const [settings, history, retryBundles] = await Promise.all([
      sendRuntimeMessage<PublicSettingsState>({
        type: "settings:read"
      }),
      sendRuntimeMessage<SyncHistoryEntry[]>({
        type: SYNC_HISTORY_READ_TYPE,
        payload: {
          limit: HISTORY_LIMIT
        }
      }),
      sendRuntimeMessage<RetryBundleSummary[]>({
        type: RETRY_BUNDLES_READ_TYPE
      })
    ]);

    if (!settings.ok) {
      throw settings.error;
    }

    if (!history.ok) {
      throw history.error;
    }

    if (!retryBundles.ok) {
      throw retryBundles.error;
    }

    state.settings = settings.data;
    state.syncHistoryEntries = history.data;
    state.retryBundles = retryBundles.data;
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

async function refreshRetryBundles(
  elements: PopupElements,
  state: PopupRuntimeState
): Promise<void> {
  const response = await sendRuntimeMessage<RetryBundleSummary[]>({
    type: RETRY_BUNDLES_READ_TYPE
  });

  if (response.ok) {
    state.retryBundles = response.data;
    render(elements, state);
  }
}

async function updateAutoSync(
  elements: PopupElements,
  state: PopupRuntimeState,
  enabled: boolean
): Promise<void> {
  state.savingAutoSync = true;
  state.message = localizedMessage(
    enabled ? "popup.message.autoSyncTurningOn" : "popup.message.autoSyncTurningOff",
    "neutral"
  );
  render(elements, state);

  try {
    const response = await sendRuntimeMessage<PublicSettingsState>(
      createAutoSyncToggleMessage(enabled)
    );

    if (!response.ok) {
      throw response.error;
    }

    state.settings = response.data;
    state.message = localizedMessage(
      enabled ? "popup.message.autoSyncEnabled" : "popup.message.autoSyncDisabled",
      enabled ? "success" : "warning"
    );
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
  retryBundleId: string
): Promise<void> {
  state.retryingBundleIds.add(retryBundleId);
  state.message = localizedMessage("toast.retryingTitle", "neutral");
  render(elements, state);

  try {
    const response = await sendRuntimeMessage({
      type: "sync:retry",
      payload: {
        retryBundleId
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
    state.retryingBundleIds.delete(retryBundleId);
    render(elements, state);
  }
}

async function retryAllSync(
  elements: PopupElements,
  state: PopupRuntimeState,
  retryBundleIds: string[]
): Promise<void> {
  const uniqueRetryBundleIds = [...new Set(retryBundleIds)];

  if (uniqueRetryBundleIds.length === 0) {
    return;
  }

  for (const retryBundleId of uniqueRetryBundleIds) {
    state.retryingBundleIds.add(retryBundleId);
  }

  state.message = localizedMessage("toast.retryingTitle", "neutral");
  render(elements, state);

  let firstError: NormalizedError | null = null;

  try {
    for (const retryBundleId of uniqueRetryBundleIds) {
      const response = await sendRuntimeMessage<unknown>({
        type: "sync:retry",
        payload: {
          retryBundleId
        }
      });

      if (!response.ok && firstError === null) {
        firstError = response.error;
      }
    }

    await refreshPopupData(elements, state);

    if (firstError !== null) {
      state.message = {
        text: firstError.userMessage,
        tone: "error"
      };
    }
  } catch (error) {
    state.message = {
      text: normalizeError(error).userMessage,
      tone: "error"
    };
  } finally {
    for (const retryBundleId of uniqueRetryBundleIds) {
      state.retryingBundleIds.delete(retryBundleId);
    }

    render(elements, state);
  }
}

function render(elements: PopupElements, state: PopupRuntimeState): void {
  const locale = getPopupLocale(state.settings);
  document.documentElement.lang = locale;
  document.title = t(locale, "popup.page.title");
  renderStaticText(locale);

  elements.status.textContent = state.loading
    ? t(locale, "popup.status.loading")
    : hasInlineMessage(state.message)
      ? resolveInlineMessage(state.message, locale)
      : t(locale, "popup.status.ready");
  elements.status.className = `status-text ${state.message.tone}`;

  const setup = getSharedSetupStatusView(locale, state.settings);
  renderStatusCard(elements, setup);

  elements.autoSyncToggle.checked = state.settings?.autoSyncEnabled ?? false;
  elements.autoSyncToggle.disabled = state.loading || state.savingAutoSync;
  elements.autoSyncCopy.textContent =
    state.settings?.autoSyncEnabled === true
      ? t(locale, "popup.autoSync.on")
      : t(locale, "popup.autoSync.off");
  renderInlineMessage(elements.autoSyncStatus, state.message, locale);
  renderSettingsSummary(elements, state.settings, locale);

  const model = buildHistoryDisplayModel(
    state.syncHistoryEntries,
    state.retryBundles,
    Date.now(),
    locale
  );
  elements.historyCount.textContent = t(
    locale,
    model.entryCount === 1 ? "history.countOne" : "history.count",
    {
      count: model.entryCount
    }
  );
  elements.historyEmpty.hidden = model.entryCount > 0;
  elements.historyEmpty.textContent = model.emptyText;
  renderHistoryList(elements, state, model, locale);
}

function renderHistoryList(
  elements: PopupElements,
  state: PopupRuntimeState,
  model: PopupHistoryModel,
  locale: UiLocale
): void {
  elements.historyList.replaceChildren(
    ...model.groups.map((group) =>
      createHistoryGroupElement(elements, state, group, locale)
    )
  );
}

function createHistoryGroupElement(
  elements: PopupElements,
  state: PopupRuntimeState,
  group: PopupHistoryGroup,
  locale: UiLocale
): HTMLLIElement {
  const entry = document.createElement("li");
  entry.className = `history-item history-problem-group ${group.tone}`;

  const header = document.createElement("div");
  header.className = "history-header history-problem-header";

  const titleBlock = document.createElement("div");
  titleBlock.className = "history-title-block";

  const title = document.createElement("h3");
  title.textContent = group.title;

  const meta = document.createElement("p");
  meta.className = "history-meta";
  meta.textContent = group.meta;

  titleBlock.append(title, meta);
  header.append(titleBlock);
  entry.append(header);

  if (group.errorBatches.length > 0) {
    const batchList = document.createElement("div");
    batchList.className = "history-batch-list";
    batchList.append(
      ...group.errorBatches.map((batch) =>
        createHistoryErrorBatchElement(elements, state, batch, locale)
      )
    );
    entry.append(batchList);
  }

  const entryList = document.createElement("div");
  entryList.className = "history-entry-list";
  entryList.append(
    ...group.entries.map((item) =>
      createHistoryEntryRow(elements, state, item, locale)
    )
  );
  entry.append(entryList);

  return entry;
}

function createHistoryErrorBatchElement(
  elements: PopupElements,
  state: PopupRuntimeState,
  batch: PopupHistoryBatch,
  locale: UiLocale
): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "history-error-batch";

  const summary = document.createElement("p");
  summary.className = "history-error-batch-summary";
  summary.textContent = batch.summary;

  const retrying = batch.retryBundleIds.some((retryBundleId) =>
    state.retryingBundleIds.has(retryBundleId)
  );
  const retryButton = document.createElement("button");
  retryButton.className = "button primary compact history-retry-all-button";
  retryButton.type = "button";
  retryButton.disabled = retrying;
  retryButton.textContent = retrying
    ? t(locale, "status.retrying")
    : t(locale, "action.retryAll");
  retryButton.addEventListener("click", () => {
    void retryAllSync(elements, state, batch.retryBundleIds);
  });

  panel.append(summary, retryButton);
  return panel;
}

function createHistoryEntryRow(
  elements: PopupElements,
  state: PopupRuntimeState,
  item: PopupHistoryItem,
  locale: UiLocale
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = `history-entry-row history-language-row history-sync-entry ${item.tone}`;

  const main = document.createElement("div");
  main.className = "history-entry-main";

  const summary = document.createElement("div");
  summary.className = "history-entry-summary";

  const language = createLanguageBadge(item.languageLabel);

  const badge = document.createElement("span");
  badge.className = `status-badge ${item.tone}`;
  badge.textContent = item.statusLabel;

  summary.append(language, badge);

  main.append(summary);

  const links = createLinksRow(item, locale);
  if (links !== null) {
    main.append(links);
  }

  row.append(main);

  const meta = document.createElement("p");
  meta.className = "history-meta history-entry-footer";
  meta.textContent = item.entryMeta;
  row.append(meta);

  const detailText = item.failure?.summary ?? item.unsupportedReason;
  if (detailText !== null) {
    const detail = document.createElement("p");
    detail.className = "history-detail";
    detail.textContent = detailText;
    row.append(detail);
  }

  if (item.recoveryHint !== null) {
    const hint = document.createElement("p");
    hint.className = "history-recovery";
    hint.textContent = item.recoveryHint;
    row.append(hint);
  }

  const controls = createControlsRow(elements, state, item, locale);
  if (controls !== null) {
    row.append(controls);
  }

  if (state.expandedSyncHistoryEntryId === item.id && item.failure !== null) {
    row.append(createFailureDetailPanel(item.failure));
  }

  return row;
}

function createLanguageBadge(language: string): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = "language-badge";
  badge.textContent = language;
  badge.title = language;

  return badge;
}

function createLinksRow(item: PopupHistoryItem, locale: UiLocale): HTMLDivElement | null {
  const links: HTMLAnchorElement[] = [];

  if (item.commitUrl !== null) {
    links.push(createExternalLink(item.commitUrl, t(locale, "action.commit")));
  }

  if (item.fileUrl !== null) {
    links.push(createExternalLink(item.fileUrl, t(locale, "action.file")));
  }

  if (links.length === 0) {
    return null;
  }

  const row = document.createElement("div");
  row.className = "history-entry-links history-entry-actions";
  row.append(...links);

  return row;
}

function createControlsRow(
  elements: PopupElements,
  state: PopupRuntimeState,
  item: PopupHistoryItem,
  locale: UiLocale
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
    state.expandedSyncHistoryEntryId === item.id
      ? t(locale, "action.hideDetails")
      : t(locale, "action.details");
  detailsButton.addEventListener("click", () => {
    state.expandedSyncHistoryEntryId =
      state.expandedSyncHistoryEntryId === item.id ? null : item.id;
    render(elements, state);
  });
  row.append(detailsButton);

  if (item.canRetry && item.retryBundleId !== null) {
    const retryButton = document.createElement("button");
    const retrying = state.retryingBundleIds.has(item.retryBundleId);
    retryButton.className = "button primary compact";
    retryButton.type = "button";
    retryButton.disabled = retrying;
    retryButton.textContent = retrying
      ? t(locale, "status.retrying")
      : t(locale, "action.retry");
    retryButton.addEventListener("click", () => {
      if (item.retryBundleId !== null) {
        void retrySync(elements, state, item.retryBundleId);
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
  link.className = "history-link history-link-pill";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;

  return link;
}

function toHistoryItem(
  syncHistoryEntry: SyncHistoryEntry,
  retryBundleIds: Set<string>,
  nowMs: number,
  locale: UiLocale
): PopupHistoryItem {
  const retryBundleId = syncHistoryEntry.retryBundleId;
  const canRetry =
    syncHistoryEntry.status === "failed" &&
    retryBundleId !== null &&
    retryBundleIds.has(retryBundleId) &&
    syncHistoryEntry.error?.retryable !== false;
  const failure =
    syncHistoryEntry.status === "failed"
      ? getSharedFailureDetailView(locale, syncHistoryEntry)
      : null;

  return {
    id: syncHistoryEntry.id,
    groupKey: getSyncHistoryGroupKey(syncHistoryEntry),
    languageKey: getSyncHistoryLanguageKey(syncHistoryEntry),
    status: syncHistoryEntry.status,
    platformLabel: getPlatformLabel(syncHistoryEntry.codingPlatform),
    title: getSyncHistoryEntryTitle(syncHistoryEntry, locale),
    languageLabel: getSyncHistoryEntryLanguageLabel(locale, syncHistoryEntry),
    meta: getSyncHistoryEntryMeta(syncHistoryEntry, nowMs, locale),
    entryMeta: getSyncHistoryEntryRowMeta(syncHistoryEntry, nowMs, locale),
    timeLabel: formatRelativeTime(syncHistoryEntry.updatedAt, nowMs, locale),
    statusLabel: getSyncStatusLabel(locale, syncHistoryEntry.status),
    tone: getSyncStatusSemanticTone(syncHistoryEntry.status),
    commitUrl: syncHistoryEntry.commitUrl,
    fileUrl: syncHistoryEntry.fileUrl,
    failure,
    failureCode:
      syncHistoryEntry.status === "failed"
        ? syncHistoryEntry.error?.code ?? null
        : null,
    unsupportedReason:
      syncHistoryEntry.status === "unsupported_language"
        ? getUnsupportedLanguageReason(locale)
        : null,
    recoveryHint: getHistoryRecoveryHint(
      syncHistoryEntry,
      retryBundleIds,
      canRetry,
      locale
    ),
    retryBundleId,
    canRetry
  };
}

function groupHistoryItems(
  items: PopupHistoryItem[],
  locale: UiLocale
): PopupHistoryGroup[] {
  const groups: PopupHistoryGroup[] = [];
  const groupsByKey = new Map<string, PopupHistoryGroup>();

  for (const item of items) {
    const existingGroup = groupsByKey.get(item.groupKey);

    if (existingGroup === undefined) {
      const group: PopupHistoryGroup = {
        id: item.groupKey,
        platformLabel: item.platformLabel,
        title: item.title,
        meta: getHistoryGroupMeta(item),
        tone: item.tone,
        errorBatches: [],
        entries: []
      };

      groupsByKey.set(item.groupKey, group);
      groups.push(group);
    }

    const group = groupsByKey.get(item.groupKey);

    if (group === undefined) {
      continue;
    }

    if (!group.entries.some((entry) => entry.languageKey === item.languageKey)) {
      group.entries.push(item);
    }
  }

  for (const group of groups) {
    group.errorBatches = buildHistoryErrorBatches(group, locale);
  }

  return groups;
}

function buildHistoryErrorBatches(
  group: PopupHistoryGroup,
  locale: UiLocale
): PopupHistoryBatch[] {
  const batches: PopupHistoryBatch[] = [];
  let currentItems: PopupHistoryItem[] = [];

  const flushCurrentBatch = (): void => {
    if (currentItems.length < 2) {
      currentItems = [];
      return;
    }

    const firstItem = currentItems[0];
    const summary = firstItem?.failure?.summary ?? "";

    batches.push({
      id: `${group.id}:error-batch:${batches.length}`,
      count: currentItems.length,
      summary: t(locale, "history.retryBatchSummary", {
        count: currentItems.length,
        summary
      }),
      retryBundleIds: currentItems
        .map((item) => item.retryBundleId)
        .filter((retryBundleId): retryBundleId is string => retryBundleId !== null),
      entryIds: currentItems.map((item) => item.id)
    });

    currentItems = [];
  };

  for (const item of group.entries) {
    if (!isRetryableBatchItem(item)) {
      flushCurrentBatch();
      continue;
    }

    const firstItem = currentItems[0];

    if (firstItem === undefined || hasSameBatchFailure(firstItem, item)) {
      currentItems.push(item);
      continue;
    }

    flushCurrentBatch();
    currentItems.push(item);
  }

  flushCurrentBatch();

  return batches;
}

function isRetryableBatchItem(item: PopupHistoryItem): boolean {
  return (
    item.status === "failed" &&
    item.canRetry &&
    item.retryBundleId !== null &&
    item.failure !== null &&
    item.failureCode !== null
  );
}

function hasSameBatchFailure(
  left: PopupHistoryItem,
  right: PopupHistoryItem
): boolean {
  return (
    left.failureCode !== null &&
    left.failureCode === right.failureCode &&
    left.failure?.summary === right.failure?.summary
  );
}

function getHistoryGroupMeta(item: PopupHistoryItem): string {
  return [item.platformLabel, item.timeLabel].join(" / ");
}

function getHistoryRecoveryHint(
  syncHistoryEntry: SyncHistoryEntry,
  retryBundleIds: Set<string>,
  canRetry: boolean,
  locale: UiLocale
): string | null {
  if (syncHistoryEntry.status !== "failed" || canRetry) {
    return null;
  }

  if (syncHistoryEntry.error?.code === "programmers_extract_failed") {
    return t(locale, "detail.noCommitDataRetryUnavailable");
  }

  if (
    syncHistoryEntry.retryBundleId === null ||
    !retryBundleIds.has(syncHistoryEntry.retryBundleId)
  ) {
    return t(locale, "detail.retryBundleUnavailable");
  }

  if (syncHistoryEntry.error?.retryable === false) {
    return t(locale, "detail.retryUnavailable");
  }

  return null;
}

function getSyncHistoryGroupKey(syncHistoryEntry: SyncHistoryEntry): string {
  const problemKey =
    syncHistoryEntry.problemFrontendId?.trim() ||
    syncHistoryEntry.titleSlug.trim() ||
    syncHistoryEntry.problemTitle?.trim() ||
    syncHistoryEntry.id;

  return `${syncHistoryEntry.codingPlatform}:${problemKey.toLowerCase()}`;
}

function getSyncHistoryLanguageKey(syncHistoryEntry: SyncHistoryEntry): string {
  const supportedLanguage =
    syncHistoryEntry.syncDeduplicationKey?.language ??
    syncHistoryEntry.supportedLanguage;

  if (supportedLanguage !== null && supportedLanguage !== undefined) {
    return supportedLanguage;
  }

  const language = syncHistoryEntry.language.trim().toLowerCase();
  return language.length > 0 ? language : "unknown";
}

function getSyncHistoryEntryTitle(
  syncHistoryEntry: SyncHistoryEntry,
  locale: UiLocale
): string {
  const title = syncHistoryEntry.problemTitle?.trim() ?? "";
  const frontendId = syncHistoryEntry.problemFrontendId?.trim() ?? "";
  const titleSlug = syncHistoryEntry.titleSlug.trim();

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
    return `${getPlatformLabel(syncHistoryEntry.codingPlatform)} ${frontendId}`;
  }

  return t(locale, "label.platformSubmission", {
    platform: getPlatformLabel(syncHistoryEntry.codingPlatform)
  });
}

function getSyncHistoryEntryMeta(
  syncHistoryEntry: SyncHistoryEntry,
  nowMs: number,
  locale: UiLocale
): string {
  return [
    getPlatformLabel(syncHistoryEntry.codingPlatform),
    formatRelativeTime(syncHistoryEntry.updatedAt, nowMs, locale)
  ].join(" / ");
}

function getSyncHistoryEntryRowMeta(
  syncHistoryEntry: SyncHistoryEntry,
  nowMs: number,
  locale: UiLocale
): string {
  return formatRelativeTime(syncHistoryEntry.updatedAt, nowMs, locale);
}

function formatRelativeTime(value: string, nowMs: number, locale: UiLocale): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return t(locale, "time.unknown");
  }

  const diffMs = Math.max(0, nowMs - timestamp);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return t(locale, "time.justNow");
  }

  if (diffMinutes < 60) {
    return t(locale, "time.minutesAgo", { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return t(locale, "time.hoursAgo", { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);

  return t(locale, "time.daysAgo", { count: diffDays });
}

function compareSyncHistoryEntriesByUpdatedAtDescending(
  left: SyncHistoryEntry,
  right: SyncHistoryEntry
): number {
  return parseSyncHistoryEntryTimestamp(right) - parseSyncHistoryEntryTimestamp(left);
}

function parseSyncHistoryEntryTimestamp(syncHistoryEntry: SyncHistoryEntry): number {
  const updatedAt = Date.parse(syncHistoryEntry.updatedAt);

  if (Number.isFinite(updatedAt)) {
    return updatedAt;
  }

  const createdAt = Date.parse(syncHistoryEntry.createdAt);

  return Number.isFinite(createdAt) ? createdAt : 0;
}

function renderStaticText(locale: UiLocale): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;

    if (key !== undefined) {
      element.textContent = t(locale, key as I18nKey);
    }
  }
}

function renderStatusCard(elements: PopupElements, setup: SetupStatusView): void {
  elements.setupCard.className = `status-card ${setup.tone}`;
  elements.setupMarker.className = `status-marker ${setup.tone}`;
  elements.setupMarker.textContent = getToneMarker(setup.tone);
  elements.setupTitle.textContent = setup.label;
  elements.setupDetail.textContent = setup.detail;
}

function renderSettingsSummary(
  elements: PopupElements,
  settings: PublicSettingsState | null,
  locale: UiLocale
): void {
  if (settings === null) {
    elements.connectionSummary.textContent = t(locale, "status.loadingSettings");
    elements.connectionDetail.textContent = t(locale, "detail.loadingSettings");
    elements.connectionDetail.hidden = false;
    elements.repositorySummary.textContent = t(locale, "popup.summary.notSelected");
    elements.branchSummary.textContent = t(locale, "popup.summary.notSelected");
    return;
  }

  const connection = getSharedConnectionStatusView(locale, settings.connectionStatus);
  elements.connectionSummary.textContent = connection.label;
  elements.connectionDetail.textContent = connection.detail ?? "";
  elements.connectionDetail.hidden = connection.detail === null;
  elements.repositorySummary.textContent =
    settings.syncRepository?.fullName ?? t(locale, "popup.summary.notSelected");
  elements.branchSummary.textContent =
    settings.syncBranch?.name ?? t(locale, "popup.summary.notSelected");
}

function getToneMarker(tone: Tone): string {
  switch (tone) {
    case "success":
      return "OK";
    case "warning":
      return "!";
    case "error":
      return "X";
    case "neutral":
      return "i";
  }
}

function renderInlineMessage(
  element: HTMLParagraphElement,
  message: InlineMessage,
  locale: UiLocale
): void {
  element.className = `field-message ${message.tone === "neutral" ? "" : message.tone}`.trim();
  element.textContent = resolveInlineMessage(message, locale);
}

function resolveInlineMessage(message: InlineMessage, locale: UiLocale): string {
  return message.i18nKey === undefined
    ? message.text
    : t(locale, message.i18nKey, message.i18nParams ?? {});
}

function hasInlineMessage(message: InlineMessage): boolean {
  return message.i18nKey !== undefined || message.text.length > 0;
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
    setupCard: requireElement("setup-card", HTMLElement),
    setupMarker: requireElement("setup-marker", HTMLDivElement),
    setupTitle: requireElement("setup-title", HTMLHeadingElement),
    setupDetail: requireElement("setup-detail", HTMLParagraphElement),
    autoSyncToggle: requireElement("auto-sync-toggle", HTMLInputElement),
    autoSyncCopy: requireElement("auto-sync-copy", HTMLElement),
    autoSyncStatus: requireElement("auto-sync-status", HTMLParagraphElement),
    openOptionsButton: requireElement("open-options", HTMLButtonElement),
    connectionSummary: requireElement("connection-summary", HTMLElement),
    connectionDetail: requireElement("connection-detail", HTMLElement),
    repositorySummary: requireElement("repository-summary", HTMLElement),
    branchSummary: requireElement("branch-summary", HTMLElement),
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
