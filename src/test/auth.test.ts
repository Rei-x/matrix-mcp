import { describe, expect, it, vi } from "vitest";

import { createApp } from "@/app";
import type { MatrixToolClient } from "@/matrix/client";

vi.mock("@/mcp/server", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  return { buildServer: () => new McpServer({ name: "test", version: "1" }) };
});

// No homeserver is contacted in these authorization tests.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- only the health handler uses this stub
const client = {
  whoAmI: () => ({ user_id: "@private:example.com" }),
} as MatrixToolClient;
const app = createApp(client);
const bindings = {
  MATRIX_ACCESS_TOKEN: "",
  MATRIX_BASE_URL: "",
  MCP_AUTH_TOKEN: "backend-test-secret",
};

describe("backend authorization without homeserver side effects", () => {
  it("rejects missing, wrong, and non-Bearer credentials", async () => {
    for (const authorization of ["", "Bearer wrong", "backend-test-secret"]) {
      const response = await app.request(
        "/mcp",
        { headers: { Authorization: authorization }, method: "POST" },
        bindings
      );
      expect(response.status).toBe(401);
    }
  });
  it("accepts a correct bearer token", async () => {
    const response = await app.request(
      "/mcp",
      {
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            capabilities: {},
            clientInfo: { name: "test", version: "1" },
            protocolVersion: "2025-11-25",
          },
        }),
        headers: {
          Accept: "application/json, text/event-stream",
          Authorization: "Bearer backend-test-secret",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      bindings
    );
    expect(response.status).toBe(200);
  });
  it("removes secret-in-URL and root routes", async () => {
    for (const path of ["/", "/backend-test-secret/mcp"]) {
      const response = await app.request(path, { method: "POST" }, bindings);
      expect(response.status).toBe(404);
    }
  });
  it("fails closed when unconfigured and on public development hosts", async () => {
    const response = await app.request(
      "/mcp",
      { method: "POST" },
      { ...bindings, MCP_AUTH_TOKEN: "" }
    );
    expect(response.status).toBe(401);
    const publicResponse = await app.fetch(
      new Request("https://public.example/mcp", { method: "POST" }),
      { ...bindings, MCP_AUTH_TOKEN: "", MCP_DEV_MODE: "true" }
    );
    expect(publicResponse.status).toBe(401);
  });
  it("does not expose the Matrix account in its health check", async () => {
    const response = await app.request("/health", {}, bindings);
    expect(await response.text()).toBe("ok");
  });
});
