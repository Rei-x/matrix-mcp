Use bun as package manager.

## Project Structure

This is a Matrix MCP server built directly on the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`), Hono, and Node.js (`@hono/node-server`). No Mastra wrapper — tool dispatch lives in a thin in-repo abstraction (`src/mcp/`).

Tools are defined with `defineTool({ name, description, inputSchema, outputSchema?, annotations?, execute })` from `src/mcp/tool.ts`. The catalog (`src/tools/index.ts` → `ALL_TOOLS`) is the single source of truth for tool metadata + types. `buildServer(client)` (`src/mcp/server.ts`) constructs an MCP SDK `Server`, registers `tools/list` and `tools/call` handlers against `ALL_TOOLS`, and wires it to `WebStandardStreamableHTTPServerTransport` per request. Optional path-based access control uses `MCP_AUTH_TOKEN` (see Environment Variables).

```
src/
  app.ts                       - Hono app + per-request buildServer
  server.ts                    - Node.js entry point (via @hono/node-server)
  env.ts                       - Environment type definitions
  mcp/
    types.ts                   - ToolDefinition + ToolContext + ToolAnnotations
    tool.ts                    - defineTool, callTool dispatcher, toMcpTool (Zod → JSON Schema)
    server.ts                  - buildServer(client): SDK Server with handlers wired to ALL_TOOLS
  matrix/
    client.ts                  - matrix-js-sdk wrapper: sync at boot, synced reads, send/createRoom, readMedia
  tools/
    conversations.ts           - list_conversations, read_conversation, search_messages, send_message
    media.ts                   - read_media (returns MCP image content blocks for m.image)
    users.ts                   - whoami
    index.ts                   - ALL_TOOLS catalog (frozen `as const satisfies readonly AnyToolDefinition[]`)
  test/
    setup-env.ts               - Loads `.env` for integration tests
    mcp/                       - MCP integration suite factory + per-area test modules
    server.test.ts             - Sequential integration tests
docs/
  media-attachments.md         - Design spec for the read_media tool + attachment fields
```

### MCP core abstraction (`src/mcp/`)

- **`defineTool`** is an identity function for inference; it lets each tool keep precise input/output schema types so `ALL_TOOLS` carries per-tool literal types.
- **`callTool(tool, args, ctx)`** validates args against `inputSchema`, runs `execute`, then wraps the result. If the result has a `content` field (looks like an MCP `CallToolResult`), it's returned verbatim — this is the escape hatch `read_media` uses to return image content blocks. Otherwise the result is set as `structuredContent` (when `outputSchema` is present) plus a JSON-text fallback.
- **`toMcpTool(tool)`** converts to wire shape via Zod 4's built-in `z.toJSONSchema(schema, { unrepresentable: "any" })`.
- **`ToolContext`** holds the `MatrixToolClient`. Add fields here to expose new MCP capabilities (sampling, elicitation) to tools — they opt in by destructuring.
- **Memoization**: `MCP_TOOL_LIST` and `TOOLS_BY_NAME` are computed once at module load in `src/mcp/server.ts`; `ANTHROPIC_TOOL_DEFS` is computed once in `evals/run.ts`. Tools are frozen at load time, so JSON-Schema generation never runs in the per-request hot path.

### Evals

Patterned after Anthropic's `mcp-builder/reference/evaluation.md`. Lives in `evals/`:

```
evals/
  fixture/
    types.ts         shared FixtureMessage / FixtureRoom / Fixture types
    work.ts          WORK_FIXTURE — work-flavoured rooms (incident, release, eng standup, design-doc DM, discord bridge)
    personal.ts      PERSONAL_FIXTURE — DMs (mom/sam/jamie), group plans (lisbon trip, family, book club), whatsapp bridge
    linkedin.ts      LINKEDIN_FIXTURE — recruiter DMs bridged from LinkedIn (mautrix-linkedin puppet style)
    hiring.ts        HIRING_FIXTURE — bilingual PL/EN candidate inbox modelled directly on real observed patterns (opaque puppet ids, broken bridge bot, test residue)
    client.ts        FixtureMatrixClient(fixture) implements MatrixToolClient (refuses writes)
  suites/
    types.ts         EvalSuite + QaPair types
    work.ts          WORK_SUITE — 10 qa_pairs against WORK_FIXTURE
    personal.ts      PERSONAL_SUITE — 12 qa_pairs against PERSONAL_FIXTURE
    linkedin.ts      LINKEDIN_SUITE — 12 qa_pairs against LINKEDIN_FIXTURE
    hiring.ts        HIRING_SUITE — 12 qa_pairs against HIRING_FIXTURE (real-pattern bilingual hiring inbox)
    index.ts         ALL_SUITES = [WORK_SUITE, PERSONAL_SUITE, LINKEDIN_SUITE, HIRING_SUITE]
  run.ts             CLI runner: drives a real Claude tool-use loop against each suite's fixture
