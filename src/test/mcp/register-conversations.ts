import { describe, expect, it } from "vitest";
import { z } from "zod";

import { assertPresent, sharedRoomIdLooksValid } from "./suite";
import type { McpSuite } from "./suite";

export const registerConversationTests = (s: McpSuite): void => {
  describe("list_conversations", () => {
    it("should list joined conversations with stable shape", async () => {
      await s.ensureSharedRoom();
      const lr = z
        .object({
          conversations: z
            .array(
              z.object({
                conversation_id: z.string(),
                last_activity: z.string().nullable(),
                title: z.string(),
              })
            )
            .min(1),
          total_joined: z.number(),
        })
        .parse(await s.callTool("list_conversations", { limit: 5 }));
      expect(lr.total_joined).toBeGreaterThan(0);
      expect(lr.conversations.length).toBeLessThanOrEqual(5);
      const [head] = lr.conversations;
      const first = assertPresent(
        head,
        "unreachable: list_conversations min(1)"
      );
      expect(first.conversation_id).toMatch(/^!/);
    }, 60_000);

    it("should default limit to 15", async () => {
      await s.ensureSharedRoom();
      const lr = z
        .object({
          conversations: z.array(z.object({ conversation_id: z.string() })),
        })
        .parse(await s.callTool("list_conversations", {}));
      expect(lr.conversations.length).toBeLessThanOrEqual(15);
    }, 60_000);

    it("should filter by query substring", async () => {
      await s.ensureSharedRoom();
      const lr = z
        .object({
          conversations: z.array(
            z.object({ conversation_id: z.string(), title: z.string() })
          ),
          total_joined: z.number(),
        })
        .parse(
          await s.callTool("list_conversations", {
            limit: 20,
            query: s.room.id,
          })
        );
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
      const result = z
        .object({
          conversation_id: z.string(),
          message_count: z.number(),
          transcript: z.string(),
        })
        .parse(
          await s.callTool("read_conversation", {
            conversation_id: s.room.id,
            limit: 5,
          })
        );
      expect(result.conversation_id).toBe(s.room.id);
      expect(result.message_count).toBeGreaterThanOrEqual(0);
    });

    it("should support pagination", async () => {
      await s.ensureSharedRoom();
      const first = z
        .object({
          conversation_id: z.string(),
          message_count: z.number(),
          next_batch: z.string(),
          transcript: z.string(),
        })
        .parse(
          await s.callTool("read_conversation", {
            conversation_id: s.room.id,
            limit: 2,
          })
        );
      const second = z
        .object({
          conversation_id: z.string(),
          message_count: z.number(),
          transcript: z.string(),
        })
        .parse(
          await s.callTool("read_conversation", {
            conversation_id: s.room.id,
            from: first.next_batch,
            limit: 2,
          })
        );
      expect(second.conversation_id).toBe(s.room.id);
    });

    it("should include event ids when requested", async () => {
      await s.ensureSharedRoom();
      await s.callTool("send_message", {
        body: "Event id line test",
        conversation_id: s.room.id,
      });
      const result = z.object({ transcript: z.string() }).parse(
        await s.callTool("read_conversation", {
          conversation_id: s.room.id,
          include_event_ids: true,
          limit: 5,
        })
      );
      expect(result.transcript).toContain("$");
    });
  });

  describe("send_message", () => {
    it("should send a message", async () => {
      await s.ensureSharedRoom();
      const result = z
        .object({ event_id: z.string(), sent: z.literal(true) })
        .parse(
          await s.callTool("send_message", {
            body: "Hello from MCP integration test!",
            conversation_id: s.room.id,
          })
        );
      expect(result.sent).toBeTruthy();
      expect(result.event_id.length).toBeGreaterThan(0);
    });

    it("should read back sent text in transcript", async () => {
      await s.ensureSharedRoom();
      const result = z.object({ transcript: z.string() }).parse(
        await s.callTool("read_conversation", {
          conversation_id: s.room.id,
          limit: 15,
        })
      );
      expect(result.transcript).toContain("Hello from MCP integration test!");
    });

    it("should reply when reply_to_event_id is set", async () => {
      await s.ensureSharedRoom();
      const sendResult = z.object({ event_id: z.string() }).parse(
        await s.callTool("send_message", {
          body: "Original for reply test",
          conversation_id: s.room.id,
        })
      );
      const replyResult = z
        .object({ event_id: z.string(), sent: z.literal(true) })
        .parse(
          await s.callTool("send_message", {
            body: "Thread reply body",
            conversation_id: s.room.id,
            reply_to_event_id: sendResult.event_id,
          })
        );
      expect(replyResult.sent).toBeTruthy();
      const read = z.object({ transcript: z.string() }).parse(
        await s.callTool("read_conversation", {
          conversation_id: s.room.id,
          limit: 10,
        })
      );
      expect(read.transcript).toContain("Thread reply body");
    });
  });

  describe("shared conversation", () => {
    it("should use a valid room id", () => {
      expect(sharedRoomIdLooksValid(s.room.id)).toBeTruthy();
    });
  });
};
