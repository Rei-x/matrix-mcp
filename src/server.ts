import { serve } from "@hono/node-server";

import { createApp } from "./app";
import type { AppEnv } from "./env";
import { MatrixClient } from "./matrix/client";

const getNodeBindings = (): AppEnv["Bindings"] => {
  const {
    MATRIX_ACCESS_TOKEN = "",
    MATRIX_BASE_URL = "",
    MCP_AUTH_TOKEN,
    MCP_DEV_MODE,
  } = process.env;
  return {
    MATRIX_ACCESS_TOKEN,
    MATRIX_BASE_URL,
    MCP_DEV_MODE,
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
  if (
    (bindings.MCP_AUTH_TOKEN === undefined || bindings.MCP_AUTH_TOKEN === "") &&
    bindings.MCP_DEV_MODE !== "true"
  ) {
    missing.push("MCP_AUTH_TOKEN");
  }
  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(", ")}`
    );
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  const bindings = getNodeBindings();
  requireConfig(bindings);

  console.log("Starting Matrix client and waiting for initial sync...");
  const matrixClient = new MatrixClient(
    bindings.MATRIX_BASE_URL,
    bindings.MATRIX_ACCESS_TOKEN
  );
  await matrixClient.start();
  const me = matrixClient.whoAmI();
  console.log(
    `Matrix sync ready for ${me.user_id} (${matrixClient.listJoinedRooms().length} joined rooms)`
  );

  const app = createApp(matrixClient);
  const port = Number(process.env.PORT) || 3000;
  console.log(`MCP server listening on :${port}`);

  const server = serve({
    fetch: (req): Response | Promise<Response> => app.fetch(req, bindings),
    port,
  });

  const shutdown = (): void => {
    console.log("Shutting down...");
    matrixClient.stop();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

try {
  await main();
} catch (error: unknown) {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
}
