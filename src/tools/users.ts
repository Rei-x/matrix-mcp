import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { MatrixClient } from "@/matrix/client";

export const createUserTools = (client: MatrixClient) => ({
  get_user_profile: createTool({
    description: "Get the display name of a Matrix user.",
    execute: async (args) => {
      const displayname = await client.getDisplayName(args.user_id);
      return { displayname, user_id: args.user_id };
    },
    id: "get_user_profile",
    inputSchema: z.object({
      user_id: z
        .string()
        .describe("The Matrix user ID (e.g., @user:matrix.org)"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      displayname: z.string().nullable(),
      user_id: z.string(),
    }),
  }),

  search_users: createTool({
    description:
      "Search the Matrix user directory for people by name or user ID.",
    execute: async (args) => {
      const result = await client.searchUserDirectory(
        args.search_term,
        args.limit
      );
      return result;
    },
    id: "search_users",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum results to return (default: 10)"),
      search_term: z.string().describe("Name or user ID to search for"),
    }),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      limited: z.boolean(),
      results: z.array(
        z.object({
          avatar_url: z.string().optional(),
          display_name: z.string().optional(),
          user_id: z.string(),
        })
      ),
    }),
  }),

  whoami: createTool({
    description: "Get the currently authenticated Matrix user's identity.",
    execute: async () => {
      const result = await client.whoAmI();
      return result;
    },
    id: "whoami",
    inputSchema: z.object({}),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      device_id: z.string(),
      is_guest: z.boolean(),
      user_id: z.string(),
    }),
  }),
});
