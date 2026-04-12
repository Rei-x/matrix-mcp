import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type {
  MatrixToolClient,
  MessageEvent,
  RoomSummary,
} from "@/matrix/client";

const LIST_PAGE_SIZE = 500;
const DEFAULT_READ_LIMIT = 50;
const MAX_READ_LIMIT = 500;
const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 500;

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

const messageType = (msgtype: string): string => {
  const map: Record<string, string> = {
    "m.audio": "audio",
    "m.emote": "emote",
    "m.file": "file",
    "m.image": "image",
    "m.location": "location",
    "m.notice": "notice",
    "m.text": "text",
    "m.video": "video",
  };
  return map[msgtype] ?? msgtype;
};

const toTranscriptMessage = (event: MessageEvent) => ({
  body: event.body,
  message_id: event.event_id,
  ...(event.reply_to_event_id === undefined
    ? {}
    : { reply_to: event.reply_to_event_id }),
  sender: senderLocalpart(event.sender),
  timestamp: new Date(event.origin_server_ts).toISOString(),
  type: messageType(event.msgtype),
});

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

const parseDate = (value: string | undefined): number | null => {
  if (value === undefined) {
    return null;
  }
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
};

const clampLimit = (
  value: number | undefined,
  defaultValue: number,
  max: number
): number => Math.min(Math.max(1, value ?? defaultValue), max);

const enrichError = (err: unknown, hint: string): Error => {
  const msg = err instanceof Error ? err.message : String(err);
  return new Error(`${msg} — ${hint}`);
};

