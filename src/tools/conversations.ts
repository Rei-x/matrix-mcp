import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { MatrixClient, MatrixEvent } from "@/matrix/client";

const ROOM_BATCH = 10;
const DEFAULT_LIST_LIMIT = 15;
/**
 * Max joined rooms to load metadata / last-activity for per list call. The
 * homeserver order of `joined_rooms` is undefined; narrow `query` if a chat
 * is missing from the default list.
 */
const LIST_JOINED_ROOM_SCAN_CAP = 200;
const MAX_LIST_LIMIT = 50;
const DEFAULT_READ_LIMIT = 20;
const MAX_READ_LIMIT = 50;

const scanJoinedRooms = (joinedRooms: string[]): string[] =>
  joinedRooms.slice(0, Math.min(joinedRooms.length, LIST_JOINED_ROOM_SCAN_CAP));

interface RoomMeta {
  name: string | null;
  room_id: string;
  topic: string | null;
}

interface RoomWithLastTs extends RoomMeta {
  last_message_ts: number | null;
}

const fetchRoomMetaBatch = async (
  client: MatrixClient,
  roomIds: string[]
): Promise<RoomMeta[]> => {
  const metas = await Promise.all(
    roomIds.map(async (roomId) => {
      const [name, topic] = await Promise.all([
        client.getRoomName(roomId),
        client.getRoomTopic(roomId),
      ]);
      return { name, room_id: roomId, topic };
    })
  );
  return metas;
};

const collectRoomMeta = async (
  client: MatrixClient,
  roomIds: string[]
): Promise<RoomMeta[]> => {
  const acc: RoomMeta[] = [];
  for (let i = 0; i < roomIds.length; i += ROOM_BATCH) {
    const batch = roomIds.slice(i, i + ROOM_BATCH);
    acc.push(...(await fetchRoomMetaBatch(client, batch)));
  }
  return acc;
};

const fetchLastTsBatch = async (
  client: MatrixClient,
  roomIds: string[]
): Promise<Map<string, number | null>> => {
  const pairs = await Promise.all(
    roomIds.map(async (roomId) => {
      const ts = await client.getLastMessageTimestamp(roomId);
      return [roomId, ts] as const;
    })
  );
  return new Map(pairs);
};

const collectLastTsForRooms = async (
  client: MatrixClient,
  roomIds: string[]
): Promise<Map<string, number | null>> => {
  const map = new Map<string, number | null>();
  for (let i = 0; i < roomIds.length; i += ROOM_BATCH) {
    const batch = roomIds.slice(i, i + ROOM_BATCH);
    const partial = await fetchLastTsBatch(client, batch);
    for (const [k, v] of partial) {
      map.set(k, v);
    }
  }
  return map;
};

const sortByRecentTimestamp = (rows: RoomWithLastTs[]): void => {
  rows.sort((a, b) => {
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
};

const conversationTitle = (name: string | null): string => {
  const t = name?.trim();
  return t !== undefined && t !== "" ? t : "Unnamed chat";
};

const roomMatchesQuery = (meta: RoomMeta, q: string): boolean => {
  const hay = [meta.room_id, meta.name ?? "", meta.topic ?? ""]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
};

const stringFromMatrixContent = (value: unknown, fallback: string): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return fallback;
  }
  return JSON.stringify(value);
};

const senderLocalpart = (mxid: string): string => {
  const m = /^@([^:]+):/.exec(mxid);
  return m?.[1] ?? mxid;
};

const transcriptLine = (
  event: MatrixEvent,
  includeEventIds: boolean
): string => {
  const time = new Date(event.origin_server_ts).toISOString();
  const body = stringFromMatrixContent(event.content.body, "");
  const sender = senderLocalpart(event.sender);
  if (includeEventIds) {
    return `${time} ${sender} [${event.event_id}]: ${body}`;
  }
  return `${time} ${sender}: ${body}`;
};

const conversationSummarySchema = z.object({
  conversation_id: z.string(),
  last_activity: z.string().nullable(),
  title: z.string(),
});

type ConversationSummary = z.infer<typeof conversationSummarySchema>;

const toConversationSummary = (
  room_id: string,
  last_message_ts: number | null,
  name: string | null
): ConversationSummary => ({
  conversation_id: room_id,
  last_activity:
    last_message_ts === null ? null : new Date(last_message_ts).toISOString(),
  title: conversationTitle(name),
});

const listConversationsFiltered = async (
  client: MatrixClient,
  joinedRooms: string[],
  limit: number,
  q: string
): Promise<{ conversations: ConversationSummary[]; total_joined: number }> => {
  const metaList = await collectRoomMeta(client, scanJoinedRooms(joinedRooms));
  const candidates = metaList.filter((m) => roomMatchesQuery(m, q));
  const tsMap = await collectLastTsForRooms(
    client,
    candidates.map((m) => m.room_id)
  );
  const rows: RoomWithLastTs[] = candidates.map((m) => ({
    ...m,
    last_message_ts: tsMap.get(m.room_id) ?? null,
  }));
  sortByRecentTimestamp(rows);
  const conversations = rows
    .slice(0, limit)
    .map((r) => toConversationSummary(r.room_id, r.last_message_ts, r.name));
  return { conversations, total_joined: joinedRooms.length };
};

