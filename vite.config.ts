import { copyFileSync, mkdirSync } from "node:fs";
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
    emptyOutDir: true,
    rollupOptions: {
      input: {
        options: resolve(srcRoot, "options/index.html"),
        popup: resolve(srcRoot, "popup/index.html"),
        background: resolve(srcRoot, "background/index.ts")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") {
            return "background/index.js";
          }

          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  plugins: [
    {
      name: "copy-extension-manifest",
      closeBundle() {
        mkdirSync(outDir, { recursive: true });
        copyFileSync(
          resolve(projectRoot, "manifest.json"),
          resolve(outDir, "manifest.json")
        );
      }
    }
  ]
});
