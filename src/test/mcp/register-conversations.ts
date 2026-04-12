import { describe, expect, it } from "vitest";

import { assertPresent, sharedRoomIdLooksValid } from "./suite";
import type { McpSuite } from "./suite";

export const registerConversationTests = (s: McpSuite): void => {
  describe("list_conversations", () => {
    it("should list joined conversations with stable shape", async () => {
      await s.ensureSharedRoom();
      const lr = await s.callTool("list_conversations", {});
      expect(lr.total).toBeGreaterThan(0);
      expect(lr.conversations.length).toBeGreaterThanOrEqual(1);
      expect(lr.conversations.length).toBeLessThanOrEqual(500);
      const first = assertPresent(
        lr.conversations.at(0),
        "unreachable: list_conversations expected at least one conversation"
      );
      expect(first.conversation_id).toMatch(/^!/);
    }, 60_000);

    it("should paginate with offset", async () => {
      await s.ensureSharedRoom();
      const lr = await s.callTool("list_conversations", {});
      if (lr.has_more) {
        const page2 = await s.callTool("list_conversations", { offset: 20 });
        expect(page2.conversations.length).toBeGreaterThanOrEqual(1);
        expect(page2.total).toBe(lr.total);
      }
    }, 60_000);

    it("should return empty page when offset exceeds total", async () => {
      await s.ensureSharedRoom();
      const lr = await s.callTool("list_conversations", {
        offset: 999_999,
      });
      expect(lr.conversations).toHaveLength(0);
      expect(lr.has_more).toBe(false);
      expect(lr.total).toBeGreaterThan(0);
    }, 60_000);

    it("should filter by query substring", async () => {
      await s.ensureSharedRoom();
      const lr = await s.callTool("list_conversations", {
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
    it("should return structured messages", async () => {
      await s.ensureSharedRoom();
      const result = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 5,
      });
      expect(result.conversation_id).toBe(s.room.id);
      expect(result.message_count).toBeGreaterThanOrEqual(0);
      expect(result.messages).toBeInstanceOf(Array);
      if (result.messages.length > 0) {
        const [msg] = result.messages;
        expect(msg).toHaveProperty("body");
        expect(msg).toHaveProperty("message_id");
        expect(msg).toHaveProperty("sender");
        expect(msg).toHaveProperty("timestamp");
        expect(msg).toHaveProperty("type");
      }
    });

    it("should return total message count", async () => {
      await s.ensureSharedRoom();
      const result = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
      });
      expect(result.total).toBeGreaterThanOrEqual(result.message_count);
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

    it("should filter messages with after date", async () => {
      await s.ensureSharedRoom();
      // Read all messages to get an existing timestamp to split on
      const all = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 50,
      });
      // Use a far-future date: should return nothing
      const empty = await s.callTool("read_conversation", {
        after: "2099-01-01",
        conversation_id: s.room.id,
        limit: 50,
      });
      expect(empty.message_count).toBe(0);
      // Use epoch: should return everything
      const everything = await s.callTool("read_conversation", {
        after: "2000-01-01",
        conversation_id: s.room.id,
        limit: 50,
      });
      expect(everything.message_count).toBe(all.message_count);
    });

    it("should filter messages with before date", async () => {
      await s.ensureSharedRoom();
      const all = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 50,
      });
      // Use epoch: should return nothing (before is exclusive)
      const empty = await s.callTool("read_conversation", {
        before: "2000-01-01",
        conversation_id: s.room.id,
        limit: 50,
      });
      expect(empty.message_count).toBe(0);
      // Use far-future: should return everything
      const everything = await s.callTool("read_conversation", {
        before: "2099-01-01",
        conversation_id: s.room.id,
        limit: 50,
      });
      expect(everything.message_count).toBe(all.message_count);
    });

    it("should filter messages with both after and before", async () => {
      await s.ensureSharedRoom();
      const before = new Date().toISOString();
      await s.callTool("send_message", {
        body: "date-range-bracket-test",
        conversation_id: s.room.id,
      });
      const after = new Date().toISOString();
      // Bracket: after > before → should return nothing
      const empty = await s.callTool("read_conversation", {
        after,
        before,
        conversation_id: s.room.id,
        limit: 50,
      });
      expect(empty.message_count).toBe(0);
    });

    it("should include message_id on every message", async () => {
      await s.ensureSharedRoom();
      await s.callTool("send_message", {
        body: "Message id structured test",
        conversation_id: s.room.id,
      });
      const result = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 5,
      });
      for (const msg of result.messages) {
        expect(msg.message_id).toMatch(/^\$/);
      }
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

    it("should read back sent text in messages", async () => {
      await s.ensureSharedRoom();
      const result = await s.callTool("read_conversation", {
        conversation_id: s.room.id,
        limit: 15,
      });
      const bodies = result.messages.map((m) => m.body);
      expect(bodies).toContain("Hello from MCP integration test!");
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
      const replyMsg = read.messages.find(
        (m) => m.message_id === replyResult.message_id
      );
      expect(replyMsg).toBeDefined();
      expect(replyMsg?.body).toBe("Thread reply body");
      expect(replyMsg?.reply_to).toBe(sendResult.message_id);
    });
  });

  describe("shared conversation", () => {
    it("should use a valid room id", () => {
      expect(sharedRoomIdLooksValid(s.room.id)).toBeTruthy();
    });
  });
};
