import { Preset } from "matrix-js-sdk";
import { expect } from "vitest";
import { z } from "zod";

import { createApp } from "@/app";
import type { AppEnv } from "@/env";
import { MatrixClient } from "@/matrix/client";
import type { createAllTools } from "@/tools";

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

type ToolMap = ReturnType<typeof createAllTools>;
export type ToolName = Extract<keyof ToolMap, string>;

type SchemaInputType<S> = S extends {
  readonly "~standard": {
    readonly types?: { readonly input: infer I } | undefined;
  };
}
  ? I
  : never;
type SchemaOutputType<S> = S extends {
  readonly "~standard": {
    readonly types?: { readonly output: infer O } | undefined;
  };
}
  ? O
  : never;

export type ToolInput<N extends ToolName> = ToolMap[N] extends {
  inputSchema?: infer S;
}
  ? SchemaInputType<NonNullable<S>>
  : never;
export type ToolOutput<N extends ToolName> = ToolMap[N] extends {
  outputSchema?: infer S;
}
  ? SchemaOutputType<NonNullable<S>>
  : never;

type CallToolArgs<N extends ToolName> =
  Record<string, never> extends ToolInput<N>
    ? [args?: ToolInput<N>]
    : [args: ToolInput<N>];

const parseToolPayload = <N extends ToolName>(
  envelope: z.infer<typeof toolCallResultSchema>
): ToolOutput<N> => {
  const blocks = z
    .array(z.object({ text: z.string() }))
    .min(1)
    .parse(envelope.content);
  const rawFirst = blocks.at(0);
  if (rawFirst === undefined) {
    throw new Error("unreachable: MCP tool content had min(1) but no element");
  }
  const firstBlock = z.object({ text: z.string() }).parse(rawFirst);
  const parsed: unknown = JSON.parse(firstBlock.text);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the tool's outputSchema validates the shape on the server side
  return parsed as ToolOutput<N>;
};

export const REQUIRED_TOOL_NAMES: readonly ToolName[] = [
  "list_conversations",
  "read_conversation",
  "send_message",
  "whoami",
];

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
  callTool: <N extends ToolName>(
    name: N,
    ...args: CallToolArgs<N>
  ) => Promise<ToolOutput<N>>;
  callToolRaw: <N extends ToolName>(
    name: N,
    ...args: CallToolArgs<N>
  ) => Promise<z.infer<typeof toolCallResultSchema>>;
  cleanupSharedRoom: () => Promise<void>;
  ensureSharedRoom: () => Promise<void>;
  matrixClient: MatrixClient;
  mcpRequest: (
    body: Record<string, unknown>
  ) => Promise<z.infer<typeof jsonrpcResponseSchema>>;
  mcpRequestRaw: (body: Record<string, unknown>) => Promise<unknown>;
  room: SharedRoom;
  testEnv: AppEnv["Bindings"];
}

const createDedicatedTestRoom = async (
  client: MatrixClient,
  room: SharedRoom
): Promise<void> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const { room_id } = await client.createRoom({
    is_direct: false,
    name: `matrix-mcp test ${suffix}`,
    preset: Preset.PrivateChat,
    topic:
      "matrix-mcp integration tests (automated; not a DM — safe to delete).",
  });
  // Wait for the synced state to register the room (next /sync tick) so tools
  // reading from the in-memory store see it on the very next call.
  await client.waitForRoom(room_id);
  await client.sendText(
    room_id,
    "matrix-mcp integration test room (seed message)"
  );
  room.id = room_id;
};

export const createMcpSuite = (testEnv: AppEnv["Bindings"]): McpSuite => {
  const matrixClient = new MatrixClient(
    testEnv.MATRIX_BASE_URL,
    testEnv.MATRIX_ACCESS_TOKEN
  );
  const app = createApp(matrixClient);
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
  const callRawEnvelope = async <N extends ToolName>(
    name: N,
    args: ToolInput<N> | undefined
  ): Promise<z.infer<typeof toolCallResultSchema>> => {
    const rpc = await mcpRequest({
      id: Math.floor(Math.random() * 10_000),
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: args ?? {}, name },
    });
    return toolCallResultSchema.parse(rpc.result);
  };
  const invokeTool = async <N extends ToolName>(
    name: N,
    ...args: CallToolArgs<N>
  ): Promise<ToolOutput<N>> => {
    const envelope = await callRawEnvelope(name, args[0]);
    return parseToolPayload<N>(envelope);
  };
  const invokeToolRaw = async <N extends ToolName>(
    name: N,
    ...args: CallToolArgs<N>
  ): Promise<z.infer<typeof toolCallResultSchema>> => {
    const result = await callRawEnvelope(name, args[0]);
    return result;
  };
  const ensureSharedRoom = async (): Promise<void> => {
    await matrixClient.start();
    if (room.id !== "") {
      return;
    }
    await createDedicatedTestRoom(matrixClient, room);
  };
  const cleanupSharedRoom = async (): Promise<void> => {
    const { id } = room;
    if (id !== "") {
      try {
        await matrixClient.leaveRoom(id);
      } catch {
        /* room may already be left */
      }
      try {
        await matrixClient.forgetRoom(id);
      } catch {
        /* forget can fail if not left or server policy */
      }
      room.id = "";
    }
    matrixClient.stop();
  };
  return {
    app,
    callTool: invokeTool,
    callToolRaw: invokeToolRaw,
    cleanupSharedRoom,
    ensureSharedRoom,
    matrixClient,
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
