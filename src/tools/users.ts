import { z } from "zod";

import { defineTool } from "@/mcp/tool";

export const whoami = defineTool({
  annotations: {
    idempotentHint: true,
    readOnlyHint: true,
  },
  description:
    "Returns your own Matrix user id. Use it to identify which messages in read_conversation you sent yourself.",
  // eslint-disable-next-line require-await -- defineTool's execute must return a Promise even when the underlying read is synchronous
  execute: async (_input, { client }) => ({
    hint: "Use list_conversations to browse chats, or search_messages to find a specific conversation.",
    user_id: client.whoAmI().user_id,
  }),
  inputSchema: z.object({}),
  name: "whoami",
  outputSchema: z.object({
    hint: z.string(),
    user_id: z.string(),
  }),
});
