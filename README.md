# MCP Server Template

A production-ready MCP (Model Context Protocol) server template built with [Mastra](https://mastra.ai), [Hono](https://hono.dev), and Node.js.

## Quick Start

```bash
bun install
cp .env.example .env
bun run dev
```

The server starts at `http://localhost:3000`. MCP endpoint is at `/api/mcp/main/mcp`.

## Project Structure

```
src/
  server.ts                    - Entry point: Hono app + HTTP server
  mastra/
    index.ts                   - Mastra instance configuration
    mcp-servers/
      index.ts                 - MCPServer definition with tools
    tools/
      index.ts                 - Tool barrel export
      echo.ts                  - Example echo tool
      calculator.ts            - Example calculator tool
  test/
    server.test.ts             - Integration tests via MCPClient
```

## Adding a Tool

1. Create `src/mastra/tools/my-tool.ts`:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const myTool = createTool({
  id: "my-tool",
  description: "Description of what the tool does",
  inputSchema: z.object({
    input: z.string().describe("Description of input"),
  }),
  execute: async ({ input }) => {
    return { result: input };
  },
});
```

2. Export from `src/mastra/tools/index.ts`
3. Register in `src/mastra/mcp-servers/index.ts`

## Scripts

| Command         | Description                      |
| --------------- | -------------------------------- |
| `bun run dev`   | Start dev server with watch mode |
| `bun run start` | Start production server          |
| `bun run test`  | Run tests                        |
| `bun run check` | Lint and format check            |
| `bun run fix`   | Auto-fix lint and format         |

## Deployment

The server runs on Node.js via `@hono/node-server`. Deploy anywhere Node.js is supported.
