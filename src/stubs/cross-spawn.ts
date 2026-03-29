// Stub for cross-spawn in Cloudflare Workers.
// @mastra/mcp bundles MCPClient which imports cross-spawn for stdio transport.
// MCPServer (which we use) never calls this code path.
export default function spawn(): never {
  throw new Error("cross-spawn is not available in Cloudflare Workers");
}
