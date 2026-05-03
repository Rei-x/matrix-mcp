# Design: Media attachments

Goal: let the downstream LLM agent see images sent in Matrix chats. Out of scope for V1: editing images, sending images, video/audio playback, E2EE rooms.

## Decisions (locked)

| #   | Decision                                                                                                                                                                                                   | Rationale                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Reference-then-fetch, not inline. `read_conversation` exposes a lightweight `attachment` object on each message; a new `read_media` tool returns the bytes.                                                | Inlining base64 in every `read_conversation` blows the token budget for chats that have lots of images the agent doesn't care about.                                                  |
| D2  | Return images as MCP `image` content blocks (`{ type: "image", data: <base64>, mimeType }`), not as text/URLs.                                                                                             | This is the LLM-native form. Anthropic's MCP client renders these as actual image inputs to the model.                                                                                |
| D3  | Default to a thumbnail (server-side resized via Matrix `/media/thumbnail`), opt-in to full resolution via `variant: "full"`. Cap full downloads at a configurable byte ceiling.                            | Token cost of base64-encoded images scales with pixel count. A 256-px thumbnail is usually enough to answer "is this the chart they meant".                                           |
| D4  | V1 only supports unencrypted media in unencrypted rooms. Encrypted rooms (E2EE) and attachment-encrypted files (`content.file`) return a clear error.                                                      | Olm/Megolm setup is a substantial project (crypto store, key backup, device verification). Ship the 80% first; gate E2EE behind a follow-up.                                          |
| D5  | Only `m.image` returns an image content block. `m.file` / `m.audio` / `m.video` return a text block describing the attachment with size and mimetype, plus an explicit "not directly readable in V1" note. | Models generally can't reason over raw binary audio/video/PDF. Returning a text description preserves discoverability without pretending we can render.                               |
| D6  | Address attachments by `(conversation_id, message_id)`, not by mxc URI.                                                                                                                                    | The agent already has these from `read_conversation` / `search_messages`. Hiding mxc URIs from the agent matches the existing convention of not exposing Matrix-internal identifiers. |

## Tool changes

### New: `read_media`

```ts
inputSchema: z.object({
  conversation_id: z.string(), // from list_conversations
  message_id: z.string(), // from read_conversation / search_messages; must point to a media message
  variant: z.enum(["thumbnail", "full"]).optional(), // default "thumbnail"
});
```

Output is **not** a normal Zod-validated object — it's an MCP tool result with mixed content blocks. See "Mastra escape hatch" below.

Behavior:

1. Look up the event via `sdkClient.getRoom(conversation_id).findEventById(message_id)`. If absent or not joined → error `"event not found in synced state"`.
2. Read content. If `content.file` (attachment-encrypted) → error `"encrypted attachments not supported in this build"`. If `content.url` is missing → error `"event is not a media message"`.
3. Branch on `msgtype`:
   - `m.image`:
     - Resolve the HTTP URL via `client.mxcUrlToHttp(mxcUrl, w, h, "scale", false, true, true)`. For `variant: "thumbnail"`, pass `THUMBNAIL_W`/`THUMBNAIL_H` (default 512×512). For `variant: "full"`, omit dimensions and use `mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false, true, true)`.
     - Fetch with `Authorization: Bearer <accessToken>` (Matrix 1.11 authenticated media is required by most current servers).
     - Enforce `MAX_MEDIA_BYTES` (default 10 MB) on `Content-Length` _and_ on actually-read bytes.
     - Encode to base64; return `{ content: [{ type: "image", data, mimeType }] }`.
   - `m.file` / `m.audio` / `m.video`: return a text block: `Attachment: <filename> (<mimetype>, <size_human>). This build can only render m.image as an image; other types are referenced but not downloaded.`
4. Return errors as `{ content: [{ type: "text", text: "..." }], isError: true }` so the agent sees them in-band rather than as a tool exception.

Tool description (LLM-facing) leads with the use case:

> Fetch a media attachment from a Matrix message and return it as an image (for `m.image`) or as a text description (for files/audio/video). Use after `read_conversation` or `search_messages` flags a message with an `attachment` field. By default returns a 512px thumbnail — set `variant: "full"` only when the thumbnail isn't enough (e.g. for OCR or fine detail), since full images cost more tokens.

### Modified: `read_conversation`

Add an optional `attachment` field to each message in the output:

```ts
attachment: z.object({
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(), // m.image / m.video only
  duration_ms: z.number().optional(), // m.audio / m.video only
  encrypted: z.boolean(), // true if content.file present
  filename: z.string().optional(),
  mimetype: z.string(),
  size_bytes: z.number().optional(),
}).optional();
```

Populated for events whose `msgtype` is `m.image` / `m.file` / `m.audio` / `m.video`. The existing `body` field already carries the filename/caption per Matrix spec, so it stays as-is.

