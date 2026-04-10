Use bun as package manager.

## Project Structure

This is a Matrix MCP server built with Mastra (`@mastra/mcp`, `@mastra/core/tools`), Hono, and Node.js (`@hono/node-server`).

Tools are defined using Mastra's `createTool()` and passed directly to Mastra's `MCPServer`. `MCPServer.getServer()` provides the underlying MCP SDK `Server`, which connects to `WebStandardStreamableHTTPServerTransport`. Optional path-based access control uses `MCP_AUTH_TOKEN` (see Environment Variables).

```
src/
  app.ts                       - Hono app + Mastra MCPServer setup
  server.ts                    - Node.js entry point (via @hono/node-server)
  env.ts                       - Environment type definitions
  matrix/
    client.ts                  - matrix-js-sdk wrapper: starts a sync at boot, exposes synced reads + send/createRoom helpers
  tools/
    conversations.ts           - Conversation-oriented tools (list, read, send)
    index.ts                   - Tool aggregation (createAllTools)
    users.ts                   - Identity (whoami)
  test/
    setup-env.ts               - Loads `.env` for integration tests
    mcp/                       - MCP integration suite factory + per-area test modules
    server.test.ts             - Sequential integration tests
```

### Evals

Patterned after Anthropic's `mcp-builder/reference/evaluation.md`. Lives in `evals/`:

```
evals/
  fixture/
    types.ts         shared FixtureMessage / FixtureRoom / Fixture types
    work.ts          WORK_FIXTURE — work-flavoured rooms (incident, release, eng standup, design-doc DM, discord bridge)
    personal.ts      PERSONAL_FIXTURE — DMs (mom/sam/jamie), group plans (lisbon trip, family, book club), whatsapp bridge
    linkedin.ts      LINKEDIN_FIXTURE — recruiter DMs bridged from LinkedIn (mautrix-linkedin puppet style)
    client.ts        FixtureMatrixClient(fixture) implements MatrixToolClient (refuses writes)
  suites/
    types.ts         EvalSuite + QaPair types
    work.ts          WORK_SUITE — 10 qa_pairs against WORK_FIXTURE
    personal.ts      PERSONAL_SUITE — 12 qa_pairs against PERSONAL_FIXTURE
    linkedin.ts      LINKEDIN_SUITE — 12 qa_pairs against LINKEDIN_FIXTURE
    index.ts         ALL_SUITES = [WORK_SUITE, PERSONAL_SUITE, LINKEDIN_SUITE]
  run.ts             CLI runner: drives a real Claude tool-use loop against each suite's fixture
```

The personal suite mirrors realistic personal usage (catch-up/triage, fact recall in DMs, URL retrieval, date/coordination, cross-conversation correlation, room identification by content, and self-history synthesis). The LinkedIn suite mirrors the realistic recruiter-DM workload (compensation comparison across recruiters, CV/resume request triage, role/company identification, equity range extraction, "who haven't I replied to" cold-shoulder detection, polite-decline tracking, networking-vs-recruiting distinction, generic-recruiter-spam identification, and concrete time-slot recall). Each `qa_pair` is independent, read-only, multi-tool, and has a single string-comparable answer that's stable because the fixture is frozen.

Run with `bun run eval` (set `ANTHROPIC_API_KEY` first). Useful flags:

- `--suite work|personal|linkedin` — run one suite (default: all)
- `--task <slug>` — run a single qa_pair
- `--trials 5` — pass^k style; run each task multiple times
- `--model claude-opus-4-6` — override the default model
- `--json evals/report.json` — write per-trial JSON report (paste failing transcripts back into Claude Code to iterate on tool descriptions)
- `--verbose` — print model output on failure

The runner exits non-zero unless every task hits `pass^k` (all trials correct). Each suite gets its own `FixtureMatrixClient` instance, so suites can use different fixtures without leaking state. Adding a new suite is one entry in `evals/suites/index.ts`.

