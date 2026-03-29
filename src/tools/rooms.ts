import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MatrixClient } from "@/matrix/client";

export const registerRoomTools = (server: McpServer, client: MatrixClient) => {
  server.registerTool(
    "list_rooms",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description:
        "List Matrix rooms you have joined. Returns room IDs with their names and topics. Use limit and offset for pagination.",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .describe("Maximum number of rooms to return (default: 50)"),
        offset: z
          .number()
          .optional()
          .describe("Offset for pagination (default: 0)"),
      },
      title: "List Rooms",
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const { joined_rooms } = await client.getJoinedRooms();
      const slice = joined_rooms.slice(offset, offset + limit);

      const BATCH_SIZE = 10;
      const rooms: {
        name: string | null;
        room_id: string;
        topic: string | null;
      }[] = [];
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

      const response = {
        has_more: offset + limit < joined_rooms.length,
        limit,
        offset,
        rooms,
        total: joined_rooms.length,
      };

      return {
        content: [
          { text: JSON.stringify(response, null, 2), type: "text" as const },
        ],
      };
    }
  );

  server.registerTool(
    "get_room_info",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description:
        "Get detailed information about a specific Matrix room, including name, topic, and members.",
      inputSchema: {
        room_id: z
          .string()
          .describe("The Matrix room ID (e.g., !abc123:matrix.org)"),
      },
      title: "Get Room Info",
    },
    async (args) => {
      const [name, topic, members] = await Promise.all([
        client.getRoomName(args.room_id),
        client.getRoomTopic(args.room_id),
        client.getRoomMembers(args.room_id, "join"),
      ]);

      const memberList = members.chunk.map((m) => ({
        displayname: m.content.displayname,
        user_id: m.state_key,
      }));

      const info = {
        member_count: memberList.length,
        members: memberList,
        name,
        room_id: args.room_id,
        topic,
      };

      return {
        content: [
          { text: JSON.stringify(info, null, 2), type: "text" as const },
        ],
      };
    }
  );

  server.registerTool(
    "search_public_rooms",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description:
        "List or search public rooms on the Matrix server. If search_term is provided, filters by keyword.",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .describe("Maximum number of results to return (default: 20)"),
        search_term: z
          .string()
          .optional()
          .describe("Search term to filter rooms by"),
      },
      title: "Search Public Rooms",
    },
    async (args) => {
      const result = await client.getPublicRooms({
        limit: args.limit,
        searchTerm: args.search_term,
      });
      const rooms = result.chunk.map((r) => ({
        canonical_alias: r.canonical_alias,
        name: r.name,
        num_joined_members: r.num_joined_members,
        room_id: r.room_id,
        topic: r.topic,
      }));
      return {
        content: [
          { text: JSON.stringify(rooms, null, 2), type: "text" as const },
        ],
      };
    }
  );

  server.registerTool(
    "join_room",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description: "Join a Matrix room by room ID or alias.",
      inputSchema: {
        room_id_or_alias: z
          .string()
          .describe(
            "The room ID or alias to join (e.g., !abc:matrix.org or #room:matrix.org)"
          ),
      },
      title: "Join Room",
    },
    async (args) => {
      const result = await client.joinRoom(args.room_id_or_alias);
      return {
        content: [
          {
            text: JSON.stringify({ joined: true, room_id: result.room_id }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.registerTool(
    "leave_room",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description: "Leave a Matrix room.",
      inputSchema: {
        room_id: z.string().describe("The room ID to leave"),
      },
      title: "Leave Room",
    },
    async (args) => {
      await client.leaveRoom(args.room_id);
      return {
        content: [
          {
            text: JSON.stringify({ left: true, room_id: args.room_id }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_room",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description:
        "Create a new Matrix room. Can be a private chat, public room, or direct message.",
      inputSchema: {
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
      },
      title: "Create Room",
    },
    async (args) => {
      const result = await client.createRoom({
        invite: args.invite,
        is_direct: args.is_direct,
        name: args.name,
        preset: args.preset,
        topic: args.topic,
      });
      return {
        content: [
          { text: JSON.stringify(result, null, 2), type: "text" as const },
        ],
      };
    }
  );

  server.registerTool(
    "invite_user",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description: "Invite a user to a Matrix room.",
      inputSchema: {
        room_id: z.string().describe("The room ID to invite the user to"),
        user_id: z
          .string()
          .describe("The Matrix user ID to invite (e.g., @user:matrix.org)"),
      },
      title: "Invite User",
    },
    async (args) => {
      await client.inviteUser(args.room_id, args.user_id);
      return {
        content: [
          {
            text: JSON.stringify({
              invited: true,
              room_id: args.room_id,
              user_id: args.user_id,
            }),
            type: "text" as const,
          },
        ],
      };
    }
  );

  server.registerTool(
    "set_room_topic",
    {
      annotations: {
        idempotentHint: false,
        readOnlyHint: false,
      },
      description: "Set or update the topic of a Matrix room.",
      inputSchema: {
        room_id: z.string().describe("The room ID"),
        topic: z.string().describe("The new topic for the room"),
      },
      title: "Set Room Topic",
    },
    async (args) => {
      await client.setRoomTopic(args.room_id, args.topic);
      return {
        content: [
          {
            text: JSON.stringify({ room_id: args.room_id, success: true }),
            type: "text" as const,
          },
        ],
      };
    }
  );
};