Tool description gains one sentence: _"Messages with an `attachment` field can be fetched as image bytes (for images) or described in detail using `read_media`."_

### Modified: `search_messages`

Same `attachment` field added to each match. Same one-line description note. No filter on attachment type in V1 (YAGNI — the body usually contains the filename, which is searchable).

## Type / contract changes

### `MessageEvent` (`src/matrix/client.ts`)

Add an optional `attachment` field with the same shape as the tool output's `attachment`. Populate from `content.info` plus a derived `encrypted: content.file !== undefined`.

```ts
export interface MessageAttachment {
  dimensions?: { width: number; height: number };
  duration_ms?: number;
  encrypted: boolean;
  filename?: string;
  mimetype: string;
  size_bytes?: number;
}

export interface MessageEvent {
  attachment?: MessageAttachment;
  // ...existing fields unchanged
}
```

### `MatrixToolClient` interface

Add one method:

```ts
readMedia(
  roomId: string,
  eventId: string,
  options?: { variant?: "thumbnail" | "full" }
): Promise<
  | { type: "image"; data: Uint8Array; mimetype: string }
  | { type: "description"; text: string }
>;
```

The tool layer base64-encodes the `Uint8Array`. Returning bytes (not base64) from the client keeps the client transport-agnostic and lets the fixture return synthetic bytes for tests.

The fixture (`evals/fixture/client.ts`) implements this against in-memory PNG bytes per fixture message (tiny 1×1 PNGs are fine for evals — the goal is wire-format coverage, not visual realism).

## Constants

```ts
const THUMBNAIL_W = 512;
const THUMBNAIL_H = 512;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 30_000;
```

Hard-coded for V1. Promote to env vars if a need shows up.

## Mastra escape hatch (resolved)

Mastra's `MCPServer` always wraps tool results into a single `{ type: "text", text: JSON.stringify(result) }` content block (`node_modules/@mastra/mcp/dist/index.js`, lines 2867-2876). Image content blocks **cannot** be returned through `createTool`'s normal `execute` path.

**Decision**: register `read_media` outside Mastra. The MCP SDK's `Server._requestHandlers` is a Map and `setRequestHandler` replaces, so we override `ListToolsRequestSchema` and `CallToolRequestSchema` on `sdkServer = mcpServer.getServer()` _after_ Mastra constructs its handlers, capturing Mastra's original handlers via the (private but stable) `sdkServer["_requestHandlers"]` Map and delegating non-media calls to them.

Wire-up lives in `src/app.ts` in `createMCPServer`:

```ts
// 1. Build Mastra server with conversation tools (unchanged)
const mcpServer = new MCPServer({ id, name, tools, version });
const sdkServer = mcpServer.getServer();

// 2. Capture Mastra's handlers BEFORE replacing them
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- private SDK API; stable enough
const handlers = (sdkServer as any)._requestHandlers as Map<string, ...>;
const mastraListTools = handlers.get("tools/list");
const mastraCallTool = handlers.get("tools/call");

// 3. Override ListTools to append read_media metadata
sdkServer.setRequestHandler(ListToolsRequestSchema, async (req, extra) => {
  const base = await mastraListTools(req, extra);
  return { tools: [...base.tools, READ_MEDIA_TOOL_METADATA] };
});

// 4. Override CallTool to special-case read_media
sdkServer.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  if (req.params.name === "read_media") {
    return await handleReadMedia(client, req.params.arguments);
  }
  return await mastraCallTool(req, extra);
});
```

`READ_MEDIA_TOOL_METADATA` and `handleReadMedia` live in `src/tools/media.ts` (the new file). The metadata follows the MCP `Tool` shape: `{ name, description, inputSchema: <JSON Schema, generated via zodToJsonSchema(...)> }`. `handleReadMedia` returns the MCP `CallToolResult` directly: `{ content: [{ type: "image", data, mimeType }] }` for images, `{ content: [{ type: "text", text }] }` for files/audio/video, or `{ content: [{ type: "text", text }], isError: true }` for errors.

This gives us:

- Mastra continues to handle the existing tools with full Zod validation, logging, error wrapping
- `read_media` flows through the SDK directly and can return image content blocks unmangled
- One file (`app.ts`) owns the wiring; the tool factory (`media.ts`) stays self-contained

## Edge cases

