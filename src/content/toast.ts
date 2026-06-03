import {
  createToastViewModel,
  getSyncStatusSemanticTone,
  t,
  type SemanticStateTone,
  type ToastActionView,
  type ToastModelInput as SharedToastModelInput,
  type ToastViewModel,
  type Tone,
  type UiLocale
} from "../shared";
import type { ToastAction } from "../shared/messages";
import type { SyncStatus } from "../shared/types";

export type ToastTone = Tone;

export type ToastActionModel = ToastActionView;

export interface ToastModel extends ToastViewModel {
  state: SyncStatus;
  semanticTone: SemanticStateTone;
  dismissLabel: string;
  locale: UiLocale;
}

export type ToastModelInput = SharedToastModelInput;

export type ToastActionHandler = (
  action: ToastAction,
  syncHistoryEntryId: string | null,
  retryBundleId: string | null
) => void;

export function createToastModel(
  input: ToastModelInput,
  locale: UiLocale = "en"
): ToastModel {
  return {
    state: input.status,
    semanticTone: getSyncStatusSemanticTone(input.status),
    dismissLabel: t(locale, "action.dismiss"),
    locale,
    ...createToastViewModel(locale, input)
  };
}

export class ContentToast {
  private host: HTMLDivElement | null = null;
  private shadowRootRef: ShadowRoot | null = null;
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly documentRef: Document,
    private readonly handleAction: ToastActionHandler
  ) {}

  show(model: ToastModel): void {
    const shadowRoot = this.ensureMounted();
    this.clearAutoDismissTimer();
    this.host?.setAttribute("lang", model.locale);
    shadowRoot.replaceChildren(this.createStyle(), this.createToastElement(model));

    if (model.autoDismissMs !== null) {
      this.autoDismissTimer = setTimeout(() => {
        this.dismiss();
      }, model.autoDismissMs);
    }
  }

  dismiss(): void {
    this.clearAutoDismissTimer();
    this.host?.remove();
    this.host = null;
    this.shadowRootRef = null;
  }

  private ensureMounted(): ShadowRoot {
    if (this.host !== null && this.shadowRootRef !== null) {
      return this.shadowRootRef;
    }

    const host = this.documentRef.createElement("div");
    host.id = "solvesync-toast-root";
    const shadowRoot = host.attachShadow({ mode: "open" });
    this.documentRef.documentElement.append(host);
    this.host = host;
    this.shadowRootRef = shadowRoot;

    return shadowRoot;
  }

  private createToastElement(model: ToastModel): HTMLElement {
    const root = this.documentRef.createElement("section");
    root.className = "toast";
    root.dataset.tone = model.tone;
    root.dataset.semanticTone = model.semanticTone;
    root.dataset.state = model.state;
    root.setAttribute("lang", model.locale);
    root.setAttribute("role", model.tone === "error" ? "alert" : "status");
    root.setAttribute("aria-live", model.tone === "error" ? "assertive" : "polite");

    const header = this.documentRef.createElement("div");
    header.className = "header";

    const statusMark = this.documentRef.createElement("span");
    statusMark.className =
      model.state === "syncing" || model.state === "retrying"
        ? "status-mark is-busy"
        : "status-mark";
    statusMark.setAttribute("aria-hidden", "true");

    const text = this.documentRef.createElement("div");
    text.className = "copy";
    const title = this.documentRef.createElement("p");
    title.className = "title";
    title.textContent = model.title;
    text.append(title);

    if (model.detail !== null && model.detail.length > 0) {
      const detail = this.documentRef.createElement("p");
      detail.className = "detail";
      detail.textContent = model.detail;
      text.append(detail);
    }

    const closeButton = this.documentRef.createElement("button");
    closeButton.className = "close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", model.dismissLabel);
    closeButton.addEventListener("click", () => this.dismiss());

    header.append(statusMark, text, closeButton);
    root.append(header);

    if (model.actions.length > 0) {
      const actions = this.documentRef.createElement("div");
      actions.className = "actions";

      for (const item of model.actions) {
        const button = this.documentRef.createElement("button");
        button.className = item.primary ? "action action-primary" : "action";
        button.type = "button";
        button.textContent = item.label;
        button.addEventListener("click", () => {
          if (item.action === "dismiss") {
            this.dismiss();
            return;
          }

          this.handleAction(
            item.action,
            item.syncHistoryEntryId,
            item.retryBundleId
          );
        });
        actions.append(button);
      }

      root.append(actions);
    }

    return root;
  }

  private createStyle(): HTMLStyleElement {
    const style = this.documentRef.createElement("style");
    style.textContent = CONTENT_TOAST_CSS;

    return style;
  }

  private clearAutoDismissTimer(): void {
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }
}