### Sync-at-startup model

`MatrixClient.start()` calls matrix-js-sdk's `startClient()` and resolves once the SDK reaches `PREPARED` state (initial sync complete). After that, room metadata reads (`whoAmI`, `listJoinedRooms`, `getRoom`) are O(1) lookups against the in-memory store — no HTTP per call. `readMessages` still uses `/messages` (via `createMessagesRequest`) so pagination tokens stay stable across calls. `server.ts` awaits `start()` before binding the HTTP listener, so requests never observe a pre-sync client. After `createRoom` the SDK store only sees the new room on the next `/sync` tick — `waitForRoom(roomId)` is provided for tests/admin flows that need to await that.

## Commands

- `bun run dev` - Start dev server with watch (Bun)
- `bun run dev:tsx` - Start dev server with watch (tsx + `--env-file .env`)
- `bun run start` - Start production server (Node.js via Bun runtime)
- `bun run test` - Run integration tests against a real Matrix server
- `bun run test:watch` - Run tests in watch mode
- `bun run check` - Lint and format check
- `bun run fix` - Auto-fix lint and format issues
- `bun run eval` - Run the agent eval suite against an in-memory fixture (requires `ANTHROPIC_API_KEY`)

## Environment Variables

- `MATRIX_BASE_URL` - Matrix homeserver URL (e.g., https://matrix.example.com)
- `MATRIX_ACCESS_TOKEN` - Matrix access token for authentication
- `MCP_AUTH_TOKEN` - (optional) Secret path segment; when set, MCP is only at `https://host/<token>/mcp` (plain `/mcp` and `/` return 404)

## MCP Tools

Conversations use Matrix room ids exposed as `conversation_id` (DMs, groups, and bridge chats).

All tool I/O uses `conversation_id` (Matrix room id) and `message_id` (Matrix event id). Matrix-internal terms like `event_id` / `from` / `next_batch` are not exposed to the agent — see `src/tools/conversations.ts`.

- `whoami` — returns `{ user_id }` for the authenticated Matrix user
- `list_conversations` — joined chats sorted by latest activity; reads from the in-memory synced store, so it does no HTTP; optional `query` substring filter; default limit 15 (max 50); response: `{ conversations: [{ conversation_id, title, last_activity }], total }`
- `read_conversation` — oldest-first transcript string with each line formatted `<iso-ts> <sender> [<message_id>]: <text>`; paginate older history with `cursor` from the previous response's `next_cursor`
- `send_message` — sends plain text; set `reply_to_message_id` (the id printed inside `[…]` in transcripts) to reply to a specific message; returns `{ message_id }`

## Conventions

- Tools are defined using Mastra `createTool()` from `@mastra/core/tools`
- Tools have `inputSchema` and `outputSchema` (Zod) for type safety
- Tool factories take `MatrixClient` and return tool objects
- Tools are passed directly to Mastra `MCPServer` (no adapter needed)
- The underlying MCP SDK Server only allows one transport at a time, so `app.ts` builds a fresh `MCPServer` per request; the shared `MatrixClient` is reused, so per-request construction is cheap
- MCP endpoint: `/mcp` and `/` when `MCP_AUTH_TOKEN` is unset; `/<MCP_AUTH_TOKEN>/mcp` when it is set
- `MatrixClient` wraps `matrix-js-sdk`: `start()` performs the initial sync; reads of room metadata are served from the in-memory store; `/messages`-style pagination still goes over HTTP
- Errors from matrix-js-sdk are normalised to messages prefixed with `Matrix API error` so consumers can match on a stable shape
- Integration tests run against real Matrix server (no mocking); the suite creates a dedicated private non-direct test room via `MatrixClient.createRoom` (then `waitForRoom` until the synced store sees it), then leaves and forgets it in `afterAll`
- Object keys should be alphabetically sorted
- Use `@/` path alias for imports from src
