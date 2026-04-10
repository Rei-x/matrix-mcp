import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { MatrixClient } from "@/matrix/client";

export const createUserTools = (client: MatrixClient) => ({
  whoami: createTool({
    description:
      "Return the authenticated Matrix user id. Use it to tell your own messages apart in transcripts.",
    execute: async () => {
      const result = await client.whoAmI();
      return { user_id: result.user_id };
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
      user_id: z.string(),
    }),
  }),
});
