import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@sx4im/chronos-core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@sx4im/chronos-net": path.resolve(__dirname, "packages/net/src/index.ts"),
      "@sx4im/chronos-vitest/engine": path.resolve(
        __dirname,
        "packages/vitest/src/engine.ts"
      ),
      "@sx4im/chronos-vitest": path.resolve(
        __dirname,
        "packages/vitest/src/index.ts"
      ),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "examples/*/**/*.test.ts"],
    testTimeout: 30_000,
    // The default "forks" pool crashes on Node >=24 (tinypool stack overflow
    // during worker teardown). Worker threads are unaffected, and Chronos tests
    // don't rely on process-level isolation.
    pool: "threads",
  },
});
