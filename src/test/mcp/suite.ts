import { expect } from "vitest";
import { z } from "zod";

import { createApp } from "@/app";
import type { AppEnv } from "@/env";

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
  return z.record(z.unknown()).parse(JSON.parse(firstBlock.text));
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
  const inner = z.record(z.unknown()).safeParse(res);
  return inner.success && inner.data.isError === true;
};

export const rpcIndicatesToolFailure = (data: unknown): boolean => {
  const r = z.record(z.unknown()).safeParse(data);
  if (!r.success) {
    return false;
  }
  if (rpcTopHasError(r.data)) {
    return true;
  }
  return rpcInnerResultIsToolError(r.data.result);
};

/** Vitest workers inject `ProvidedEnv`; production uses full `Bindings`. */
export type CloudflareTestEnv = AppEnv["Bindings"] | Record<string, string>;

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
  ensureSharedRoom: () => Promise<void>;
  mcpRequest: (
    body: Record<string, unknown>
  ) => Promise<z.infer<typeof jsonrpcResponseSchema>>;
  mcpRequestRaw: (body: Record<string, unknown>) => Promise<unknown>;
  room: SharedRoom;
  testEnv: CloudflareTestEnv;
}

const assignSharedRoomFromFirstConversation = async (
  invoke: McpSuite["callTool"],
  room: SharedRoom
): Promise<void> => {
  const list = z
    .object({
      conversations: z.array(z.object({ conversation_id: z.string() })).min(1),
    })
    .parse(await invoke("list_conversations", { limit: 1 }));
  const [first] = list.conversations;
  if (first === undefined) {
    throw new Error(
      "unreachable: list_conversations min(1) had no first conversation"
    );
  }
  room.id = first.conversation_id;
};

export const createMcpSuite = (testEnv: CloudflareTestEnv): McpSuite => {
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
    await assignSharedRoomFromFirstConversation(invokeTool, room);
  };
  return {
    app,
    callTool: invokeTool,
    callToolRaw: invokeToolRaw,
    ensureSharedRoom,
    mcpRequest,
    mcpRequestRaw,
    room,
    testEnv,
  };
};
