import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const srcRoot = resolve(projectRoot, "src");
const outDir = resolve(projectRoot, "dist");

// SWEA MAIN world bridge (ADR 0035). content/index.js와 같은 이유로 classic
// script이므로 별도의 단일 entry IIFE build가 필요하다 (ADR 0023).
export default defineConfig({
  root: srcRoot,
  envDir: projectRoot,
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: resolve(srcRoot, "content/sweaEditorBridge.ts"),
      formats: ["iife"],
      name: "SolveSyncSweaEditorBridge",
      fileName: () => "content/sweaEditorBridge.js"
    }
  }
});
