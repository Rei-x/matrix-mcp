import path from "node:path";

import { defineConfig } from "vitest/config";

const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    hookTimeout: 60_000,
    setupFiles: ["./src/test/setup-env.ts"],
    testTimeout: 30_000,
  },
});
