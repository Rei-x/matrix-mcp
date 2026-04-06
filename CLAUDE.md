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
    index.ts                   - Tool aggregation (createAllTools)
    rooms.ts                   - Room management tools (Mastra createTool)
    messages.ts                - Message tools (Mastra createTool)
    users.ts                   - User tools (Mastra createTool)
  test/
    env.d.ts                   - Cloudflare test environment types
    server.test.ts             - Integration tests via Workers pool
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

### Room Management

- `list_rooms` - List joined rooms with pagination (limit, offset)
- `get_room_info` - Get room details (name, topic, members)
- `search_public_rooms` - Search/list public rooms
- `join_room` - Join a room by ID or alias
- `leave_room` - Leave a room
- `create_room` - Create a new room (private, public, or DM)
- `invite_user` - Invite a user to a room
- `set_room_topic` - Set or update a room's topic

### Messages

- `read_messages` - Read messages with pagination
- `send_message` - Send a text message
- `reply_to_message` - Reply to a specific message (threaded reply)
- `send_reaction` - React to a message with an emoji
- `redact_message` - Delete/redact a message
- `send_read_receipt` - Mark a message as read

### Users

- `whoami` - Get current user identity
- `search_users` - Search user directory
- `get_user_profile` - Get user display name

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