export const CONTENT_TOAST_CSS = `
:host {
  --ss-bg-wash-blue: #dbeafe;
  --ss-bg-wash-green: #dcfce7;
  --ss-bg-wash-lavender: #ede9fe;
  --ss-glass: rgb(255 255 255 / 0.72);
  --ss-glass-elevated: rgb(255 255 255 / 0.84);
  --ss-glass-border: rgb(255 255 255 / 0.72);
  --ss-hairline: rgb(148 163 184 / 0.28);
  --ss-text-primary: #0f172a;
  --ss-text-secondary: #475569;
  --ss-text-muted: #64748b;
  --ss-text-on-accent: #ffffff;
  --ss-accent: #2563eb;
  --ss-success: #16a34a;
  --ss-error: #dc2626;
  --ss-warning: #d97706;
  --ss-radius-panel: 8px;
  --ss-shadow-glass: 0 18px 48px rgb(15 23 42 / 0.16);
  --ss-font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --ss-space-1: 4px;
  --ss-space-2: 8px;
  --ss-space-3: 12px;
  --ss-space-4: 16px;
  --ss-surface-muted: rgb(248 250 252 / 0.84);
  --ss-input-disabled: #eef2f7;
  --ss-text-disabled: #6b7280;
  --ss-success-soft: #f0fdf4;
  --ss-warning-soft: #fffbeb;
  --ss-error-soft: #fef2f2;
  --ss-success-border: rgb(22 163 74 / 0.32);
  --ss-warning-border: rgb(217 119 6 / 0.32);
  --ss-error-border: rgb(220 38 38 / 0.28);
  --ss-state-success-bg: var(--ss-success-soft);
  --ss-state-success-border: var(--ss-success-border);
  --ss-state-success-fg: var(--ss-success);
  --ss-state-failed-bg: var(--ss-error-soft);
  --ss-state-failed-border: var(--ss-error-border);
  --ss-state-failed-fg: var(--ss-error);
  --ss-state-progress-bg: var(--ss-bg-wash-blue);
  --ss-state-progress-border: rgb(37 99 235 / 0.32);
  --ss-state-progress-fg: var(--ss-accent);
  --ss-state-warning-bg: var(--ss-warning-soft);
  --ss-state-warning-border: var(--ss-warning-border);
  --ss-state-warning-fg: var(--ss-warning);
  --ss-state-neutral-bg: var(--ss-surface-muted);
  --ss-state-neutral-border: var(--ss-hairline);
  --ss-state-neutral-fg: var(--ss-text-secondary);
  --ss-state-disabled-bg: var(--ss-input-disabled);
  --ss-state-disabled-border: rgb(148 163 184 / 0.2);
  --ss-state-disabled-fg: var(--ss-text-disabled);
  --ss-badge-pill-radius: 999px;
  --ss-badge-pill-font-weight: 700;
  --ss-toast-state-bg: var(--ss-state-neutral-bg);
  --ss-toast-state-border: var(--ss-state-neutral-border);
  --ss-toast-state-fg: var(--ss-state-neutral-fg);
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(84px, calc(env(safe-area-inset-bottom) + 16px));
  z-index: 2147483647;
  width: min(360px, calc(100vw - 32px));
  max-width: calc(100vw - max(32px, calc(env(safe-area-inset-left) + env(safe-area-inset-right) + 32px)));
  color: var(--ss-text-primary);
  font-family: var(--ss-font-sans);
  font-size: 13px;
  line-height: 1.4;
}

* {
  box-sizing: border-box;
}

.toast {
  position: relative;
  width: 100%;
  border: 1px solid var(--ss-toast-state-border);
  border-radius: var(--ss-radius-panel);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.9), var(--ss-glass-elevated)),
    var(--ss-glass);
  box-shadow: var(--ss-shadow-glass);
  padding: var(--ss-space-3);
  overflow: hidden;
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
}

.toast::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 1px solid var(--ss-hairline);
  border-radius: inherit;
  pointer-events: none;
}

.toast::after {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--ss-toast-state-fg);
  opacity: 0.86;
  pointer-events: none;
}

.toast[data-semantic-tone="success"] {
  --ss-toast-state-bg: var(--ss-state-success-bg);
  --ss-toast-state-border: var(--ss-state-success-border);
  --ss-toast-state-fg: var(--ss-state-success-fg);
}

.toast[data-semantic-tone="failed"] {
  --ss-toast-state-bg: var(--ss-state-failed-bg);
  --ss-toast-state-border: var(--ss-state-failed-border);
  --ss-toast-state-fg: var(--ss-state-failed-fg);
}

.toast[data-semantic-tone="warning"] {
  --ss-toast-state-bg: var(--ss-state-warning-bg);
  --ss-toast-state-border: var(--ss-state-warning-border);
  --ss-toast-state-fg: var(--ss-state-warning-fg);
}

.toast[data-semantic-tone="progress"] {
  --ss-toast-state-bg: var(--ss-state-progress-bg);
  --ss-toast-state-border: var(--ss-state-progress-border);
  --ss-toast-state-fg: var(--ss-state-progress-fg);
}

.toast[data-semantic-tone="disabled"] {
  --ss-toast-state-bg: var(--ss-state-disabled-bg);
  --ss-toast-state-border: var(--ss-state-disabled-border);
  --ss-toast-state-fg: var(--ss-state-disabled-fg);
}

.toast[data-semantic-tone="progress"]::after {
  background: linear-gradient(
    90deg,
    rgb(37 99 235 / 0.22),
    var(--ss-toast-state-fg),
    rgb(37 99 235 / 0.22)
  );
  background-size: 180% 100%;
  animation: solvesync-progress 1400ms linear infinite;
}

.header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.status-mark {
  flex: 0 0 auto;
  position: relative;
  display: grid;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  place-items: center;
  border: 1px solid var(--ss-toast-state-border);
  border-radius: var(--ss-badge-pill-radius);
  background: var(--ss-toast-state-bg);
  color: var(--ss-toast-state-fg);
  box-shadow: 0 0 0 4px rgb(148 163 184 / 0.12);
}

.status-mark::before {
  content: "!";
  color: currentColor;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
}

.toast[data-semantic-tone="success"] .status-mark {
  box-shadow: 0 0 0 4px rgb(22 163 74 / 0.12);
}

.toast[data-semantic-tone="warning"] .status-mark {
  box-shadow: 0 0 0 4px rgb(217 119 6 / 0.12);
}

.toast[data-semantic-tone="failed"] .status-mark {
  box-shadow: 0 0 0 4px rgb(220 38 38 / 0.1);
}

.toast[data-semantic-tone="progress"] .status-mark {
  box-shadow: 0 0 0 4px rgb(37 99 235 / 0.1);
}

.toast[data-semantic-tone="success"] .status-mark::before {
  width: 10px;
  height: 5px;
  margin-top: -2px;
  border-bottom: 2px solid currentColor;
  border-left: 2px solid currentColor;
  content: "";
  transform: rotate(-45deg);
}

.toast[data-semantic-tone="failed"] .status-mark::before,
.toast[data-semantic-tone="failed"] .status-mark::after {
  position: absolute;
  width: 11px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  content: "";
}

.toast[data-semantic-tone="failed"] .status-mark::before {
  transform: rotate(45deg);
}

.toast[data-semantic-tone="failed"] .status-mark::after {
  transform: rotate(-45deg);
}

.status-mark.is-busy {
  background: var(--ss-state-progress-bg);
}

.status-mark.is-busy::before {
  width: 12px;
  height: 12px;
  border: 2px solid rgb(37 99 235 / 0.24);
  border-top-color: currentColor;
  border-radius: var(--ss-badge-pill-radius);
  content: "";
  animation: solvesync-spin 820ms linear infinite;
}

.copy {
  min-width: 0;
  flex: 1 1 auto;
}

.title {
  margin: 0;
  color: var(--ss-text-primary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.detail {
  margin: 4px 0 0;
  color: var(--ss-text-secondary);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.close {
  flex: 0 0 auto;
  position: relative;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ss-text-muted);
  cursor: pointer;
  font: inherit;
}

.close::before,
.close::after {
  position: absolute;
  width: 11px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
  content: "";
}

.close::before {
  transform: rotate(45deg);
}

.close::after {
  transform: rotate(-45deg);
}

.close:hover,
.close:focus-visible {
  border-color: var(--ss-hairline);
  color: var(--ss-text-primary);
  outline: 2px solid transparent;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  align-items: center;
  gap: var(--ss-space-2);
  margin-top: var(--ss-space-3);
}

.action {
  display: inline-flex;
  flex: 0 0 auto;
  max-width: 100%;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ss-hairline);
  border-radius: 6px;
  background: var(--ss-glass-elevated);
  color: var(--ss-accent);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  padding: 4px 9px;
  line-height: 1.2;
  overflow-wrap: normal;
  text-align: center;
  white-space: nowrap;
}

.action:hover,
.action:focus-visible {
  border-color: var(--ss-accent);
  outline: 2px solid transparent;
}

.action-primary {
  border-color: var(--ss-accent);
  background: var(--ss-accent);
  color: var(--ss-text-on-accent);
}

@keyframes solvesync-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes solvesync-progress {
  to {
    background-position: -180% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast[data-semantic-tone="progress"]::after {
    animation: none;
    background: var(--ss-toast-state-fg);
  }

  .status-mark.is-busy {
    background: var(--ss-state-progress-bg);
  }

  .status-mark.is-busy::before {
    animation: none;
    border-color: currentColor;
    border-right-color: transparent;
  }
}
`;
