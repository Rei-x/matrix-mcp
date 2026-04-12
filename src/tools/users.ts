import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { MatrixToolClient } from "@/matrix/client";

export const createUserTools = (client: MatrixToolClient) => ({
  whoami: createTool({
    description:
      "Returns your own Matrix user id. Use it to identify which messages in read_conversation you sent yourself.",
    // eslint-disable-next-line require-await -- Mastra createTool's execute must return a Promise even when the underlying read is synchronous
    execute: async () => ({
      hint: "Use list_conversations to browse chats, or search_messages to find a specific conversation.",
      user_id: client.whoAmI().user_id,
    }),
    id: "whoami",
    inputSchema: z.object({}),
    mcp: {
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    outputSchema: z.object({
      hint: z.string(),
      user_id: z.string(),
    }),
  }),
});