```

The personal suite mirrors realistic personal usage (catch-up/triage, fact recall in DMs, URL retrieval, date/coordination, cross-conversation correlation, room identification by content, and self-history synthesis). The LinkedIn suite mirrors the realistic recruiter-DM workload (compensation comparison across recruiters, CV/resume request triage, role/company identification, equity range extraction, "who haven't I replied to" cold-shoulder detection, polite-decline tracking, networking-vs-recruiting distinction, generic-recruiter-spam identification, and concrete time-slot recall). Each `qa_pair` is independent, read-only, multi-tool, and has a single string-comparable answer that's stable because the fixture is frozen.

Run with `bun run eval` (set `ANTHROPIC_API_KEY` first). Useful flags:

- `--suite work|personal|linkedin|hiring` — run one suite (default: all)
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
- `list_conversations` — joined chats sorted by latest activity; reads from the in-memory synced store, so it does no HTTP; `query` matches room TITLE / TOPIC / id ONLY (not message bodies — for that use `search_messages`); paginate with `offset` (page size 20); each item also exposes `last_sender_is_me` (triage) and the tool accepts an `after` ISO date filter
- `search_messages` — case-insensitive substring search across the message bodies of every joined room (or one specific room if `conversation_id` is set). Reads from the in-memory synced live timeline, so it's cheap but bounded by what's currently paged in. Use this BEFORE `read_conversation` whenever the agent is trying to _find_ a chat by something a person said (URL, keyword, name, error code). Filters: `query` (body substring; optional when `sender` is set), `sender` (substring vs full mxid AND localpart), `after`/`before`, `conversation_id`. Each match returns `{ conversation_id, conversation_title, message_id, sender, timestamp, body, attachment? }`; response also has `total` and `truncated` flags
- `read_conversation` — structured `messages` array (oldest first); each message has `sender`, `body`, `type` (text/image/file/video/audio/emote/notice/location), `message_id`, `timestamp`, and optionally `reply_to` and `attachment` (for media messages); paginate older history with `cursor` from the previous response's `next_cursor`; filter by date with `after`/`before`
- `read_media` — fetch a media attachment by `(conversation_id, message_id)`. For `m.image`, returns an MCP `image` content block (base64 PNG/JPEG bytes); for `m.file`/`m.audio`/`m.video`, returns a text description. Default `variant: "thumbnail"` (~512 px) keeps token cost down; `variant: "full"` is opt-in and capped at 10 MB. Encrypted attachments and E2EE rooms are not supported in V1 (clean error). See `docs/media-attachments.md` for the full design.
- `send_message` — sends plain text; set `reply_to_message_id` to a `message_id` from `read_conversation` to reply to that message; returns `{ message_id }`

## Conventions

- Tools are defined using `defineTool()` from `@/mcp/tool` — NOT Mastra. Each tool is an exported `const` (e.g. `export const list_conversations = defineTool({...})`) and is added to `ALL_TOOLS` in `src/tools/index.ts` (`as const satisfies readonly AnyToolDefinition[]` to preserve per-tool literal types).
- Tools have `inputSchema` (required Zod) and optionally `outputSchema` (Zod, validated → `structuredContent`). Annotations (`readOnlyHint`, `idempotentHint`, `destructiveHint`) live on the tool, not in a nested `mcp` field.
- Tools receive `(input, ctx)` where `ctx.client` is the shared `MatrixToolClient`. Add new MCP capabilities (sampling, elicitation) by extending `ToolContext` in `src/mcp/types.ts` — tools opt in by destructuring.
- Tools that need MCP image/resource/multi-block content (e.g. `read_media`) return a raw `CallToolResult` with a `content` field; `callTool` detects the shape and forwards verbatim, bypassing `outputSchema` wrapping.
- Magic msgtype strings are exported as `MSGTYPE` const in `src/matrix/client.ts` — use those instead of literals.
- The underlying MCP SDK Server only allows one transport at a time, so `app.ts` builds a fresh `Server` per request via `buildServer(client)`; the shared `MatrixClient` is reused, so per-request construction is cheap. Tool list and the name→tool map are memoized at module load.
- MCP endpoint: `/mcp` and `/` when `MCP_AUTH_TOKEN` is unset; `/<MCP_AUTH_TOKEN>/mcp` when it is set
- `MatrixClient` wraps `matrix-js-sdk`: `start()` performs the initial sync; reads of room metadata are served from the in-memory store; `/messages`-style pagination still goes over HTTP. `readMedia` makes its own authed `fetch` (the SDK's `mxcUrlToHttp` only resolves URLs).
- Errors from matrix-js-sdk are normalised to messages prefixed with `Matrix API error` so consumers can match on a stable shape
- Integration tests run against real Matrix server (no mocking); the suite creates a dedicated private non-direct test room via `MatrixClient.createRoom` (then `waitForRoom` until the synced store sees it), then leaves and forgets it in `afterAll`. Test type derivation reads `typeof ALL_TOOLS` to give per-tool input/output types on `suite.callTool(name, args)`.
- Object keys should be alphabetically sorted
- Use `@/` path alias for imports from src