- **Event not in synced state**: matrix-js-sdk's live timeline is bounded. If the agent passes a `message_id` from a paginated `read_conversation` result that's no longer in the live timeline, `findEventById` returns null. Mitigation: walk all timeline sets via `room.getTimelineSets()` before giving up. Document the failure mode in the tool description.
- **Server returns redirect to CDN**: pass `allowRedirects: true` to `mxcUrlToHttp`. The `fetch` call should follow redirects (default in Node fetch).
- **Server returns wrong `Content-Type`**: trust `content.info.mimetype` (set by the sender) over the response header for the MCP `mimeType` field. Servers sometimes return `application/octet-stream` for everything.
- **Image is HEIC / WebP / AVIF / SVG**: Anthropic's image input accepts JPEG/PNG/GIF/WebP. For HEIC/AVIF/SVG, we have two choices in V1: (a) refuse with a "convert to JPEG/PNG to view" message, or (b) ship as-is and let the client reject. **Decision**: ship as-is — the model client surfaces a clear error and the agent can fall back to reading the filename. Add a comment noting this; revisit if it bites.
- **Authenticated vs legacy media**: `mxcUrlToHttp(..., useAuthentication: true)` returns the `_matrix/client/v1/media/{download,thumbnail}/...` path. If the homeserver is too old to support it, fall back to the legacy unauthenticated path on 404 (one retry, no auth header). Most homeservers worth running today support v1.11+.
- **`m.file` attachments that are actually images**: some clients (especially bridges) send PDFs/PNGs as `m.file` with an image mimetype. V1 keeps the strict `m.image`-only image rendering — agents can still see the attachment metadata via the `attachment` field on `read_conversation`, and a follow-up can broaden if it matters.
- **Animated GIF**: send as-is (image/gif). Anthropic's image input handles the first frame.
- **Encrypted attachments (`content.file`) in unencrypted rooms**: clean error per D4. Implementing this is a one-screen patch (use `matrix-encrypt-attachment`'s `decryptAttachment(buffer, file)`), but defer to keep V1 small.

## File map for implementation

Two parallelizable groups (same split pattern as the previous PR):

### Group A: client + fixture

- `src/matrix/client.ts`
  - Extend `MessageEvent` with `attachment?: MessageAttachment`.
  - Populate `attachment` in `readMessages` (parse `content.info`).
  - Add `readMedia(roomId, eventId, options)` method:
    - Find event across all timeline sets.
    - Branch on msgtype + presence of `content.file` (encrypted error path).
    - Resolve thumbnail vs full URL via `mxcUrlToHttp`.
    - Fetch with `Authorization: Bearer <accessToken>`, `signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)`.
    - Enforce `MAX_MEDIA_BYTES`.
- `evals/fixture/client.ts`
  - Same `MessageEvent.attachment` extension.
  - `readMedia` returns synthetic `{ type: "image", data: <1x1 PNG bytes>, mimetype: "image/png" }` for fixture messages whose `msgtype === "m.image"`, description text otherwise.
  - Add an `attachment?: MessageAttachment` field to `FixtureMessage` for fixture authors who want to model media events.

### Group B: tool wiring

- `src/tools/conversations.ts`
  - Add `attachment` to the message output schemas of `read_conversation` and `search_messages`. Pass through from `MessageEvent.attachment`.
  - Update both tool descriptions with the one-sentence pointer to `read_media`.
- `src/tools/media.ts` (new file, mirroring the `conversations.ts` factory pattern)
  - Export `createMediaTools(client: MatrixToolClient)` returning `{ read_media: createTool({...}) }`.
  - If Mastra path (1) above works, normal `createTool`. Otherwise, this file exports a registration helper that the app wires into the raw MCP `Server`.
- `src/tools/index.ts`
  - Aggregate the new tools.

## Tests

Integration (`src/test/mcp/`):

- New `register-media.ts`: upload a small PNG via the SDK to the test room, then call `read_media` with `variant: "thumbnail"` and assert content type / non-zero byte length / mimetype.
- Extend `register-conversations.ts`: after the upload, assert that `read_conversation` returns the message with an `attachment` field carrying mimetype + dimensions.
- Negative case: `read_media` with a non-media `message_id` returns an `isError` text block, not a thrown exception.
- Negative case: `read_media` against a message in an E2EE room (if the test infrastructure has one — otherwise fixture-only) returns the encrypted-not-supported error.

Fixture/eval (`evals/`):

- Add 1–2 fixture messages with `attachment` to `WORK_FIXTURE` so the eval suite can exercise "what's in the screenshot Anna sent in the incident channel" style questions.
- New eval qa_pair that requires the agent to call `read_media` and reason over a fixture image (use the description-text path until/unless the eval harness handles synthetic image bytes).

## Non-goals (write down so we don't drift)

- Sending images. Out of scope; orthogonal feature.
- E2EE room support. Tracked separately; needs Olm/crypto store.
- Server-side OCR / image preprocessing. The model does this.
- Attachment caching beyond what HTTP gives us. Mxc URLs are immutable; HTTP cache headers handle re-fetches.
- Resource subscriptions (MCP supports streaming resource updates; not relevant here).
