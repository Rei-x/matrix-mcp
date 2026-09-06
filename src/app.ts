import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "@/env";
import type { MatrixToolClient } from "@/matrix/client";
import { buildServer } from "@/mcp/server";

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

export const createApp = (client: MatrixToolClient) => {
  const app = new Hono<AppEnv>();

  app.get("/health", (c): Response => {
    try {
      client.whoAmI();
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
    // The underlying MCP SDK Server can only be connected to one transport at
    // a time, so build a fresh server per request. Tool construction is cheap
    // since the Matrix client is already synced.
    const sdkServer = buildServer(client);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    await sdkServer.connect(transport);
    return transport.handleRequest(c.req.raw);
  };

  app.all("/mcp", (c): Response | Promise<Response> => {
    const expected = c.env.MCP_AUTH_TOKEN;
    const authorization = c.req.header("Authorization");
    const supplied =
      authorization?.startsWith("Bearer ") === true
        ? authorization.slice(7)
        : undefined;
    const authenticated =
      expected !== undefined &&
      expected !== "" &&
      supplied !== undefined &&
      supplied !== "" &&
      timingSafeEqualString(supplied, expected);
    const localDev =
      c.env.MCP_DEV_MODE === "true" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(c.req.url).hostname);
    if (!authenticated && !localDev) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return mcpHandler(c);
  });
  return app;
};
