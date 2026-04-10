import { describe, expect, it } from "vitest";
import { z } from "zod";

import { assertPresent, rpcIndicatesToolFailure } from "./suite";
import type { McpSuite } from "./suite";

export const registerErrorHandlingTests = (s: McpSuite): void => {
  describe("error handling", () => {
    it("should surface Matrix errors for invalid conversation", async () => {
      await s.ensureSharedRoom();
      const result = await s.callToolRaw("read_conversation", {
        conversation_id: "!nonexistent_room_id:matrix.suzuya.dev",
        limit: 1,
      });
      expect(result.isError).toBeTruthy();
      const blocks = z
        .array(z.object({ text: z.string() }))
        .min(1)
        .parse(result.content);
      const [headErrBlock] = blocks;
      const firstErrBlock = assertPresent(
        headErrBlock,
        "unreachable: error tool content min(1)"
      );
      const { text } = z.object({ text: z.string() }).parse(firstErrBlock);
      expect(text).toContain("Matrix API error");
    });

    it("should return error for invalid tool", async () => {
      await s.ensureSharedRoom();
      const response = await s.mcpRequestRaw({
        id: 999,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "nonexistent_tool" },
      });
      const parsed = z.record(z.unknown()).parse(response);
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(999);
      expect(rpcIndicatesToolFailure(parsed)).toBeTruthy();
    });
  });
};
