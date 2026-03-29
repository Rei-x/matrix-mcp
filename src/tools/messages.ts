import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { MatrixClient } from "@/matrix/client";

const formattedMessageSchema = z.object({
  body: z.string(),
  event_id: z.string(),
  sender: z.string(),
  timestamp: z.string(),
  type: z.string(),
});

const sendResultSchema = z.object({
  event_id: z.string(),
  sent: z.literal(true),
});

export const createMessageTools = (client: MatrixClient) => ({
  read_messages: createTool({
    description:
      "Read messages from a Matrix room with pagination support. Returns messages in reverse chronological order by default.",
    execute: async (args) => {
      const result = await client.getRoomMessages(args.room_id, {
        dir: "b",
        filter: JSON.stringify({ types: ["m.room.message"] }),
        from: args.from,
        limit: args.limit,
      });

      const messages = result.chunk.map((event) => {
        const time = new Date(event.origin_server_ts).toISOString();
        const body = String(event.content.body ?? "");
        const msgtype = String(
          event.content.msgtype ?? event.content.type ?? "unknown"
        );
        return {
          body,
          event_id: event.event_id,
          sender: event.sender,
          timestamp: time,
          type: msgtype,
        };
      });

      return {
        messages,
        next_batch: result.end,
        room_id: args.room_id,
      };
    },
    id: "read_messages",
    inputSchema: z.object({
      from: z
        .string()
        .optional()
        .describe("Pagination token to continue from a previous request"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of messages to return (default: 50)"),
      room_id: z.string().describe("The Matrix room ID to read messages from"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      messages: z.array(formattedMessageSchema),
      next_batch: z.string().optional(),
      room_id: z.string(),
    }),
  }),

  redact_message: createTool({
    description:
      "Delete/redact a message from a Matrix room. Optionally provide a reason.",
    execute: async (args) => {
      const result = await client.redactEvent(
        args.room_id,
        args.event_id,
        args.reason
      );
      return { event_id: result.event_id, redacted: true as const };
    },
    id: "redact_message",
    inputSchema: z.object({
      event_id: z.string().describe("The event ID of the message to redact"),
      reason: z
        .string()
        .optional()
        .describe("Optional reason for the redaction"),
      room_id: z.string().describe("The room ID containing the message"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      event_id: z.string(),
      redacted: z.literal(true),
    }),
  }),

  reply_to_message: createTool({
    description:
      "Reply to a specific message in a Matrix room. Creates a threaded reply.",
    execute: async (args) => {
      const result = await client.replyToMessage(
        args.room_id,
        args.event_id,
        args.body
      );
      return { event_id: result.event_id, sent: true as const };
    },
    id: "reply_to_message",
    inputSchema: z.object({
      body: z.string().describe("The reply text"),
      event_id: z.string().describe("The event ID of the message to reply to"),
      room_id: z.string().describe("The room ID containing the message"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: sendResultSchema,
  }),

  send_message: createTool({
    description: "Send a text message to a Matrix room.",
    execute: async (args) => {
      const result = await client.sendMessage(args.room_id, args.body);
      return { event_id: result.event_id, sent: true as const };
    },
    id: "send_message",
    inputSchema: z.object({
      body: z.string().describe("The message text to send"),
      room_id: z.string().describe("The room ID to send the message to"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: sendResultSchema,
  }),

  send_reaction: createTool({
    description:
      "Send a reaction (emoji) to a specific message in a Matrix room.",
    execute: async (args) => {
      const result = await client.sendReaction(
        args.room_id,
        args.event_id,
        args.reaction
      );
      return { event_id: result.event_id, sent: true as const };
    },
    id: "send_reaction",
    inputSchema: z.object({
      event_id: z.string().describe("The event ID of the message to react to"),
      reaction: z.string().describe("The reaction emoji (e.g., \uD83D\uDC4D)"),
      room_id: z.string().describe("The room ID containing the message"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: sendResultSchema,
  }),

  send_read_receipt: createTool({
    description: "Mark a message as read by sending a read receipt.",
    execute: async (args) => {
      await client.sendReadReceipt(args.room_id, args.event_id);
      return { marked_read: true as const };
    },
    id: "send_read_receipt",
    inputSchema: z.object({
      event_id: z.string().describe("The event ID to mark as read"),
      room_id: z.string().describe("The room ID containing the message"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({ marked_read: z.literal(true) }),
  }),
});
