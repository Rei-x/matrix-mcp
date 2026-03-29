import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { MatrixClient } from "@/matrix/client";

export const registerUserTools = (server: McpServer, client: MatrixClient) => {
  server.registerTool(
    "whoami",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description: "Get the currently authenticated Matrix user's identity.",
      inputSchema: {},
      title: "Who Am I",
    },
    async () => {
      const result = await client.whoAmI();
      return {
        content: [
          { text: JSON.stringify(result, null, 2), type: "text" as const },
        ],
      };
    }
  );

  server.registerTool(
    "search_users",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description:
        "Search the Matrix user directory for people by name or user ID.",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .describe("Maximum results to return (default: 10)"),
        search_term: z.string().describe("Name or user ID to search for"),
      },
      title: "Search Users",
    },
    async (args) => {
      const result = await client.searchUserDirectory(
        args.search_term,
        args.limit
      );
      return {
        content: [
          { text: JSON.stringify(result, null, 2), type: "text" as const },
        ],
      };
    }
  );

  server.registerTool(
    "get_user_profile",
    {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      description: "Get the display name of a Matrix user.",
      inputSchema: {
        user_id: z
          .string()
          .describe("The Matrix user ID (e.g., @user:matrix.org)"),
      },
      title: "Get User Profile",
    },
    async (args) => {
      const displayname = await client.getDisplayName(args.user_id);
      return {
        content: [
          {
            text: JSON.stringify({ displayname, user_id: args.user_id }),
            type: "text" as const,
          },
        ],
      };
    }
  );
};