export const createConversationTools = (client: MatrixToolClient) => ({
  list_conversations: createTool({
    description: [
      "Lists your Matrix chats sorted by most recent activity.",
      "`query` filters on title/topic/id only — use `search_messages` to find chats by message content.",
      "Paginate with `offset`.",
    ].join(" "),
    // eslint-disable-next-line require-await -- Mastra createTool's execute must return a Promise even when the underlying read is synchronous
    execute: async (args) => {
      const offset = Math.max(0, args.offset ?? 0);
      const allRooms = client.listJoinedRooms();
      const q = args.query?.trim().toLowerCase();
      const filtered =
        q !== undefined && q !== ""
          ? allRooms.filter((room) => roomMatchesQuery(room, q))
          : allRooms;
      const sorted = sortByRecentTimestamp(filtered);
      const page = sorted.slice(offset, offset + LIST_PAGE_SIZE);
      const hint =
        page.length === 0 && q !== undefined && q !== ""
          ? `No conversations match '${args.query ?? ""}'. Try a broader query, or use search_messages to find a chat by message content.`
          : "Use read_conversation with a conversation_id to read messages, or search_messages to find a chat by something someone said.";
      return {
        conversations: page.map(toConversationSummary),
        has_more: offset + LIST_PAGE_SIZE < sorted.length,
        hint,
        total: sorted.length,
      };
    },
    id: "list_conversations",
    inputSchema: z.object({
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("skip this many conversations for pagination (default 0)"),
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
      has_more: z
        .boolean()
        .describe("true if more conversations exist beyond this page"),
      hint: z.string(),
      total: z
        .number()
        .describe(
          "total number of matching conversations (after query filter)"
        ),
    }),
  }),

  read_conversation: createTool({
    description: [
      "Reads messages from a conversation as a structured array, oldest first.",
      "Each message has `sender`, `body`, `type` (text/image/file/video/audio/emote/notice/location), `message_id`, `timestamp`, and optionally `reply_to` (the message_id being replied to).",
      "Page back with `cursor` from the previous `next_cursor`. Use `search_messages` first if looking for specific content.",
    ].join(" "),
    execute: async (args) => {
      let page;
      try {
        const limit = clampLimit(
          args.limit,
          DEFAULT_READ_LIMIT,
          MAX_READ_LIMIT
        );
        page = await client.readMessages(args.conversation_id, {
          from: args.cursor,
          limit,
        });
      } catch (error) {
        throw enrichError(
          error,
          "Use list_conversations to find valid conversation IDs."
        );
      }
      const afterTs = parseDate(args.after);
      const beforeTs = parseDate(args.before);
      const chronological = page.events.toReversed();
      const filtered = chronological.filter((ev) => {
        if (afterTs !== null && ev.origin_server_ts < afterTs) {
          return false;
        }
        if (beforeTs !== null && ev.origin_server_ts >= beforeTs) {
          return false;
        }
        return true;
      });
      const hasMore = page.next_batch !== undefined;
      let hint: string;
      if (filtered.length === 0 && (afterTs !== null || beforeTs !== null)) {
        hint =
          "No messages in this date range. Try widening after/before, or omit them to see the latest messages.";
      } else if (filtered.length === 0) {
        hint = "No messages found. The conversation may be empty.";
      } else if (hasMore) {
        hint =
          "Pass next_cursor as cursor to page further back. Use send_message with a message_id to reply.";
      } else {
        hint = "Use send_message with a message_id to reply to a message.";
      }
      return {
        conversation_id: args.conversation_id,
        hint,
        message_count: filtered.length,
        messages: filtered.map(toTranscriptMessage),
        next_cursor: page.next_batch,
        total: client.countRoomMessages(args.conversation_id),
      };
    },
    id: "read_conversation",
    inputSchema: z.object({
      after: z
        .string()
        .optional()
        .describe(
          "only include messages at or after this ISO date/datetime (e.g. 2025-03-01)"
        ),
      before: z
        .string()
        .optional()
        .describe(
          "only include messages before this ISO date/datetime (e.g. 2025-04-01)"
        ),
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
      hint: z.string(),
      message_count: z.number(),
      messages: z.array(
        z.object({
          body: z.string(),
          message_id: z.string(),
          reply_to: z
            .string()
            .optional()
            .describe("message_id this is replying to"),
          sender: z.string(),
          timestamp: z.string(),
          type: z
            .string()
            .describe(
              "text, image, file, video, audio, emote, notice, or location"
            ),
        })
      ),
      next_cursor: z
        .string()
        .optional()
        .describe(
          "pass back as `cursor` to fetch the next (older) page; absent when at the start of history"
        ),
      total: z
        .number()
        .describe(
          "total messages known in this conversation (from in-memory state; older messages may exist on the server)"
        ),
    }),
  }),

  search_messages: createTool({
    description: [
      "Search the bodies of recent messages across your joined conversations for a case-insensitive substring.",
      "Use this BEFORE `read_conversation` whenever you want to find a chat by something a person *said* (e.g. 'spotify link', 'CONCURRENTLY', 'Brooklyn Boulders', a URL, a ticket id) — it's far cheaper than reading every conversation one by one.",
      "Each match returns its `conversation_id` (use with `read_conversation` or `send_message`), the `conversation_title`, the `message_id`, sender, ISO timestamp, and the matching body.",
      "Scope to one conversation by passing `conversation_id`. Note: search reads from the in-memory synced state, so very old messages that were never paged in may be missed; the `truncated` flag indicates this.",
    ].join(" "),
    // eslint-disable-next-line require-await -- Mastra createTool's execute must return a Promise even when the underlying read is synchronous
    execute: async (args) => {
      const limit = clampLimit(
        args.limit,
        DEFAULT_SEARCH_LIMIT,
        MAX_SEARCH_LIMIT
      );
      const result = client.searchMessages(args.query, {
        conversation_id: args.conversation_id,
        limit,
      });
      const matches = result.matches.map((m) => ({
        body: m.body,
        conversation_id: m.conversation_id,
        conversation_title: m.conversation_title ?? "Unnamed chat",
        message_id: m.message_id,
        sender: senderLocalpart(m.sender),
        timestamp: new Date(m.origin_server_ts).toISOString(),
      }));
      const hint =
        matches.length > 0
          ? "Use read_conversation with a conversation_id for full context around a match."
          : `No messages match '${args.query}'. Try different keywords, or use list_conversations to browse by room title.`;
      return {
        hint,
        matches,
        total: result.total,
        truncated: result.truncated,
      };
    },
    id: "search_messages",
    inputSchema: z.object({
      conversation_id: z
        .string()
        .optional()
        .describe(
          "optional: scope the search to a single conversation (Matrix room id from `list_conversations`)"
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_SEARCH_LIMIT)
        .optional()
        .describe(
          `max matches to return (default ${DEFAULT_SEARCH_LIMIT}, max ${MAX_SEARCH_LIMIT})`
        ),
      query: z
        .string()
        .min(1)
        .describe(
          "case-insensitive substring to find anywhere in a message body (e.g. a name, URL, error code, keyword)"
        ),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      hint: z.string(),
      matches: z.array(
        z.object({
          body: z.string(),
          conversation_id: z.string(),
          conversation_title: z.string(),
          message_id: z.string(),
          sender: z.string(),
          timestamp: z.string(),
        })
      ),
      total: z
        .number()
        .describe(
          "total number of matches found in the synced state (may exceed `matches.length` if `limit` truncated the result)"
        ),
      truncated: z
        .boolean()
        .describe(
          "true if a room hit its in-memory message limit; older messages on the server may have been missed"
        ),
    }),
  }),

  send_message: createTool({
    description: [
      "Sends a plain-text message to a conversation.",
      "Set `reply_to_message_id` to a `message_id` from `read_conversation` to reply to that message.",
    ].join(" "),
    execute: async (args) => {
      try {
        const result =
          args.reply_to_message_id !== undefined &&
          args.reply_to_message_id !== ""
            ? await client.sendReply(
                args.conversation_id,
                args.reply_to_message_id,
                args.body
              )
            : await client.sendText(args.conversation_id, args.body);
        return {
          hint: "Message sent. Use read_conversation to verify delivery.",
          message_id: result.event_id,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("M_NOT_FOUND")) {
          throw enrichError(
            error,
            "Use list_conversations to find valid conversation IDs."
          );
        }
        if (msg.includes("M_FORBIDDEN")) {
          throw enrichError(
            error,
            "You may not have permission to post in this conversation."
          );
        }
        throw error;
      }
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
        .describe("message_id to reply to (from read_conversation messages)"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      hint: z.string(),
      message_id: z.string(),
    }),
  }),
});
