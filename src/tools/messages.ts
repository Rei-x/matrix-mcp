import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MatrixClient } from "@/matrix/client";

const formatMessage = (event: {
  content: Record<string, unknown>;
  event_id: string;
  origin_server_ts: number;
  sender: string;
}) => {
  const time = new Date(event.origin_server_ts).toISOString();
  const body = (event.content.body as string) ?? "";
  const msgtype =
    (event.content.msgtype as string) ?? event.content.type ?? "unknown";
  return {
    body,
    event_id: event.event_id,
    sender: event.sender,
    timestamp: time,
    type: msgtype,
  };
};

export const registerMessageTools = (
  server: McpServer,
  client: MatrixClient
) => {
  server.registerTool(
    "read_messages",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description:
        "Read messages from a Matrix room with pagination support. Returns messages in reverse chronological order by default.",
      inputSchema: {
        from: z
          .string()
          .optional()
          .describe("Pagination token to continue from a previous request"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of messages to return (default: 50)"),
        room_id: z
          .string()
          .describe("The Matrix room ID to read messages from"),
      },
      title: "Read Messages",
    },
    async (args) => {
      const result = await client.getRoomMessages(args.room_id, {
        dir: "b",
        filter: JSON.stringify({ types: ["m.room.message"] }),
        from: args.from,
        limit: args.limit,
      });

      const messages = result.chunk.map(formatMessage);

      const response = {
        messages,
        next_batch: result.end,
        room_id: args.room_id,
      };

      return {
        content: [
          { text: JSON.stringify(response, null, 2), type: "text" as const },
        ],
      };
    }
  );

  server.registerTool(
    "send_message",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description: "Send a text message to a Matrix room.",
      inputSchema: {
        body: z.string().describe("The message text to send"),
        room_id: z.string().describe("The room ID to send the message to"),
      },
      title: "Send Message",
    },
    async (args) => {
      const result = await client.sendMessage(args.room_id, args.body);
      return {
        content: [
          {
            text: JSON.stringify({
              event_id: result.event_id,
              sent: true,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.registerTool(
    "send_reaction",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description:
        "Send a reaction (emoji) to a specific message in a Matrix room.",
      inputSchema: {
        event_id: z
          .string()
          .describe("The event ID of the message to react to"),
        reaction: z
          .string()
          .describe("The reaction emoji (e.g., \uD83D\uDC4D)"),
        room_id: z.string().describe("The room ID containing the message"),
      },
      title: "Send Reaction",
    },
    async (args) => {
      const result = await client.sendReaction(
        args.room_id,
        args.event_id,
        args.reaction
      );
      return {
        content: [
          {
            text: JSON.stringify({
              event_id: result.event_id,
              sent: true,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.registerTool(
    "send_read_receipt",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: false,
      },
      description: "Mark a message as read by sending a read receipt.",
      inputSchema: {
        event_id: z.string().describe("The event ID to mark as read"),
        room_id: z.string().describe("The room ID containing the message"),
      },
      title: "Send Read Receipt",
    },
    async (args) => {
      await client.sendReadReceipt(args.room_id, args.event_id);
      return {
        content: [
          {
            text: JSON.stringify({ marked_read: true }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.registerTool(
    "reply_to_message",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description:
        "Reply to a specific message in a Matrix room. Creates a threaded reply.",
      inputSchema: {
        body: z.string().describe("The reply text"),
        event_id: z
          .string()
          .describe("The event ID of the message to reply to"),
        room_id: z.string().describe("The room ID containing the message"),
      },
      title: "Reply to Message",
    },
    async (args) => {
      const result = await client.replyToMessage(
        args.room_id,
        args.event_id,
        args.body
      );
      return {
        content: [
          {
            text: JSON.stringify({
              event_id: result.event_id,
              sent: true,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.registerTool(
    "redact_message",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description:
        "Delete/redact a message from a Matrix room. Optionally provide a reason.",
      inputSchema: {
        event_id: z.string().describe("The event ID of the message to redact"),
        reason: z
          .string()
          .optional()
          .describe("Optional reason for the redaction"),
        room_id: z.string().describe("The room ID containing the message"),
      },
      title: "Redact Message",
    },
    async (args) => {
      const result = await client.redactEvent(
        args.room_id,
        args.event_id,
        args.reason
      );
      return {
        content: [
          {
            text: JSON.stringify({
              event_id: result.event_id,
              redacted: true,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );
};
