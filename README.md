# Matrix MCP

Stateless MCP HTTP server backed by a synced Matrix client. Start with
`bun install` and `bun run start`. Configure `MATRIX_BASE_URL`,
`MATRIX_ACCESS_TOKEN`, and `MCP_AUTH_TOKEN` in the environment.

The `/mcp` backend requires `Authorization: Bearer <MCP_AUTH_TOKEN>` and fails
closed when the secret is missing. Secret-in-URL routes and `/` are removed.
`/health` exposes only health status.

Interactive clients connect through a separate OAuth gateway. This backend
has no knowledge of the identity provider or other MCP services.

For local development, `MCP_DEV_MODE=true` permits anonymous requests only
on localhost/loopback hostnames. Do not enable it in production.

- `bun run check`: formatting, lint, and type checks.
- `bunx vitest run src/test/auth.test.ts`: isolated authorization tests, no Matrix network calls.
- `bun run test`: integration tests against the configured homeserver; creates
  private test rooms, posts test messages, and performs cleanup.

Tool definitions live in `src/tools`; `src/mcp/server.ts` owns MCP dispatch.
