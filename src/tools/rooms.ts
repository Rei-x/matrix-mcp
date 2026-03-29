import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { MatrixClient } from "@/matrix/client";

const roomListEntrySchema = z.object({
  name: z.string().nullable(),
  room_id: z.string(),
  topic: z.string().nullable(),
});

const roomInfoSchema = z.object({
  member_count: z.number(),
  members: z.array(
    z.object({
      displayname: z.string().optional(),
      user_id: z.string(),
    })
  ),
  name: z.string().nullable(),
  room_id: z.string(),
  topic: z.string().nullable(),
});

export const createRoomTools = (client: MatrixClient) => ({
  create_room: createTool({
    description:
      "Create a new Matrix room. Can be a private chat, public room, or direct message.",
    execute: async (args) => {
      const result = await client.createRoom({
        invite: args.invite,
        is_direct: args.is_direct,
        name: args.name,
        preset: args.preset,
        topic: args.topic,
      });
      return { room_id: result.room_id };
    },
    id: "create_room",
    inputSchema: z.object({
      invite: z
        .array(z.string())
        .optional()
        .describe("List of user IDs to invite"),
      is_direct: z
        .boolean()
        .optional()
        .describe("Whether this is a direct message room"),
      name: z.string().optional().describe("Room name"),
      preset: z
        .enum(["private_chat", "public_chat", "trusted_private_chat"])
        .optional()
        .describe("Room visibility preset (default: private_chat)"),
      topic: z.string().optional().describe("Room topic"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({ room_id: z.string() }),
  }),

  get_room_info: createTool({
    description:
      "Get detailed information about a specific Matrix room, including name, topic, and members.",
    execute: async (args) => {
      const [name, topic, members] = await Promise.all([
        client.getRoomName(args.room_id),
        client.getRoomTopic(args.room_id),
        client.getRoomMembers(args.room_id, "join"),
      ]);

      const memberList = members.chunk.map((m) => ({
        displayname: m.content.displayname,
        user_id: m.state_key,
      }));

      return {
        member_count: memberList.length,
        members: memberList,
        name,
        room_id: args.room_id,
        topic,
      };
    },
    id: "get_room_info",
    inputSchema: z.object({
      room_id: z
        .string()
        .describe("The Matrix room ID (e.g., !abc123:matrix.org)"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: roomInfoSchema,
  }),

  invite_user: createTool({
    description: "Invite a user to a Matrix room.",
    execute: async (args) => {
      await client.inviteUser(args.room_id, args.user_id);
      return {
        invited: true as const,
        room_id: args.room_id,
        user_id: args.user_id,
      };
    },
    id: "invite_user",
    inputSchema: z.object({
      room_id: z.string().describe("The room ID to invite the user to"),
      user_id: z
        .string()
        .describe("The Matrix user ID to invite (e.g., @user:matrix.org)"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      invited: z.literal(true),
      room_id: z.string(),
      user_id: z.string(),
    }),
  }),

  join_room: createTool({
    description: "Join a Matrix room by room ID or alias.",
    execute: async (args) => {
      const result = await client.joinRoom(args.room_id_or_alias);
      return { joined: true as const, room_id: result.room_id };
    },
    id: "join_room",
    inputSchema: z.object({
      room_id_or_alias: z
        .string()
        .describe(
          "The room ID or alias to join (e.g., !abc:matrix.org or #room:matrix.org)"
        ),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      joined: z.literal(true),
      room_id: z.string(),
    }),
  }),

  leave_room: createTool({
    description: "Leave a Matrix room.",
    execute: async (args) => {
      await client.leaveRoom(args.room_id);
      return { left: true as const, room_id: args.room_id };
    },
    id: "leave_room",
    inputSchema: z.object({
      room_id: z.string().describe("The room ID to leave"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      left: z.literal(true),
      room_id: z.string(),
    }),
  }),

  list_recent_rooms: createTool({
    description:
      "List Matrix rooms sorted by most recent message activity. Useful for finding your latest conversations. Returns the most recently active rooms first.",
    execute: async (args) => {
      const limit = args.limit ?? 10;
      const { joined_rooms } = await client.getJoinedRooms();

      // Fetch last message timestamp for each room in batches
      const BATCH_SIZE = 10;
      const roomsWithTimestamp: {
        last_message_ts: number | null;
        name: string | null;
        room_id: string;
        topic: string | null;
      }[] = [];

      for (let i = 0; i < joined_rooms.length; i += BATCH_SIZE) {
        const batch = joined_rooms.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (roomId) => {
            const [name, topic, lastTs] = await Promise.all([
              client.getRoomName(roomId),
              client.getRoomTopic(roomId),
              client.getLastMessageTimestamp(roomId),
            ]);
            return { last_message_ts: lastTs, name, room_id: roomId, topic };
          })
        );
        roomsWithTimestamp.push(...results);
      }

      // Sort by most recent message first (nulls last)
      roomsWithTimestamp.sort((a, b) => {
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

      const rooms = roomsWithTimestamp.slice(0, limit).map((r) => ({
        last_activity: r.last_message_ts
          ? new Date(r.last_message_ts).toISOString()
          : null,
        name: r.name,
        room_id: r.room_id,
        topic: r.topic,
      }));

      return { rooms, total: joined_rooms.length };
    },
    id: "list_recent_rooms",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum number of rooms to return (default: 10)"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      rooms: z.array(
        z.object({
          last_activity: z.string().nullable(),
          name: z.string().nullable(),
          room_id: z.string(),
          topic: z.string().nullable(),
        })
      ),
      total: z.number(),
    }),
  }),

  list_rooms: createTool({
    description:
      "List Matrix rooms you have joined. Returns room IDs with their names and topics. Use limit and offset for pagination.",
    execute: async (args) => {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const { joined_rooms } = await client.getJoinedRooms();
      const slice = joined_rooms.slice(offset, offset + limit);

      const BATCH_SIZE = 10;
      const rooms: z.infer<typeof roomListEntrySchema>[] = [];
      for (let i = 0; i < slice.length; i += BATCH_SIZE) {
        const batch = slice.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (roomId) => {
            const [name, topic] = await Promise.all([
              client.getRoomName(roomId),
              client.getRoomTopic(roomId),
            ]);
            return { name, room_id: roomId, topic };
          })
        );
        rooms.push(...results);
      }

      return {
        has_more: offset + limit < joined_rooms.length,
        limit,
        offset,
        rooms,
        total: joined_rooms.length,
      };
    },
    id: "list_rooms",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum number of rooms to return (default: 50)"),
      offset: z
        .number()
        .optional()
        .describe("Offset for pagination (default: 0)"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      has_more: z.boolean(),
      limit: z.number(),
      offset: z.number(),
      rooms: z.array(roomListEntrySchema),
      total: z.number(),
    }),
  }),

  search_public_rooms: createTool({
    description:
      "List or search public rooms on the Matrix server. If search_term is provided, filters by keyword.",
    execute: async (args) => {
      const result = await client.getPublicRooms({
        limit: args.limit,
        searchTerm: args.search_term,
      });
      return result.chunk.map((r) => ({
        canonical_alias: r.canonical_alias,
        name: r.name,
        num_joined_members: r.num_joined_members,
        room_id: r.room_id,
        topic: r.topic,
      }));
    },
    id: "search_public_rooms",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results to return (default: 20)"),
      search_term: z
        .string()
        .optional()
        .describe("Search term to filter rooms by"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
  }),

  set_room_topic: createTool({
    description: "Set or update the topic of a Matrix room.",
    execute: async (args) => {
      await client.setRoomTopic(args.room_id, args.topic);
      return { room_id: args.room_id, success: true as const };
    },
    id: "set_room_topic",
    inputSchema: z.object({
      room_id: z.string().describe("The room ID"),
      topic: z.string().describe("The new topic for the room"),
    }),
    mcp: {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    outputSchema: z.object({
      room_id: z.string(),
      success: z.literal(true),
    }),
  }),
});
