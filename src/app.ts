import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "@/env";
import { MatrixClient } from "@/matrix/client";
import { registerAllTools } from "@/tools";

export const getServer = (env: AppEnv["Bindings"]) => {
  const server = new McpServer({
    name: "mcp-server-matrix",
    version: "1.0.0",
  });

  const client = new MatrixClient(env.MATRIX_BASE_URL, env.MATRIX_ACCESS_TOKEN);
  registerAllTools(server, client);

  return server;
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

  const authMiddleware = async (
    c: Context<AppEnv>,
    next: () => Promise<void>
  ) => {
    const authToken = c.env.MCP_AUTH_TOKEN;
    if (authToken === undefined || authToken === "") {
      await next();
      return;
    }
    const bearer = c.req.header("Authorization");
    if (bearer === `Bearer ${authToken}`) {
      await next();
      return;
    }
    return c.json({ error: "Unauthorized" }, 401);
  };

  const mcpHandler = async (c: Context<AppEnv>) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    const server = getServer(c.env);
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  };

  app.all("/mcp", authMiddleware, mcpHandler);
  app.all("/", authMiddleware, mcpHandler);

  return app;
};