const listConversationsUnfiltered = async (
  client: MatrixClient,
  joinedRooms: string[],
  limit: number
): Promise<{ conversations: ConversationSummary[]; total_joined: number }> => {
  const scanIds = scanJoinedRooms(joinedRooms);
  const tsMap = await collectLastTsForRooms(client, scanIds);
  const stubRows: RoomWithLastTs[] = scanIds.map((room_id) => ({
    last_message_ts: tsMap.get(room_id) ?? null,
    name: null,
    room_id,
    topic: null,
  }));
  sortByRecentTimestamp(stubRows);
  const top = stubRows.slice(0, limit);
  const metaForTop = await collectRoomMeta(
    client,
    top.map((r) => r.room_id)
  );
  const metaById = new Map(metaForTop.map((m) => [m.room_id, m]));
  const conversations = top.map((r) =>
    toConversationSummary(
      r.room_id,
      r.last_message_ts,
      metaById.get(r.room_id)?.name ?? null
    )
  );
  return { conversations, total_joined: joinedRooms.length };
};

const listConversationsPayload = async (
  client: MatrixClient,
  joinedRooms: string[],
  limit: number,
  query?: string
): Promise<{ conversations: ConversationSummary[]; total_joined: number }> => {
  const q = query?.trim().toLowerCase();
  if (q !== undefined && q !== "") {
    const filtered = await listConversationsFiltered(
      client,
      joinedRooms,
      limit,
      q
    );
    return filtered;
  }
  const unfiltered = await listConversationsUnfiltered(
    client,
    joinedRooms,
    limit
  );
  return unfiltered;
};

const buildReadConversationPayload = async (
  client: MatrixClient,
  conversationId: string,
  options: {
    from?: string;
    include_event_ids?: boolean;
    limit: number;
  }
) => {
  const result = await client.getRoomMessages(conversationId, {
    dir: "b",
    filter: JSON.stringify({ types: ["m.room.message"] }),
    from: options.from,
    limit: options.limit,
  });
  const chronological = result.chunk.toReversed();
  const includeIds = options.include_event_ids ?? false;
  const lines = chronological
    .map((event) => {
      const body = stringFromMatrixContent(event.content.body, "");
      if (body === "") {
        return null;
      }
      return transcriptLine(event, includeIds);
    })
    .filter((line): line is string => line !== null);
  return {
    conversation_id: conversationId,
    message_count: lines.length,
    next_batch: result.end,
    transcript: lines.join("\n"),
  };
};

export const createConversationTools = (client: MatrixClient) => ({
  list_conversations: createTool({
    description:
      "List Matrix conversations (joined rooms: DMs, groups, bridge chats). Sorted by most recent message among up to 200 rooms from your joined list per call (homeserver order). conversation_id is the Matrix room id — use it with read_conversation and send_message. Optional query filters by room name, topic, or id (case-insensitive substring) within that scan window.",
    execute: async (args) => {
      const limit = Math.min(
        Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT),
        MAX_LIST_LIMIT
      );
      const { joined_rooms } = await client.getJoinedRooms();
      return listConversationsPayload(client, joined_rooms, limit, args.query);
    },
    id: "list_conversations",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe(
          `Maximum conversations to return (default ${DEFAULT_LIST_LIMIT}, max ${MAX_LIST_LIMIT})`
        ),
      query: z
        .string()
        .optional()
        .describe(
          "Filter by substring match on name, topic, or conversation_id (case-insensitive)"
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
      total_joined: z.number(),
    }),
  }),

  read_conversation: createTool({
    description:
      "Read recent messages from a conversation as a single transcript string (oldest to newest in this page). Use next_batch with from to load older messages. Set include_event_ids when you need to reply to a specific message (send_message.reply_to_event_id).",
    execute: async (args) => {
      const limit = Math.min(
        Math.max(1, args.limit ?? DEFAULT_READ_LIMIT),
        MAX_READ_LIMIT
      );
      const out = await buildReadConversationPayload(
        client,
        args.conversation_id,
        {
          from: args.from,
          include_event_ids: args.include_event_ids,
          limit,
        }
      );
      return out;
    },
    id: "read_conversation",
    inputSchema: z.object({
      conversation_id: z
        .string()
        .describe("Matrix room id (!room:server) for this chat"),
      from: z
        .string()
        .optional()
        .describe(
          "Pagination token from a previous read_conversation response"
        ),
      include_event_ids: z
        .boolean()
        .optional()
        .describe(
          "Include Matrix event_id on each line for threading replies via send_message"
        ),
      limit: z
        .number()
        .optional()
        .describe(
          `Max messages to fetch (default ${DEFAULT_READ_LIMIT}, max ${MAX_READ_LIMIT})`
        ),
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
      next_batch: z.string().optional(),
      transcript: z.string(),
    }),
  }),

  send_message: createTool({
    description:
      "Send a text message to a conversation (conversation_id = Matrix room id). Optional reply_to_event_id creates a threaded reply to that message.",
    execute: async (args) => {
      const result =
        args.reply_to_event_id !== undefined && args.reply_to_event_id !== ""
          ? await client.replyToMessage(
              args.conversation_id,
              args.reply_to_event_id,
              args.body
            )
          : await client.sendMessage(args.conversation_id, args.body);
      return { event_id: result.event_id, sent: true as const };
    },
    id: "send_message",
    inputSchema: z.object({
      body: z.string().describe("Plain-text message to send"),
      conversation_id: z
        .string()
        .describe("Matrix room id of the conversation"),
      reply_to_event_id: z
        .string()
        .optional()
        .describe("If set, reply in-thread to this message event id"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      event_id: z.string(),
      sent: z.literal(true),
    }),
  }),
});
