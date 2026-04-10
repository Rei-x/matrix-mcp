import { expect } from "vitest";
import { z } from "zod";

import { createApp } from "@/app";
import type { AppEnv } from "@/env";
import { MatrixClient } from "@/matrix/client";

export const assertPresent = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
};

const jsonrpcResponseSchema = z.object({
  id: z.number(),
  jsonrpc: z.literal("2.0"),
  result: z.unknown(),
});

export const toolListResultSchema = z.object({
  tools: z.array(
    z.object({
      description: z.string().optional(),
      inputSchema: z.record(z.string(), z.unknown()),
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

export const mcpJsonRpcSchema = z.object({
  jsonrpc: z.string(),
});

const parseToolPayload = (envelope: z.infer<typeof toolCallResultSchema>) => {
  const blocks = z
    .array(z.object({ text: z.string() }))
    .min(1)
    .parse(envelope.content);
  const rawFirst = blocks.at(0);
  if (rawFirst === undefined) {
    throw new Error("unreachable: MCP tool content had min(1) but no element");
  }
  const firstBlock = z.object({ text: z.string() }).parse(rawFirst);
  return z.record(z.string(), z.unknown()).parse(JSON.parse(firstBlock.text));
};

export const REQUIRED_TOOL_NAMES = [
  "list_conversations",
  "read_conversation",
  "send_message",
  "whoami",
] as const;

export const toolSetIncludesAllRequired = (toolNames: Set<string>): boolean =>
  REQUIRED_TOOL_NAMES.every((n) => toolNames.has(n));

export const toolsHaveNonEmptyDescriptions = (
  tools: { description?: string }[]
): boolean =>
  tools.every(
    (tool) => tool.description !== undefined && tool.description.length > 0
  );

export const sharedRoomIdLooksValid = (id: string): boolean =>
  id.length > 0 && id.startsWith("!");

const rpcTopHasError = (top: Record<string, unknown>): boolean =>
  "error" in top && top.error !== undefined;

const rpcInnerResultIsToolError = (res: unknown): boolean => {
  if (res === null || typeof res !== "object") {
    return false;
  }
  const inner = z.record(z.string(), z.unknown()).safeParse(res);
  return inner.success && inner.data.isError === true;
};

export const rpcIndicatesToolFailure = (data: unknown): boolean => {
  const r = z.record(z.string(), z.unknown()).safeParse(data);
  if (!r.success) {
    return false;
  }
  if (rpcTopHasError(r.data)) {
    return true;
  }
  return rpcInnerResultIsToolError(r.data.result);
};

export interface SharedRoom {
  id: string;
}

export interface McpSuite {
  app: ReturnType<typeof createApp>;
  callTool: (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  callToolRaw: (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<z.infer<typeof toolCallResultSchema>>;
  cleanupSharedRoom: () => Promise<void>;
  ensureSharedRoom: () => Promise<void>;
  mcpRequest: (
    body: Record<string, unknown>
  ) => Promise<z.infer<typeof jsonrpcResponseSchema>>;
  mcpRequestRaw: (body: Record<string, unknown>) => Promise<unknown>;
  room: SharedRoom;
  testEnv: AppEnv["Bindings"];
}

const createDedicatedTestRoom = async (
  bindings: AppEnv["Bindings"],
  room: SharedRoom
): Promise<void> => {
  const client = new MatrixClient(
    bindings.MATRIX_BASE_URL,
    bindings.MATRIX_ACCESS_TOKEN
  );
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const { room_id } = await client.createRoom({
    is_direct: false,
    name: `matrix-mcp test ${suffix}`,
    preset: "private_chat",
    topic:
      "matrix-mcp integration tests (automated; not a DM — safe to delete).",
  });
  await client.sendMessage(
    room_id,
    "matrix-mcp integration test room (seed message)",
    "m.text"
  );
  room.id = room_id;
};

export const createMcpSuite = (testEnv: AppEnv["Bindings"]): McpSuite => {
  const app = createApp();
  const room: SharedRoom = { id: "" };
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
      testEnv
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
      testEnv
    );
    expect(response.status).toBe(200);
    return response.json();
  };
  const invokeTool = async (
    name: string,
    args: Record<string, unknown> = {}
  ) => {
    const rpc = await mcpRequest({
      id: Math.floor(Math.random() * 10_000),
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: args, name },
    });
    const envelope = toolCallResultSchema.parse(rpc.result);
    return parseToolPayload(envelope);
  };
  const invokeToolRaw = async (
    name: string,
    args: Record<string, unknown> = {}
  ) => {
    const rpc = await mcpRequest({
      id: Math.floor(Math.random() * 10_000),
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: args, name },
    });
    return toolCallResultSchema.parse(rpc.result);
  };
  const ensureSharedRoom = async (): Promise<void> => {
    if (room.id !== "") {
      return;
    }
    await createDedicatedTestRoom(testEnv, room);
  };
  const cleanupSharedRoom = async (): Promise<void> => {
    const { id } = room;
    if (id === "") {
      return;
    }
    const client = new MatrixClient(
      testEnv.MATRIX_BASE_URL,
      testEnv.MATRIX_ACCESS_TOKEN
    );
    try {
      await client.leaveRoom(id);
    } catch {
      /* room may already be left */
    }
    try {
      await client.forgetRoom(id);
    } catch {
      /* forget can fail if not left or server policy */
    }
    room.id = "";
  };
  return {
    app,
    callTool: invokeTool,
    callToolRaw: invokeToolRaw,
    cleanupSharedRoom,
    ensureSharedRoom,
    mcpRequest,
    mcpRequestRaw,
    room,
    testEnv,
  };
};

export const testBindingsFromEnv = (): AppEnv["Bindings"] => {
  const {
    MATRIX_ACCESS_TOKEN = "",
    MATRIX_BASE_URL = "",
    MCP_AUTH_TOKEN,
  } = process.env;
  return {
    MATRIX_ACCESS_TOKEN,
    MATRIX_BASE_URL,
    ...(MCP_AUTH_TOKEN !== undefined && MCP_AUTH_TOKEN !== ""
      ? { MCP_AUTH_TOKEN }
      : {}),
  };
};
