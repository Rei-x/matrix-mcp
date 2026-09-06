import { describe, expect, it } from "vitest";

import { mcpJsonRpcSchema } from "./suite";
import type { McpSuite } from "./suite";

export const registerHttpTransportTests = (s: McpSuite): void => {
  describe("removed root endpoint", () => {
    it("does not serve MCP on the root endpoint", async () => {
      await s.ensureSharedRoom();
      const response = await s.app.request(
        "/",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        s.testEnv
      );
      expect(response.status).toBe(404);
    });
  });

  describe("backend bearer authorization", () => {
    const authEnv = { ...s.testEnv, MCP_AUTH_TOKEN: "test-secret-token" };

    it("requires the backend bearer credential", async () => {
      await s.ensureSharedRoom();
      const response = await s.app.request(
        "/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        authEnv
      );
      expect(response.status).toBe(401);
    });

    it("should 404 for wrong path token", async () => {
      await s.ensureSharedRoom();
      const response = await s.app.request(
        "/wrong-token/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        authEnv
      );
      expect(response.status).toBe(404);
    });

    it("accepts a matching backend bearer token", async () => {
      await s.ensureSharedRoom();
      const response = await s.app.request(
        "/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            Authorization: "Bearer test-secret-token",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        authEnv
      );
      expect(response.status).toBe(200);
      const json: unknown = await response.json();
      expect(mcpJsonRpcSchema.parse(json).jsonrpc).toBe("2.0");
    });

    it("fails closed when the backend secret is missing", async () => {
      await s.ensureSharedRoom();
      const noAuthEnv = { ...s.testEnv, MCP_AUTH_TOKEN: "" };
      const response = await s.app.request(
        "/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        noAuthEnv
      );
      expect(response.status).toBe(401);
    });
  });
};
