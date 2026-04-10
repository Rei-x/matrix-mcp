import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { MCPServer } from "@mastra/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "@/env";
import { MatrixClient } from "@/matrix/client";
import { createAllTools } from "@/tools";

/** Constant-time comparison for path tokens (mitigates timing leaks). */
const timingSafeEqualString = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ba.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ba, bb);
};

const FAVICON_ICO_PATH = path.join(
  import.meta.dirname,
  "..",
  "public",
  "favicon.ico"
);

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
  app.get("/health", async (c): Promise<Response> => {
    const { MATRIX_ACCESS_TOKEN, MATRIX_BASE_URL } = c.env;
    if (
      MATRIX_BASE_URL === "" ||
      MATRIX_ACCESS_TOKEN === "" ||
      MATRIX_BASE_URL === undefined ||
      MATRIX_ACCESS_TOKEN === undefined
    ) {
      return c.text("matrix not configured", 503);
    }
    try {
      const client = new MatrixClient(MATRIX_BASE_URL, MATRIX_ACCESS_TOKEN);
      await client.whoAmI();
      return c.text("ok", 200);
    } catch {
      return c.text("matrix unavailable", 503);
    }
  });

  app.get("/favicon.ico", async (c): Promise<Response> => {
    try {
      const body = await readFile(FAVICON_ICO_PATH);
      return new Response(body, {
        headers: {
          "Cache-Control": "public, max-age=86400",
          "Content-Type": "image/x-icon",
        },
      });
    } catch {
      return c.notFound();
    }
  });

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
  app.all("/:token/mcp", (c): Response | Promise<Response> => {
    if (!mcpAuthSecretConfigured(c)) {
      return c.notFound();
    }
    const expected = c.env.MCP_AUTH_TOKEN;
    if (expected === undefined || expected === "") {
      return c.notFound();
    }
    if (!timingSafeEqualString(c.req.param("token"), expected)) {
      return c.notFound();
    }
    return mcpHandler(c);
  });

  app.all("/mcp", (c): Response | Promise<Response> => {
    if (mcpAuthSecretConfigured(c)) {
      return c.notFound();
    }
    return mcpHandler(c);
  });

  app.all("/", (c): Response | Promise<Response> => {
    if (mcpAuthSecretConfigured(c)) {
      return c.notFound();
    }
    return mcpHandler(c);
  });

  return app;
};
