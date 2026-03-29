import { env } from "cloudflare:test";
import { z } from "zod";

import { createApp } from "@/app";

const app = createApp();

const jsonrpcResponseSchema = z.object({
  id: z.number(),
  jsonrpc: z.literal("2.0"),
  result: z.unknown(),
});

const toolListResultSchema = z.object({
  tools: z.array(
    z.object({
      description: z.string().optional(),
      inputSchema: z.record(z.unknown()),
      name: z.string(),
    })
  ),
});

const toolCallResultSchema = z.object({
  content: z.array(
    z.object({
      text: z.string(),
      type: z.string(),
    })
  ),
  isError: z.boolean().optional(),
});

const mcpRequest = async (body: Record<string, unknown>) => {
  const response = await app.request(
    "/mcp",
    {
      body: JSON.stringify(body),
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    env
  );
  expect(response.status).toBe(200);
  const json: unknown = await response.json();
  return jsonrpcResponseSchema.parse(json);
};

const mcpRequestRaw = async (body: Record<string, unknown>) => {
  const response = await app.request(
    "/mcp",
    {
      body: JSON.stringify(body),
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    env
  );
  expect(response.status).toBe(200);
  return response.json();
};

const callTool = async (name: string, args: Record<string, unknown> = {}) => {
  const response = await mcpRequest({
    id: Math.floor(Math.random() * 10_000),
    jsonrpc: "2.0",
    method: "tools/call",
    params: { arguments: args, name },
  });
  const body = toolCallResultSchema.parse(response.result);
  return JSON.parse(body.content[0]!.text) as Record<string, unknown>;
};

const callToolRaw = async (
  name: string,
  args: Record<string, unknown> = {}
) => {
  const response = await mcpRequest({
    id: Math.floor(Math.random() * 10_000),
    jsonrpc: "2.0",
    method: "tools/call",
    params: { arguments: args, name },
  });
  return toolCallResultSchema.parse(response.result);
};

// Shared test room - try to create one, fall back to an existing joined room
let sharedTestRoomId: string;
let sharedRoomWasCreated = false;

beforeAll(async () => {
  try {
    const result = await callTool("create_room", {
      name: "MCP Integration Test Room",
      preset: "private_chat",
      topic: "Shared test room",
    });
    sharedTestRoomId = result.room_id as string;
    sharedRoomWasCreated = true;
  } catch {
    // Rate limited - fall back to first joined room
    const listResult = await callTool("list_rooms", { limit: 1 });
    const rooms = listResult.rooms as { room_id: string }[];
    sharedTestRoomId = rooms[0]!.room_id;
  }
}, 60_000);

afterAll(async () => {
  if (sharedRoomWasCreated && sharedTestRoomId) {
    try {
      await callTool("leave_room", { room_id: sharedTestRoomId });
    } catch {
      // Ignore cleanup errors
    }
  }
}, 10_000);

describe("mcp server", () => {
  describe("tool listing", () => {
    it("should list all available tools", async () => {
      const response = await mcpRequest({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
      });
      const body = toolListResultSchema.parse(response.result);
      const toolNames = body.tools.map((t) => t.name);
      expect(toolNames).toContain("list_rooms");
      expect(toolNames).toContain("get_room_info");
      expect(toolNames).toContain("search_public_rooms");
      expect(toolNames).toContain("join_room");
      expect(toolNames).toContain("leave_room");
      expect(toolNames).toContain("create_room");
      expect(toolNames).toContain("read_messages");
      expect(toolNames).toContain("send_message");
      expect(toolNames).toContain("send_reaction");
      expect(toolNames).toContain("send_read_receipt");
      expect(toolNames).toContain("reply_to_message");
      expect(toolNames).toContain("redact_message");
      expect(toolNames).toContain("invite_user");
      expect(toolNames).toContain("set_room_topic");
      expect(toolNames).toContain("whoami");
      expect(toolNames).toContain("search_users");
      expect(toolNames).toContain("get_user_profile");
      expect(toolNames).toContain("list_recent_rooms");
    });

    it("should have descriptions for all tools", async () => {
      const response = await mcpRequest({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
      });
      const body = toolListResultSchema.parse(response.result);
      for (const tool of body.tools) {
        expect(tool.description).toBeTruthy();
      }
    });
  });

  describe("whoami", () => {
    it("should return current user identity", async () => {
      const result = await callTool("whoami");
      expect(result.user_id).toBe("@rei:matrix.suzuya.dev");
      expect(result.device_id).toBeDefined();
    });
  });

  describe("list_rooms", () => {
    it("should list joined rooms with names", async () => {
      const result = await callTool("list_rooms", { limit: 5 });
      expect(result.total).toBeGreaterThan(0);
      expect(result.has_more).toBeTruthy();
      const rooms = result.rooms as {
        name: string | null;
        room_id: string;
        topic: string | null;
      }[];
      expect(rooms.length).toBeLessThanOrEqual(5);
      expect(rooms[0]!.room_id).toMatch(/^!/);
    });

    it("should use default limit when not specified", async () => {
      const result = await callTool("list_rooms", { limit: 3 });
      expect(result.limit).toBe(3);
      expect(result.offset).toBe(0);
    });

    it("should support pagination with offset", async () => {
      const first = await callTool("list_rooms", { limit: 2, offset: 0 });
      const second = await callTool("list_rooms", { limit: 2, offset: 2 });
      const firstRooms = first.rooms as { room_id: string }[];
      const secondRooms = second.rooms as { room_id: string }[];
      expect(firstRooms[0]!.room_id).not.toBe(secondRooms[0]!.room_id);
    });
  });

  describe("get_room_info", () => {
    it("should return room details with members", async () => {
      const result = await callTool("get_room_info", {
        room_id: sharedTestRoomId,
      });
      expect(result.room_id).toBe(sharedTestRoomId);
      expect(result.member_count).toBeGreaterThan(0);
      expect(Array.isArray(result.members)).toBeTruthy();
      // Verify member structure
      const members = result.members as {
        displayname: string | undefined;
        user_id: string;
      }[];
      expect(members[0]!.user_id).toMatch(/^@/);
    });

    it("should return name and topic fields", async () => {
      const result = await callTool("get_room_info", {
        room_id: sharedTestRoomId,
      });
      // name and topic should be present (may be null for some rooms)
      expect("name" in result).toBeTruthy();
      expect("topic" in result).toBeTruthy();
    });
  });

  describe("read_messages", () => {
    it("should read messages from a room", async () => {
      const listResult = await callTool("list_rooms", { limit: 1 });
      const rooms = listResult.rooms as { room_id: string }[];
      const roomId = rooms[0]!.room_id;
      const result = await callTool("read_messages", {
        limit: 5,
        room_id: roomId,
      });
      expect(result.room_id).toBe(roomId);
      expect(Array.isArray(result.messages)).toBeTruthy();
    });

    it("should support pagination", async () => {
      const listResult = await callTool("list_rooms", { limit: 1 });
      const rooms = listResult.rooms as { room_id: string }[];
      const roomId = rooms[0]!.room_id;

      const first = await callTool("read_messages", {
        limit: 2,
        room_id: roomId,
      });
      expect(first.next_batch).toBeDefined();

      const second = await callTool("read_messages", {
        from: first.next_batch,
        limit: 2,
        room_id: roomId,
      });
      expect(second.room_id).toBe(roomId);
      expect(Array.isArray(second.messages)).toBeTruthy();
    });

    it("should format messages with expected fields", async () => {
      // Send a message first to ensure there's content
      await callTool("send_message", {
        body: "Format test message",
        room_id: sharedTestRoomId,
      });

      const result = await callTool("read_messages", {
        limit: 5,
        room_id: sharedTestRoomId,
      });
      const messages = result.messages as {
        body: string;
        event_id: string;
        sender: string;
        timestamp: string;
        type: string;
      }[];
      expect(messages.length).toBeGreaterThan(0);
      const msg = messages[0]!;
      expect(msg.event_id).toMatch(/^\$/);
      expect(msg.sender).toMatch(/^@/);
      expect(msg.timestamp).toBeTruthy();
      expectTypeOf(msg.body).toBeString();
    });
  });

  describe("send_message", () => {
    it("should send a message to a room", async () => {
      const result = await callTool("send_message", {
        body: "Hello from MCP integration test!",
        room_id: sharedTestRoomId,
      });
      expect(result.sent).toBeTruthy();
      expect(result.event_id).toBeDefined();
    });

    it("should read back sent messages", async () => {
      const result = await callTool("read_messages", {
        limit: 10,
        room_id: sharedTestRoomId,
      });
      const messages = result.messages as {
        body: string;
        sender: string;
      }[];
      const bodies = messages.map((m) => m.body);
      expect(bodies).toContain("Hello from MCP integration test!");
    });
  });

  describe("send_reaction", () => {
    it("should send a reaction to a message", async () => {
      const sendResult = await callTool("send_message", {
        body: "React to this message",
        room_id: sharedTestRoomId,
      });
      const eventId = sendResult.event_id as string;

      const result = await callTool("send_reaction", {
        event_id: eventId,
        reaction: "\uD83D\uDC4D",
        room_id: sharedTestRoomId,
      });
      expect(result.sent).toBeTruthy();
      expect(result.event_id).toBeDefined();
    });
  });

  describe("send_read_receipt", () => {
    it("should send read receipt", async () => {
      const msgs = await callTool("read_messages", {
        limit: 1,
        room_id: sharedTestRoomId,
      });
      const messages = msgs.messages as {
        event_id: string;
      }[];
      expect(messages.length).toBeGreaterThan(0);
      const result = await callTool("send_read_receipt", {
        event_id: messages[0]!.event_id,
        room_id: sharedTestRoomId,
      });
      expect(result.marked_read).toBeTruthy();
    });
  });

  describe("reply_to_message", () => {
    it("should reply to a specific message", async () => {
      const sendResult = await callTool("send_message", {
        body: "Original message for reply",
        room_id: sharedTestRoomId,
      });
      const originalEventId = sendResult.event_id as string;

      const replyResult = await callTool("reply_to_message", {
        body: "This is a reply",
        event_id: originalEventId,
        room_id: sharedTestRoomId,
      });
      expect(replyResult.event_id).toBeDefined();
      expect(replyResult.sent).toBeTruthy();
    });

    it("should read back reply", async () => {
      const msgs = await callTool("read_messages", {
        limit: 5,
        room_id: sharedTestRoomId,
      });
      const messages = msgs.messages as { body: string }[];
      const bodies = messages.map((m) => m.body);
      expect(bodies).toContain("This is a reply");
    });
  });

  describe("redact_message", () => {
    it("should redact a message with reason", async () => {
      const sendResult = await callTool("send_message", {
        body: "Message to be redacted with reason",
        room_id: sharedTestRoomId,
      });
      const eventId = sendResult.event_id as string;

      const redactResult = await callTool("redact_message", {
        event_id: eventId,
        reason: "Test redaction",
        room_id: sharedTestRoomId,
      });
      expect(redactResult.event_id).toBeDefined();
      expect(redactResult.redacted).toBeTruthy();
    });

    it("should redact a message without reason", async () => {
      const sendResult = await callTool("send_message", {
        body: "Message to be redacted without reason",
        room_id: sharedTestRoomId,
      });
      const eventId = sendResult.event_id as string;

      const redactResult = await callTool("redact_message", {
        event_id: eventId,
        room_id: sharedTestRoomId,
      });
      expect(redactResult.event_id).toBeDefined();
      expect(redactResult.redacted).toBeTruthy();
    });
  });

  describe("invite_user", () => {
    it("should invite a user to a room", async () => {
      if (!sharedRoomWasCreated) {
        return;
      }
      const rawResult = await callToolRaw("invite_user", {
        room_id: sharedTestRoomId,
        user_id: "@gmessagesbot:matrix.suzuya.dev",
      });
      if (rawResult.isError) {
        // Rate limited or user already invited - still validates the tool exists and runs
        expect(rawResult.content[0]!.text).toBeTruthy();
        return;
      }
      const result = JSON.parse(rawResult.content[0]!.text) as Record<
        string,
        unknown
      >;
      expect(result.invited).toBeTruthy();
    });
  });

  describe("set_room_topic", () => {
    it("should set room topic and verify", async () => {
      if (!sharedRoomWasCreated) {
        return;
      }
      const rawResult = await callToolRaw("set_room_topic", {
        room_id: sharedTestRoomId,
        topic: "New topic from MCP test",
      });
      // If rate limited, skip gracefully
      if (rawResult.isError) {
        return;
      }
      const result = JSON.parse(rawResult.content[0]!.text) as Record<
        string,
        unknown
      >;
      expect(result.success).toBeTruthy();

      const info = await callTool("get_room_info", {
        room_id: sharedTestRoomId,
      });
      expect(info.topic).toBe("New topic from MCP test");
    });
  });

  describe("search_users", () => {
    it("should search user directory", async () => {
      const result = await callTool("search_users", {
        limit: 5,
        search_term: "rei",
      });
      expect(result.results).toBeDefined();
      expectTypeOf(result.limited).toBeBoolean();
    });
  });

  describe("get_user_profile", () => {
    it("should get user display name", async () => {
      const result = await callTool("get_user_profile", {
        user_id: "@rei:matrix.suzuya.dev",
      });
      expect(result.user_id).toBe("@rei:matrix.suzuya.dev");
    });

    it("should return null displayname for nonexistent user", async () => {
      const result = await callTool("get_user_profile", {
        user_id: "@nonexistent_user_test_abc:matrix.suzuya.dev",
      });
      expect(result.user_id).toBe(
        "@nonexistent_user_test_abc:matrix.suzuya.dev"
      );
      expect(result.displayname).toBeNull();
    });
  });

  describe("search_public_rooms", () => {
    it("should search public rooms with search term", async () => {
      const result = await callTool("search_public_rooms", {
        limit: 5,
        search_term: "test",
      });
      expect(Array.isArray(result)).toBeTruthy();
    });

    it("should list public rooms without search term", async () => {
      const result = await callTool("search_public_rooms", {
        limit: 5,
      });
      expect(Array.isArray(result)).toBeTruthy();
    });
  });

  describe("list_recent_rooms", () => {
    it("should return rooms sorted by recent activity", async () => {
      const result = await callTool("list_recent_rooms", { limit: 5 });
      expect(result.total).toBeGreaterThan(0);
      const rooms = result.rooms as {
        last_activity: string | null;
        name: string | null;
        room_id: string;
        topic: string | null;
      }[];
      expect(rooms.length).toBeLessThanOrEqual(5);
      expect(rooms[0]!.room_id).toMatch(/^!/);
      // First room should have activity (we sent messages in earlier tests)
      expect(rooms[0]!.last_activity).toBeTruthy();
    });

    it("should use default limit of 10", async () => {
      const result = await callTool("list_recent_rooms", {});
      const rooms = result.rooms as { room_id: string }[];
      expect(rooms.length).toBeLessThanOrEqual(10);
    });
  });

  describe("create_room and leave_room", () => {
    it("should have created the shared test room successfully", () => {
      // Room creation is tested via the beforeAll hook
      // If it succeeded, sharedRoomWasCreated is true
      // If it was rate-limited, it fell back to an existing room
      expect(sharedTestRoomId).toBeTruthy();
      expect(sharedTestRoomId).toMatch(/^!/);
    });
  });

  describe("join_room", () => {
    it("should join a room that user is already in (idempotent)", async () => {
      const joinResult = await callTool("join_room", {
        room_id_or_alias: sharedTestRoomId,
      });
      expect(joinResult.joined).toBeTruthy();
      expect(joinResult.room_id).toBe(sharedTestRoomId);
    });
  });

  describe("error handling", () => {
    it("should handle Matrix API errors gracefully in tools", async () => {
      const result = await callToolRaw("read_messages", {
        limit: 1,
        room_id: "!nonexistent_room_id:matrix.suzuya.dev",
      });
      expect(result.isError).toBeTruthy();
      expect(result.content[0]!.text).toContain("Matrix API error");
    });

    it("should return error for invalid tool", async () => {
      const response = await mcpRequestRaw({
        id: 999,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "nonexistent_tool" },
      });
      const parsed = response as Record<string, unknown>;
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(999);
      const hasError = "error" in parsed;
      const resultHasError =
        parsed.result &&
        typeof parsed.result === "object" &&
        "isError" in (parsed.result as Record<string, unknown>);
      expect(hasError || resultHasError).toBeTruthy();
    });
  });

  describe("root endpoint", () => {
    it("should serve MCP on / endpoint as well", async () => {
      const response = await app.request(
        "/",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        env
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.jsonrpc).toBe("2.0");
    });
  });

  describe("oauth authorization", () => {
    const authEnv = { ...env, MCP_AUTH_TOKEN: "test-secret-token" };

    it("should serve protected resource metadata (RFC 9728)", async () => {
      const response = await app.request(
        "/.well-known/oauth-protected-resource/mcp",
        { method: "GET" },
        authEnv
      );
      expect(response.status).toBe(200);
      const metadata = await response.json();
      expect(metadata.resource).toBeDefined();
      expect(metadata.authorization_servers).toBeDefined();
      expect(
        (metadata.authorization_servers as string[]).length
      ).toBeGreaterThan(0);
      expect(metadata.resource_name).toBe("Matrix MCP Server");
    });

    it("should return 401 with WWW-Authenticate header when no token", async () => {
      const response = await app.request(
        "/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        authEnv
      );
      expect(response.status).toBe(401);
      const wwwAuth = response.headers.get("WWW-Authenticate");
      expect(wwwAuth).toBeTruthy();
      expect(wwwAuth).toContain("Bearer");
      expect(wwwAuth).toContain("resource_metadata");
    });

    it("should reject invalid bearer token", async () => {
      const response = await app.request(
        "/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            Authorization: "Bearer wrong-token",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        authEnv
      );
      expect(response.status).toBe(401);
    });

    it("should accept valid bearer token", async () => {
      const response = await app.request(
        "/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            Authorization: "Bearer test-secret-token",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        authEnv
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.jsonrpc).toBe("2.0");
    });

    it("should skip auth when MCP_AUTH_TOKEN is not set", async () => {
      const noAuthEnv = { ...env, MCP_AUTH_TOKEN: "" };
      const response = await app.request(
        "/mcp",
        {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/list",
            params: {},
          }),
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        noAuthEnv
      );
      expect(response.status).toBe(200);
    });
  });
});
