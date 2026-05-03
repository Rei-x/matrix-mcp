import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

import type { MatrixToolClient } from "@/matrix/client";

/**
 * Hints clients can show to users about a tool's behavior. All optional —
 * absent annotations are not the same as `false`.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-annotations
 */
export interface ToolAnnotations {
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  readOnlyHint?: boolean;
  title?: string;
}

/**
 * Per-call context passed into every tool's `execute`. Extend this when tools
 * need new capabilities (sampling, elicitation, request signal, etc.); tools
 * opt in by destructuring fields they care about.
 */
export interface ToolContext {
  client: MatrixToolClient;
}

/**
 * Tool definition. `execute` may return:
 *  - a value matching `outputSchema` (or any value when omitted) — the
 *    dispatcher wraps it into `structuredContent` plus a JSON text fallback;
 *  - a raw `CallToolResult` when `content` is present — returned verbatim so
 *    the tool can emit image / resource / multi-block payloads (e.g. read_media).
 */
export interface ToolDefinition<
  TName extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType | undefined,
> {
  annotations?: ToolAnnotations;
  description: string;
  execute: (
    input: z.infer<TInput>,
    ctx: ToolContext
  ) => Promise<
    (TOutput extends z.ZodType ? z.infer<TOutput> : unknown) | CallToolResult
  >;
  inputSchema: TInput;
  name: TName;
  outputSchema?: TOutput;
}

export type AnyToolDefinition = ToolDefinition<
  string,
  z.ZodType,
  z.ZodType | undefined
>;
