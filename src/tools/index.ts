import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

interface CalcError {
  error: string;
}
interface CalcSuccess {
  result: number;
}

const calculate = (
  operation: string,
  a: number,
  b: number
): CalcError | CalcSuccess => {
  switch (operation) {
    case "add": {
      return { result: a + b };
    }
    case "subtract": {
      return { result: a - b };
    }
    case "multiply": {
      return { result: a * b };
    }
    case "divide": {
      if (b === 0) {
        return { error: "Division by zero" };
      }
      return { result: a / b };
    }
    default: {
      return { error: `Unknown operation: ${operation}` };
    }
  }
};

export const registerAllTools = (server: McpServer) => {
  server.registerTool(
    "echo",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description: "Echoes back the provided message",
      inputSchema: {
        message: z.string().describe("The message to echo"),
      },
      title: "Echo",
    },
    // eslint-disable-next-line require-await -- mcp handler must be async
    async (args) => ({
      content: [
        { text: JSON.stringify({ echo: args.message }), type: "text" as const },
      ],
    })
  );

  server.registerTool(
    "calculate",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description: "Performs basic arithmetic operations",
      inputSchema: {
        a: z.number().describe("The first operand"),
        b: z.number().describe("The second operand"),
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The arithmetic operation to perform"),
      },
      title: "Calculate",
    },
    // eslint-disable-next-line require-await -- mcp handler must be async
    async (args): Promise<CallToolResult> => {
      const res = calculate(args.operation, args.a, args.b);
      if ("error" in res) {
        return {
          content: [{ text: res.error, type: "text" }],
          isError: true,
        };
      }
      return {
        content: [
          { text: JSON.stringify({ result: res.result }), type: "text" },
        ],
      };
    }
  );
};
