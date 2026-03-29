import {
  MCPServer,
  extractBearerToken,
  generateProtectedResourceMetadata,
  generateWWWAuthenticateHeader,
} from "@mastra/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "@/env";
import { MatrixClient } from "@/matrix/client";
import { createAllTools } from "@/tools";

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

  // --- OAuth Protected Resource Metadata (RFC 9728) ---
  // Uses Mastra's generateProtectedResourceMetadata to serve discovery metadata.
  app.get("/.well-known/oauth-protected-resource/:path{.*}?", (c) => {
    const authToken = c.env.MCP_AUTH_TOKEN;
    if (authToken === undefined || authToken === "") {
      return c.json({ error: "OAuth not configured" }, 404);
    }

    const issuer = `${new URL(c.req.url).origin}`;
    const metadata = generateProtectedResourceMetadata({
      authorizationServers: [issuer],
      resource: issuer,
      resourceName: "Matrix MCP Server",
      scopesSupported: ["mcp:read", "mcp:write"],
    });
    return c.json(metadata);
  });

  // --- OAuth Token Validation Middleware ---
  // Uses Mastra's extractBearerToken and generateWWWAuthenticateHeader.
  const authMiddleware = async (
    c: Context<AppEnv>,
    next: () => Promise<void>
  ) => {
    const authToken = c.env.MCP_AUTH_TOKEN;
    if (authToken === undefined || authToken === "") {
      await next();
      return;
    }

    const token = extractBearerToken(c.req.header("Authorization") ?? null);
    if (token === authToken) {
      await next();
      return;
    }

    const { origin } = new URL(c.req.url);
    return c.json({ error: "Unauthorized" }, 401, {
      "WWW-Authenticate": generateWWWAuthenticateHeader({
        resourceMetadataUrl: `${origin}/.well-known/oauth-protected-resource`,
      }),
    });
  };

  const mcpHandler = async (c: Context<AppEnv>) => {
    const mcpServer = createMCPServer(c.env);
    const sdkServer = mcpServer.getServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    await sdkServer.connect(transport);
    return transport.handleRequest(c.req.raw);
  };

  app.all("/mcp", authMiddleware, mcpHandler);
  app.all("/", authMiddleware, mcpHandler);

  return app;
};
