import { MCPServer } from "@mastra/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "@/env";
import { MatrixClient } from "@/matrix/client";
import { createAllTools } from "@/tools";

/** Constant-time comparison for path tokens (mitigates timing leaks). */
const timingSafeEqualString = async (
  a: string,
  b: string
): Promise<boolean> => {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) {
    return false;
  }
  return crypto.subtle.timingSafeEqual(ba, bb);
};

const mcpAuthSecretConfigured = (c: Context<AppEnv>): boolean => {
  const t = c.env.MCP_AUTH_TOKEN;
  return t !== undefined && t !== "";
};

export const createMCPServer = (env: AppEnv["Bindings"]) => {
  const client = new MatrixClient(env.MATRIX_BASE_URL, env.MATRIX_ACCESS_TOKEN);
  const tools = createAllTools(client);

  return new MCPServer({
    id: "mcp-server-matrix",
    name: "mcp-server-matrix",
    tools,
    version: "1.0.0",
  });
};

export const createApp = () => {
  const app = new Hono<AppEnv>();
  app.use(
    "/*",
    cors({
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "Last-Event-ID",
        "mcp-protocol-version",
        "mcp-session-id",
      ],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
      origin: (origin) => origin,
    })
  );

  const mcpHandler = async (c: Context<AppEnv>) => {
    const mcpServer = createMCPServer(c.env);
    const sdkServer = mcpServer.getServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    await sdkServer.connect(transport);
    return transport.handleRequest(c.req.raw);
  };

  // With MCP_AUTH_TOKEN set: MCP only at `/:token/mcp` (token must match the secret).
  // Without it: `/mcp` and `/` for local dev.
  app.all("/:token/mcp", async (c) => {
    if (!mcpAuthSecretConfigured(c)) {
      return c.notFound();
    }
    const expected = c.env.MCP_AUTH_TOKEN;
    if (expected === undefined || expected === "") {
      return c.notFound();
    }
    if (!(await timingSafeEqualString(c.req.param("token"), expected))) {
      return c.notFound();
    }
    return mcpHandler(c);
  });

  app.all("/mcp", (c) => {
    if (mcpAuthSecretConfigured(c)) {
      return c.notFound();
    }
    return mcpHandler(c);
  });

  app.all("/", (c) => {
    if (mcpAuthSecretConfigured(c)) {
      return c.notFound();
    }
    return mcpHandler(c);
  });

  return app;
};
