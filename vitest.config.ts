import path from "node:path";

import { defineConfig } from "vitest/config";

const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Stub cross-spawn pulled in by @mastra/mcp's MCPClient stdio path (unused by MCPServer).
      "cross-spawn": path.resolve(__dirname, "src/stubs/cross-spawn.ts"),
    },
  },
  ssr: {
    noExternal: ["@mastra/mcp", "@modelcontextprotocol/sdk"],
  },
  test: {
    globals: true,
    hookTimeout: 60_000,
    setupFiles: ["./src/test/setup-env.ts"],
    testTimeout: 30_000,
  },
});
