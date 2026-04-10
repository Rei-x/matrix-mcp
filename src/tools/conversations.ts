import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type {
  MatrixToolClient,
  MessageEvent,
  RoomSummary,
} from "@/matrix/client";

const DEFAULT_LIST_LIMIT = 15;
const MAX_LIST_LIMIT = 50;
const DEFAULT_READ_LIMIT = 20;
const MAX_READ_LIMIT = 50;

const conversationTitle = (name: string | null): string => {
  const trimmed = name?.trim();
  return trimmed !== undefined && trimmed !== "" ? trimmed : "Unnamed chat";
};

const roomMatchesQuery = (room: RoomSummary, q: string): boolean => {
  const hay = [room.room_id, room.name ?? "", room.topic ?? ""]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
};

const sortByRecentTimestamp = (rooms: RoomSummary[]): RoomSummary[] =>
  [...rooms].toSorted((a, b) => {
    if (a.last_message_ts === null && b.last_message_ts === null) {
      return 0;
    }
    if (a.last_message_ts === null) {
      return 1;
    }
    if (b.last_message_ts === null) {
      return -1;
    }
    return b.last_message_ts - a.last_message_ts;
  });

const senderLocalpart = (mxid: string): string => {
  const m = /^@([^:]+):/.exec(mxid);
  return m?.[1] ?? mxid;
};

const transcriptLine = (event: MessageEvent): string => {
  const time = new Date(event.origin_server_ts).toISOString();
  const sender = senderLocalpart(event.sender);
  return `${time} ${sender} [${event.event_id}]: ${event.body}`;
};

const conversationSummarySchema = z.object({
  conversation_id: z.string(),
  last_activity: z.string().nullable(),
  title: z.string(),
});

type ConversationSummary = z.infer<typeof conversationSummarySchema>;

const toConversationSummary = (room: RoomSummary): ConversationSummary => ({
  conversation_id: room.room_id,
  last_activity:
    room.last_message_ts === null
      ? null
      : new Date(room.last_message_ts).toISOString(),
  title: conversationTitle(room.name),
});

const clampLimit = (
  value: number | undefined,
  defaultValue: number,
  max: number
): number => Math.min(Math.max(1, value ?? defaultValue), max);

export const createConversationTools = (client: MatrixToolClient) => ({
  list_conversations: createTool({
    description: [
      "Lists your Matrix chats (1:1 DMs, group rooms, and bridge bots), most recently active first.",
      "Each entry has a `conversation_id` (pass to `read_conversation` or `send_message`), a human `title`, and `last_activity` (ISO timestamp or null if the room has no messages).",
      "Use `query` to find a chat by case-insensitive substring of its title, topic, or id. Default limit is 15 (max 50). Reads from in-memory state — calling this is cheap.",
    ].join(" "),
    // eslint-disable-next-line require-await -- Mastra createTool's execute must return a Promise even when the underlying read is synchronous
    execute: async (args) => {
      const limit = clampLimit(args.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
      const allRooms = client.listJoinedRooms();
      const q = args.query?.trim().toLowerCase();
      const filtered =
        q !== undefined && q !== ""
          ? allRooms.filter((room) => roomMatchesQuery(room, q))
          : allRooms;
      const sorted = sortByRecentTimestamp(filtered);
      return {
        conversations: sorted.slice(0, limit).map(toConversationSummary),
        total: allRooms.length,
      };
    },
    id: "list_conversations",
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_LIST_LIMIT)
        .optional()
        .describe(
          `max conversations to return (default ${DEFAULT_LIST_LIMIT})`
        ),
      query: z
        .string()
        .optional()
        .describe(
          "case-insensitive substring filter on title, topic, or conversation_id"
        ),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      conversations: z.array(conversationSummarySchema),
      total: z
        .number()
        .describe(
          "total number of joined conversations (before applying query/limit)"
        ),
    }),
  }),

  read_conversation: createTool({
    description: [
      "Reads recent messages from a conversation as a single oldest-first transcript string.",
      "Each line has the form `<iso-timestamp> <sender-localpart> [<message_id>]: <text>` — pass that `message_id` as `reply_to_message_id` in `send_message` to reply to that specific message.",
      "To page back further into history, call again with `cursor` set to the previous response's `next_cursor`. Default limit is 20 (max 50).",
    ].join(" "),
    execute: async (args) => {
      const limit = clampLimit(args.limit, DEFAULT_READ_LIMIT, MAX_READ_LIMIT);
      const page = await client.readMessages(args.conversation_id, {
        from: args.cursor,
        limit,
      });
      const chronological = page.events.toReversed();
      const lines = chronological.map(transcriptLine);
      return {
        conversation_id: args.conversation_id,
        message_count: lines.length,
        next_cursor: page.next_batch,
        transcript: lines.join("\n"),
      };
    },
    id: "read_conversation",
    inputSchema: z.object({
      conversation_id: z
        .string()
        .describe(
          "conversation_id from list_conversations (Matrix room id, e.g. !abc:example.com)"
        ),
      cursor: z
        .string()
        .optional()
        .describe(
          "pagination token returned as `next_cursor` from a previous call; omit for the latest page"
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_READ_LIMIT)
        .optional()
        .describe(`max messages to fetch (default ${DEFAULT_READ_LIMIT})`),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      conversation_id: z.string(),
      message_count: z.number(),
      next_cursor: z
        .string()
        .optional()
        .describe(
          "pass back as `cursor` to fetch the next (older) page; absent when at the start of history"
        ),
      transcript: z.string(),
    }),
  }),

  send_message: createTool({
    description: [
      "Sends a plain-text message to a conversation.",
      "To reply to a specific message, set `reply_to_message_id` to its id (visible inside `[...]` in `read_conversation` transcripts). Returns the new message's `message_id`.",
    ].join(" "),
    execute: async (args) => {
      const result =
        args.reply_to_message_id !== undefined &&
        args.reply_to_message_id !== ""
          ? await client.sendReply(
              args.conversation_id,
              args.reply_to_message_id,
              args.body
            )
          : await client.sendText(args.conversation_id, args.body);
      return { message_id: result.event_id };
    },
    id: "send_message",
    inputSchema: z.object({
      body: z.string().min(1).describe("plain-text message body"),
      conversation_id: z
        .string()
        .describe("conversation_id from list_conversations"),
      reply_to_message_id: z
        .string()
        .optional()
        .describe(
          "message_id to reply to (from a `[<message_id>]` tag in a read_conversation transcript)"
        ),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      message_id: z.string(),
    }),
  }),
});
