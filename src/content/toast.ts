import {
  createToastViewModel,
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
}

export type ToastModelInput = SharedToastModelInput;

export type ToastActionHandler = (
  action: ToastAction,
  recordId: string | null
) => void;

export function createToastModel(
  input: ToastModelInput,
  locale: UiLocale = "en"
): ToastModel {
  return {
    state: input.status,
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
    root.setAttribute("role", model.tone === "error" ? "alert" : "status");
    root.setAttribute("aria-live", model.tone === "error" ? "assertive" : "polite");

    const header = this.documentRef.createElement("div");
    header.className = "header";

    const text = this.documentRef.createElement("div");
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
    closeButton.textContent = "x";
    closeButton.setAttribute("aria-label", "Dismiss");
    closeButton.addEventListener("click", () => this.dismiss());

    header.append(text, closeButton);
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

          this.handleAction(item.action, item.recordId);
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

const CONTENT_TOAST_CSS = `
:host {
  position: fixed;
  right: 18px;
  bottom: 72px;
  z-index: 2147483647;
  color: #111827;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

* {
  box-sizing: border-box;
}

.toast {
  width: min(320px, calc(100vw - 32px));
  border: 1px solid #d7dde5;
  border-left-width: 4px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgb(15 23 42 / 18%);
  padding: 12px;
}

.toast[data-tone="success"] {
  border-left-color: #15803d;
}

.toast[data-tone="error"] {
  border-left-color: #b91c1c;
}

.toast[data-tone="warning"] {
  border-left-color: #b45309;
}

.toast[data-tone="neutral"] {
  border-left-color: #2563eb;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.title {
  margin: 0;
  color: #111827;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}

.detail {
  margin: 4px 0 0;
  color: #4b5563;
  overflow-wrap: anywhere;
}

.close {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font: inherit;
  line-height: 1;
}

.close:hover,
.close:focus-visible {
  border-color: #d7dde5;
  color: #111827;
  outline: none;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.action {
  min-height: 28px;
  border: 1px solid #d7dde5;
  border-radius: 6px;
  background: #ffffff;
  color: #2563eb;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  padding: 4px 9px;
}

.action:hover,
.action:focus-visible {
  border-color: #2563eb;
  outline: none;
}

.action-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}
`;
