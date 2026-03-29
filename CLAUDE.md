Use bun as package manager.

## Project Structure

This is a Matrix MCP server built with `@modelcontextprotocol/sdk`, Hono, and Cloudflare Workers.

```
src/
  app.ts                       - Hono app + MCP server setup (shared)
  worker.ts                    - Cloudflare Workers entry point
  server.ts                    - Node.js entry point (via @hono/node-server)
  env.ts                       - Environment type definitions
  matrix/
    client.ts                  - Matrix Client-Server API wrapper
  tools/
    index.ts                   - Tool registration (registerAllTools)
    rooms.ts                   - Room management tools (list, info, join, leave, create, search, invite, topic)
    messages.ts                - Message tools (read, send, reply, react, redact, read receipts)
    users.ts                   - User tools (whoami, search, profile)
  test/
    env.d.ts                   - Cloudflare test environment types
    server.test.ts             - Integration tests via Workers pool
```

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

- Use Zod schemas for tool input validation
- Tool handler receives parsed args directly
- MCP endpoint: `/mcp` (or `/`)
- All Matrix API calls go through `MatrixClient` class
- Integration tests run against real Matrix server (no mocking)
- MatrixClient auto-retries on 429 rate limits (up to 3 retries, max 10s wait)
- Object keys should be alphabetically sorted
- Use `@/` path alias for imports from src
