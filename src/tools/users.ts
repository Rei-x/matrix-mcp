import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { MatrixToolClient } from "@/matrix/client";

export const createUserTools = (client: MatrixToolClient) => ({
  whoami: createTool({
    description:
      "Returns your own Matrix user id (e.g. `@alice:example.com`). Use it to recognise which lines in `read_conversation` transcripts you sent yourself.",
    // eslint-disable-next-line require-await -- Mastra createTool's execute must return a Promise even when the underlying read is synchronous
    execute: async () => ({ user_id: client.whoAmI().user_id }),
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
