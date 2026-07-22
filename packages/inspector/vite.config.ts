// Vite config for the Chronos Inspector (Phase 4.1–4.2) — a pure client-side
// React app that loads a failure capsule's `trace` JSON (file picker, drag-drop,
// or a `?capsule=` URL param preloaded by `chronos open`) and renders a
// time-travel timeline + message-sequence diagram. No backend.
//
// The `@sx4im/chronos-core` alias points at core's SOURCE so a dev/build never depends
// on core being pre-built — and in practice the inspector only imports core
// TYPES, so they're elided from the bundle entirely. No node polyfills needed.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@sx4im/chronos-core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
