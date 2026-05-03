import { z } from "zod";

import { defineTool } from "@/mcp/tool";

export const read_media = defineTool({
  annotations: {
    idempotentHint: true,
    readOnlyHint: true,
  },
  description: [
    "Fetch a media attachment from a Matrix message and return it as an image (for m.image) or as a text description (for files/audio/video).",
    "Use after `read_conversation` or `search_messages` flags a message with an `attachment` field.",
    'By default returns a ~512px thumbnail — set `variant: "full"` only when the thumbnail isn\'t enough (e.g. for OCR or fine detail), since full images cost more tokens.',
    "Encrypted attachments and messages from end-to-end encrypted rooms are not supported in this build and return a clear error.",
  ].join(" "),
  execute: async (args, { client }) => {
    const result = await client.readMedia(
      args.conversation_id,
      args.message_id,
      args.variant === undefined ? {} : { variant: args.variant }
    );
    if (result.type === "image") {
      return {
        content: [
          {
            data: Buffer.from(result.data).toString("base64"),
            mimeType: result.mimetype,
            type: "image" as const,
          },
        ],
      };
    }
    return {
      content: [{ text: result.text, type: "text" as const }],
    };
  },
  inputSchema: z.object({
    conversation_id: z
      .string()
      .describe("conversation_id from list_conversations"),
    message_id: z
      .string()
      .describe(
        "message_id of a media message from read_conversation or search_messages (its message must have an `attachment` field)"
      ),
    variant: z
      .enum(["thumbnail", "full"])
      .optional()
      .describe(
        "thumbnail (default, ~512px, cheap) or full (original resolution, may be large)"
      ),
  }),
  name: "read_media",
});
