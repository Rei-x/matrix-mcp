// eslint-disable-next-line @typescript-eslint/no-deprecated -- Server is the low-level API; we own dispatch and don't need McpServer's higher-level wiring
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { MatrixToolClient } from "@/matrix/client";
import { ALL_TOOLS } from "@/tools";

import { callTool, toMcpTool } from "./tool";

const SERVER_INFO = {
  name: "mcp-server-matrix",
  version: "1.0.0",
};

// Tool definitions are frozen at module load — JSON-Schema generation is
// non-trivial work, so do it once and reuse the result on every tools/list.
const MCP_TOOL_LIST = ALL_TOOLS.map(toMcpTool);
const TOOLS_BY_NAME: ReadonlyMap<string, (typeof ALL_TOOLS)[number]> = new Map(
  ALL_TOOLS.map((t) => [t.name, t])
);

/**
 * Build a fresh MCP `Server` wired to all registered tools. The SDK only
 * supports one transport per Server instance, so callers construct one per
 * request — `app.ts` does this. The shared `MatrixClient` is reused across
 * builds, so per-request construction is cheap.
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- see import comment
export const buildServer = (client: MatrixToolClient): Server => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see import comment
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {} },
  });

  // eslint-disable-next-line @typescript-eslint/promise-function-async -- the SDK's setRequestHandler accepts (req) => Promise; making the lambda async serves no purpose
  server.setRequestHandler(ListToolsRequestSchema, () =>
    Promise.resolve({ tools: MCP_TOOL_LIST })
  );

  // eslint-disable-next-line @typescript-eslint/promise-function-async -- see above
  server.setRequestHandler(CallToolRequestSchema, (req) => {
    const tool = TOOLS_BY_NAME.get(req.params.name);
    if (tool === undefined) {
      return Promise.resolve({
        content: [{ text: `Unknown tool: ${req.params.name}`, type: "text" }],
        isError: true,
      });
    }
    return callTool(tool, req.params.arguments, { client });
  });

  return server;
};
