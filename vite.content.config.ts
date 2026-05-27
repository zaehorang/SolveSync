import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const srcRoot = resolve(projectRoot, "src");
const outDir = resolve(projectRoot, "dist");

export default defineConfig({
  root: srcRoot,
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: resolve(srcRoot, "content/index.ts"),
      formats: ["iife"],
      name: "PsLpSyncContent",
      fileName: () => "content/index.js"
    }
  }
});
