import { describe, expect, it } from "vitest";

import { mcpJsonRpcSchema } from "./suite";
import type { McpSuite } from "./suite";

export const registerHttpTransportTests = (s: McpSuite): void => {
  describe("root endpoint", () => {
    it("should serve MCP on / endpoint as well", async () => {
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
      expect(response.status).toBe(200);
      const json: unknown = await response.json();
      expect(mcpJsonRpcSchema.parse(json).jsonrpc).toBe("2.0");
    });
  });

  describe("path token authorization", () => {
    const authEnv = { ...s.testEnv, MCP_AUTH_TOKEN: "test-secret-token" };

    it("should 404 on /mcp when MCP_AUTH_TOKEN is set", async () => {
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
      expect(response.status).toBe(404);
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

    it("should accept MCP at /:token/mcp when token matches", async () => {
      await s.ensureSharedRoom();
      const response = await s.app.request(
        "/test-secret-token/mcp",
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
      expect(response.status).toBe(200);
      const json: unknown = await response.json();
      expect(mcpJsonRpcSchema.parse(json).jsonrpc).toBe("2.0");
    });

    it("should skip auth when MCP_AUTH_TOKEN is not set", async () => {
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
      expect(response.status).toBe(200);
    });
  });
};
