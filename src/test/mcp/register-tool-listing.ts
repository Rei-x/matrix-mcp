import { describe, expect, it } from "vitest";

import {
  toolListResultSchema,
  toolSetIncludesAllRequired,
  toolsHaveNonEmptyDescriptions,
} from "./suite";
import type { McpSuite } from "./suite";

export const registerToolListingTests = (s: McpSuite): void => {
  describe("tool listing", () => {
    it("should list all available tools", async () => {
      const response = await s.mcpRequest({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
      });
      const body = toolListResultSchema.parse(response.result);
      const toolNames = new Set(body.tools.map((t) => t.name));
      expect(toolSetIncludesAllRequired(toolNames)).toBeTruthy();
    });

    it("should have descriptions for all tools", async () => {
      const response = await s.mcpRequest({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
      });
      const body = toolListResultSchema.parse(response.result);
      expect(toolsHaveNonEmptyDescriptions(body.tools)).toBeTruthy();
    });
  });

  describe("whoami", () => {
    it("should return current user id only", async () => {
      await s.ensureSharedRoom();
      const who = await s.callTool("whoami");
      expect(who.user_id).toBe("@rei:matrix.suzuya.dev");
    });
  });
};
