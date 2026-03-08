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

describe("mcp server", () => {
  it("should list available tools", async () => {
    const response = await mcpRequest({
      id: 1,
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
    });
    const body = toolListResultSchema.parse(response.result);
    const toolNames = body.tools.map((t) => t.name);
    expect(toolNames).toContain("echo");
    expect(toolNames).toContain("calculate");
  });

  it("should call echo tool", async () => {
    const response = await mcpRequest({
      id: 2,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { message: "hello world" },
        name: "echo",
      },
    });
    const body = toolCallResultSchema.parse(response.result);
    expect(body.content[0]?.text).toBe(JSON.stringify({ echo: "hello world" }));
  });

  it("should call calculate tool", async () => {
    const response = await mcpRequest({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { a: 2, b: 3, operation: "add" },
        name: "calculate",
      },
    });
    const body = toolCallResultSchema.parse(response.result);
    expect(body.content[0]?.text).toBe(JSON.stringify({ result: 5 }));
  });

  it("should return error for division by zero", async () => {
    const response = await mcpRequest({
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { a: 1, b: 0, operation: "divide" },
        name: "calculate",
      },
    });
    const body = toolCallResultSchema.parse(response.result);
    expect(body.isError).toBeTruthy();
    expect(body.content[0]?.text).toBe("Division by zero");
  });
});
