Use bun as package manager.

## Project Structure

This is a Matrix MCP server built with Mastra (`@mastra/mcp`, `@mastra/core/tools`), Hono, and Cloudflare Workers.

Tools are defined using Mastra's `createTool()` and passed directly to Mastra's `MCPServer`. For CF Workers transport, `MCPServer.getServer()` provides the underlying MCP SDK `Server` which connects to `WebStandardStreamableHTTPServerTransport`. Optional path-based access control uses `MCP_AUTH_TOKEN` (see Environment Variables).

```
src/
  app.ts                       - Hono app + Mastra MCPServer setup
  worker.ts                    - Cloudflare Workers entry point
  server.ts                    - Node.js entry point (via @hono/node-server)
  env.ts                       - Environment type definitions
  matrix/
    client.ts                  - Matrix Client-Server API wrapper (typed HTTP client)
  stubs/
    cross-spawn.ts             - Stub for CF Workers (see note below)
  tools/
    conversations.ts           - Conversation-oriented tools (list, read, send)
    index.ts                   - Tool aggregation (createAllTools)
    users.ts                   - Identity (whoami)
  test/
    env.d.ts                   - Cloudflare test environment types (ProvidedEnv)
    mcp/                       - MCP integration suite factory + per-area test modules
    server.test.ts             - Sequential integration tests (Workers pool)
```

### CF Workers + @mastra/mcp

`@mastra/mcp` bundles both MCPClient and MCPServer in a single entry point. MCPClient imports `cross-spawn` → `node:child_process` which is unavailable in CF Workers. The workaround:

- `vitest.config.ts` aliases `cross-spawn` to `src/stubs/cross-spawn.ts`
- `ssr.noExternal` forces Vite to bundle `@mastra/mcp` so the alias applies
- `MCPServer.getServer()` returns the underlying SDK Server, which connects to `WebStandardStreamableHTTPServerTransport` (native web standard, no Node.js req/res needed)

## Commands

- `bun run dev` - Start dev server via wrangler (Cloudflare Workers)
- `bun run dev:node` - Start dev server via tsx (Node.js)
- `bun run start` - Start production server (Node.js)
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun run test` - Run tests
- `bun run test:watch` - Run tests in watch mode
- `bun run check` - Lint and format check
- `bun run fix` - Auto-fix lint and format issues

## Environment Variables

- `MATRIX_BASE_URL` - Matrix homeserver URL (e.g., https://matrix.example.com)
- `MATRIX_ACCESS_TOKEN` - Matrix access token for authentication
- `MCP_AUTH_TOKEN` - (optional) Secret path segment; when set, MCP is only at `https://host/<token>/mcp` (plain `/mcp` and `/` return 404)

## MCP Tools

Conversations use Matrix room ids exposed as `conversation_id` (DMs, groups, and bridge chats).

- `whoami` - Authenticated Matrix `user_id` only
- `list_conversations` - Joined chats, newest activity first within a cap of 200 rooms per call (homeserver order of `/joined_rooms`); optional `query` filters name/topic/id (substring) in that window; default limit 15
- `read_conversation` - Recent messages as one `transcript` (oldest→newest in page); optional `include_event_ids` for replies; `from` + `next_batch` for pagination
- `send_message` - Send text to `conversation_id`; optional `reply_to_event_id` for threaded reply

## Conventions

- Tools are defined using Mastra `createTool()` from `@mastra/core/tools`
- Tools have `inputSchema` and `outputSchema` (Zod) for type safety
- Tool factories take `MatrixClient` and return tool objects
- Tools are passed directly to Mastra `MCPServer` (no adapter needed)
- MCP endpoint: `/mcp` and `/` when `MCP_AUTH_TOKEN` is unset; `/<MCP_AUTH_TOKEN>/mcp` when it is set
- All Matrix API calls go through custom `MatrixClient` class (typed HTTP wrapper)
- MatrixClient methods use typed generics (`request<T>`) for all API responses
- Integration tests run against real Matrix server (no mocking)
- MatrixClient auto-retries on 429 rate limits (up to 3 retries, max 10s wait)
- Object keys should be alphabetically sorted
- Use `@/` path alias for imports from src
