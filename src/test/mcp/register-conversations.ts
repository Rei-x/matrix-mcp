import { describe, expect, it } from "vitest";

import { assertPresent, sharedRoomIdLooksValid } from "./suite";
import type { McpSuite } from "./suite";

export const registerConversationTests = (s: McpSuite): void => {
  describe("list_conversations", () => {
    it("should list joined conversations with stable shape", async () => {
      await s.ensureSharedRoom();
      const lr = await s.callTool("list_conversations", { limit: 5 });
      expect(lr.total).toBeGreaterThan(0);
      expect(lr.conversations.length).toBeGreaterThanOrEqual(1);
      expect(lr.conversations.length).toBeLessThanOrEqual(5);
      const first = assertPresent(
        lr.conversations.at(0),
        "unreachable: list_conversations expected at least one conversation"
      );
      expect(first.conversation_id).toMatch(/^!/);
    }, 60_000);

    it("should default limit to 15", async () => {
      await s.ensureSharedRoom();
      const lr = await s.callTool("list_conversations");
      expect(lr.conversations.length).toBeLessThanOrEqual(15);
    }, 60_000);

    it("should filter by query substring", async () => {
      await s.ensureSharedRoom();
      const lr = await s.callTool("list_conversations", {
        limit: 20,
        query: s.room.id,
      });
      expect(lr.conversations.length).toBeGreaterThanOrEqual(1);
      for (const c of lr.conversations) {
        expect(c.conversation_id.toLowerCase()).toContain(
          s.room.id.toLowerCase()
        );
      }
    }, 60_000);
  });

  describe("read_conversation", () => {
    it("should return a transcript", async () => {
      await s.ensureSharedRoom();
      const result = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 5,
      });
      expect(result.conversation_id).toBe(s.room.id);
      expect(result.message_count).toBeGreaterThanOrEqual(0);
    });

    it("should support pagination via cursor/next_cursor", async () => {
      await s.ensureSharedRoom();
      const first = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 2,
      });
      const cursor = assertPresent(
        first.next_cursor,
        "expected next_cursor token from first read_conversation page"
      );
      const second = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        cursor,
        limit: 2,
      });
      expect(second.conversation_id).toBe(s.room.id);
    });

    it("should always include message ids in transcript lines", async () => {
      await s.ensureSharedRoom();
      await s.callTool("send_message", {
        body: "Message id line test",
        conversation_id: s.room.id,
      });
      const result = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 5,
      });
      expect(result.transcript).toContain("$");
    });
  });

  describe("send_message", () => {
    it("should send a message and return its message_id", async () => {
      await s.ensureSharedRoom();
      const result = await s.callTool("send_message", {
        body: "Hello from MCP integration test!",
        conversation_id: s.room.id,
      });
      expect(result.message_id.length).toBeGreaterThan(0);
    });

    it("should read back sent text in transcript", async () => {
      await s.ensureSharedRoom();
      const result = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 15,
      });
      expect(result.transcript).toContain("Hello from MCP integration test!");
    });

    it("should reply when reply_to_message_id is set", async () => {
      await s.ensureSharedRoom();
      const sendResult = await s.callTool("send_message", {
        body: "Original for reply test",
        conversation_id: s.room.id,
      });
      const replyResult = await s.callTool("send_message", {
        body: "Thread reply body",
        conversation_id: s.room.id,
        reply_to_message_id: sendResult.message_id,
      });
      expect(replyResult.message_id.length).toBeGreaterThan(0);
      const read = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 10,
      });
      expect(read.transcript).toContain("Thread reply body");
    });
  });

  describe("shared conversation", () => {
    it("should use a valid room id", () => {
      expect(sharedRoomIdLooksValid(s.room.id)).toBeTruthy();
    });
  });
};
