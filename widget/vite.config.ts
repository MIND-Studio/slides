import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Builds the deck widget — DeckRenderer + the real slidev/layouts/*.vue —
// into a single self-contained IIFE bundle that attaches `window.MindDeck`,
// plus one CSS file. Output lands in `public/deck-widget/` so Next serves it as
// a static asset. Run via `npm run build:widget` (wired into predev/prebuild).
export default defineConfig({
  plugins: [vue()],
  // The widget bundles its own assets; disable Vite's public-dir copy (our
  // outDir lives inside Next's public/, which would otherwise self-copy).
  publicDir: false,
  define: {
    // Vite's `lib` build doesn't auto-replace this the way an app build does;
    // Vue's runtime reads it, so without this the IIFE throws "process is not
    // defined" in the browser.
    "process.env.NODE_ENV": JSON.stringify("production"),
    // Silence Vue's feature-flag warnings in a non-bundler runtime.
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  build: {
    outDir: fileURLToPath(new URL("../public/deck-widget", import.meta.url)),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./main.ts", import.meta.url)),
      name: "MindDeck",
      formats: ["iife"],
      fileName: () => "deck-widget.js",
    },
    rollupOptions: {
      output: { assetFileNames: "deck-widget.[ext]" },
    },
  },
});
