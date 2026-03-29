import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Stub cross-spawn which is pulled in by @mastra/mcp's MCPClient stdio transport.
      // MCPServer (which we use) never calls this code path.
      "cross-spawn": path.resolve(__dirname, "src/stubs/cross-spawn.ts"),
    },
  },
  ssr: {
    // Force Vite to bundle these dependencies so the cross-spawn alias applies
    noExternal: ["@mastra/mcp", "@modelcontextprotocol/sdk"],
  },
  test: {
    globals: true,
    hookTimeout: 60_000,
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
    testTimeout: 30_000,
  },
});
