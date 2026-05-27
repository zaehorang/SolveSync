export const APP_NAME = "PS-LP-Sync";

export type ExtensionSurface = "background" | "content" | "options" | "popup";

export interface ScaffoldReadyMessage {
  type: "scaffold:ready";
  surface: ExtensionSurface;
}

export type RuntimeMessage = ScaffoldReadyMessage;
