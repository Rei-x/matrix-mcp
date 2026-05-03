import type {
  CallToolResult,
  Tool as McpTool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { AnyToolDefinition, ToolContext, ToolDefinition } from "./types";

/**
 * Identity function for tool definitions. Exists purely for inference: it
 * lets callers write `defineTool({ ... })` and get full type-safety on
 * `execute`'s args + return without manually typing the generics.
 */
export const defineTool = <
  TName extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType | undefined = undefined,
>(
  def: ToolDefinition<TName, TInput, TOutput>
): ToolDefinition<TName, TInput, TOutput> => def;

const isCallToolResult = (value: unknown): value is CallToolResult =>
  value !== null &&
  typeof value === "object" &&
  "content" in value &&
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowed by `"content" in value`
  Array.isArray((value as { content: unknown }).content);

const errorResult = (message: string): CallToolResult => ({
  content: [{ text: message, type: "text" }],
  isError: true,
});

const formatZodIssues = (error: z.ZodError): string =>
  error.issues
    .map(
      (i) =>
        `${i.path.length === 0 ? "<root>" : i.path.join(".")}: ${i.message}`
    )
    .join("; ");

/**
 * Validate args against the tool's input schema, run `execute`, then wrap the
 * result into an MCP `CallToolResult`. Tools that need image / resource /
 * multi-block content return a raw `CallToolResult` (detected via the
 * `content` field) and skip the `outputSchema` validation path entirely.
 */
export const callTool = async (
  tool: AnyToolDefinition,
  args: unknown,
  ctx: ToolContext
): Promise<CallToolResult> => {
  const parsed = tool.inputSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return errorResult(`Invalid arguments: ${formatZodIssues(parsed.error)}`);
  }
  let result: unknown;
  try {
    result = await tool.execute(parsed.data, ctx);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
  if (isCallToolResult(result)) {
    return result;
  }
  if (tool.outputSchema !== undefined) {
    const validated = tool.outputSchema.safeParse(result);
    if (!validated.success) {
      return errorResult(
        `Tool ${tool.name} returned invalid output: ${formatZodIssues(validated.error)}`
      );
    }
    return {
      content: [{ text: JSON.stringify(validated.data), type: "text" }],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- output schema parses to a JSON-shaped value at runtime
      structuredContent: validated.data as Record<string, unknown>,
    };
  }
  return {
    content: [
      {
        text: typeof result === "string" ? result : JSON.stringify(result),
        type: "text",
      },
    ],
  };
};

/**
 * Project the internal tool definition into the wire shape the MCP SDK's
 * ListTools handler returns. JSON Schemas come from Zod 4's built-in
 * `toJSONSchema`. `unrepresentable: "any"` keeps schemas with refinements
 * from throwing — the runtime Zod check still enforces them.
 */
export const toMcpTool = (tool: AnyToolDefinition): McpTool => ({
  ...(tool.annotations === undefined ? {} : { annotations: tool.annotations }),
  description: tool.description,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- toJSONSchema returns a JSON Schema; the SDK's `inputSchema` shape is structurally compatible
  inputSchema: z.toJSONSchema(tool.inputSchema, {
    unrepresentable: "any",
  }) as McpTool["inputSchema"],
  name: tool.name,
  ...(tool.outputSchema === undefined
    ? {}
    : {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- same rationale as inputSchema above
        outputSchema: z.toJSONSchema(tool.outputSchema, {
          unrepresentable: "any",
        }) as NonNullable<McpTool["outputSchema"]>,
      }),
});
