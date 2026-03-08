Use bun as package manager.

## Project Structure

This is an MCP server template built with `@modelcontextprotocol/sdk`, Hono, and Cloudflare Workers.

```
src/
  app.ts                       - Hono app + MCP server setup (shared)
  worker.ts                    - Cloudflare Workers entry point
  server.ts                    - Node.js entry point (via @hono/node-server)
  env.ts                       - Environment type definitions
  tools/
    index.ts                   - Tool registration (registerAllTools)
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

## Adding Tools

1. Use `server.registerTool()` from `@modelcontextprotocol/sdk` in `src/tools/index.ts`
2. Define input schema with Zod
3. Return `{ content: [{ text, type: "text" }] }` from the handler

## Conventions

- Use Zod schemas for tool input validation
- Tool handler receives parsed args directly
- MCP endpoint: `/mcp` (or `/`)
