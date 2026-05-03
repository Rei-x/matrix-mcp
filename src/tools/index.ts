import type { AnyToolDefinition } from "@/mcp/types";

import {
  list_conversations,
  read_conversation,
  search_messages,
  send_message,
} from "./conversations";
import { read_media } from "./media";
import { whoami } from "./users";

/**
 * The complete tool catalog. Add new tools here. Order is preserved in the
 * MCP `tools/list` response, so put the most-used / most-discoverable tools
 * first.
 *
 * `as const satisfies` keeps each tool's specific type in the tuple — that
 * lets the test suite derive precise per-tool input/output types from this
 * single source of truth.
 */
export const ALL_TOOLS = [
  list_conversations,
  read_conversation,
  search_messages,
  read_media,
  send_message,
  whoami,
] as const satisfies readonly AnyToolDefinition[];
