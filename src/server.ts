import { serve } from "@hono/node-server";

import { createApp } from "./app";
import type { AppEnv } from "./env";

const app = createApp();

const getNodeBindings = (): AppEnv["Bindings"] => {
  const {
    MATRIX_ACCESS_TOKEN = "",
    MATRIX_BASE_URL = "",
    MCP_AUTH_TOKEN,
  } = process.env;
  return {
    MATRIX_ACCESS_TOKEN,
    MATRIX_BASE_URL,
    ...(MCP_AUTH_TOKEN !== undefined && MCP_AUTH_TOKEN !== ""
      ? { MCP_AUTH_TOKEN }
      : {}),
  };
};

const requireConfig = (bindings: AppEnv["Bindings"]) => {
  const missing: string[] = [];
  if (!bindings.MATRIX_BASE_URL) {
    missing.push("MATRIX_BASE_URL");
  }
  if (!bindings.MATRIX_ACCESS_TOKEN) {
    missing.push("MATRIX_ACCESS_TOKEN");
  }
  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(", ")}`
    );
    process.exit(1);
  }
};

const bindings = getNodeBindings();
requireConfig(bindings);

const port = Number(process.env.PORT) || 3000;
console.log(`MCP server listening on :${port}`);
serve({
  fetch: (req, _server): Response | Promise<Response> =>
    app.fetch(req, getNodeBindings()),
  port,
});
