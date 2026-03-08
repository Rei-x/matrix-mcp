import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./env";
import { registerAllTools } from "./tools";

export const getServer = () => {
  const server = new McpServer({
    name: "mcp-server-template",
    version: "1.0.0",
  });

  registerAllTools(server);

  return server;
};

export const createApp = () => {
  const app = new Hono<AppEnv>();
  app.use(
    "/*",
    cors({
      allowHeaders: [
        "Content-Type",
        "mcp-session-id",
        "Last-Event-ID",
        "mcp-protocol-version",
      ],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
      origin: (origin) => origin,
    })
  );

  const mcpHandler = async (c: Context<AppEnv>) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    const server = getServer();
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  };

  app.all("/mcp", mcpHandler);
  app.all("/", mcpHandler);

  return app;
};
