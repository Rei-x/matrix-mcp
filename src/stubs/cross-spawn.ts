// Stub for `cross-spawn` when Vitest bundles `@mastra/mcp` (MCPClient stdio path; MCPServer does not use it).

const unavailable = (): never => {
  throw new Error(
    "cross-spawn is stubbed; MCP stdio transport is not supported in this project"
  );
};

export default unavailable;
