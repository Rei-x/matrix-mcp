import * as sdk from "matrix-js-sdk";
import { logger as sdkLogger } from "matrix-js-sdk/lib/logger.js";

// matrix-js-sdk uses loglevel internally; silence its noisy default output.
/* eslint-disable @typescript-eslint/no-deprecated, @typescript-eslint/no-unsafe-type-assertion -- loglevel API not in typings; the deprecated `logger` constant is the only handle on the underlying loglevel singleton */
(sdkLogger as unknown as { disableAll: () => void }).disableAll();
/* eslint-enable @typescript-eslint/no-deprecated, @typescript-eslint/no-unsafe-type-assertion */

// --- Public types ---

export interface RoomSummary {
  last_message_ts: number | null;
  last_sender_is_me: boolean;
  name: string | null;
  recent_message_count: number;
  room_id: string;
  topic: string | null;
}

export interface MessageAttachment {
  dimensions?: { height: number; width: number };
  duration_ms?: number;
  encrypted: boolean;
  filename?: string;
  mimetype: string;
  size_bytes?: number;
}

export interface MessageEvent {
  attachment?: MessageAttachment;
  body: string;
  event_id: string;
  msgtype: string;
  origin_server_ts: number;
  reply_to_event_id?: string;
  sender: string;
}

export type ReadMediaResult =
  | { data: Uint8Array; mimetype: string; type: "image" }
  | { text: string; type: "description" };

export interface MessagePage {
  events: MessageEvent[];
  next_batch?: string;
}

export interface SendEventResponse {
  event_id: string;
}

export interface MessageMatch {
  attachment?: MessageAttachment;
  body: string;
  conversation_id: string;
  conversation_title: string | null;
  message_id: string;
  origin_server_ts: number;
  sender: string;
}

export interface MessageSearchResult {
  /** matches across rooms, oldest-first within each room, then ordered by room recency */
  matches: MessageMatch[];
  /** total number of matches found before applying `limit` */
  total: number;
  /** if true, the search exhausted in-memory state and there may be older messages on the homeserver */
  truncated: boolean;
}

export interface CreateRoomOptions {
  invite?: string[];
  is_direct?: boolean;
  name?: string;
  preset?: sdk.Preset;
  topic?: string;
}

/**
 * The minimal surface the MCP tools depend on. Both the real `MatrixClient`
 * (matrix-js-sdk-backed) and any test/eval fixture must implement this.
 */
export interface MatrixToolClient {
  whoAmI(): { user_id: string };
  listJoinedRooms(): RoomSummary[];
  countRoomMessages(roomId: string): number;
  readMedia(
    roomId: string,
    eventId: string,
    options?: { variant?: "thumbnail" | "full" }
  ): Promise<ReadMediaResult>;
  readMessages(
    roomId: string,
    options?: { from?: string; limit?: number }
  ): Promise<MessagePage>;
  searchMessages(
    query: string | undefined,
    options?: {
      after?: number;
      before?: number;
      conversation_id?: string;
      limit?: number;
      sender?: string;
    }
  ): MessageSearchResult;
  sendText(roomId: string, body: string): Promise<SendEventResponse>;
  sendReply(
    roomId: string,
    inReplyToEventId: string,
    body: string
  ): Promise<SendEventResponse>;
}

// --- Helpers ---

const MEMBERSHIP_JOIN = "join";

const isJoined = (room: sdk.Room): boolean =>
  room.getMyMembership() === MEMBERSHIP_JOIN;

const stateString = (
  room: sdk.Room,
  type: string,
  field: string
): string | null => {
  const liveState = room.getLiveTimeline().getState(sdk.EventTimeline.FORWARDS);
  if (liveState === undefined) {
    return null;
  }
  const event = liveState.getStateEvents(type, "");
  if (event === null) {
    return null;
  }
  const content: Record<string, unknown> = event.getContent();
  const value = content[field];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const roomNameOf = (room: sdk.Room): string | null => {
  const trimmed = room.name?.trim();
  return trimmed !== undefined && trimmed !== "" ? trimmed : null;
};

const roomLastTsOf = (room: sdk.Room): number | null => {
  const ts = room.getLastActiveTimestamp();
  return typeof ts === "number" && ts > 0 ? ts : null;
};

const messageBodyOf = (ev: sdk.MatrixEvent): string | null => {
  // matrix-js-sdk's getContent() returns `any`; narrow safely via unknown
  const content: unknown = ev.getContent();
  if (content === null || typeof content !== "object") {
    return null;
  }
  if (!("body" in content)) {
    return null;
  }
  const { body } = content;
  return typeof body === "string" && body !== "" ? body : null;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const THUMBNAIL_W = 512;
const THUMBNAIL_H = 512;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export const MSGTYPE = {
  AUDIO: "m.audio",
  FILE: "m.file",
  IMAGE: "m.image",
  TEXT: "m.text",
  VIDEO: "m.video",
} as const;
export type Msgtype = (typeof MSGTYPE)[keyof typeof MSGTYPE];

const MEDIA_MSGTYPES: ReadonlySet<string> = new Set([
  MSGTYPE.AUDIO,
  MSGTYPE.FILE,
  MSGTYPE.IMAGE,
  MSGTYPE.VIDEO,
]);

const countRecentMessages = (room: sdk.Room): number => {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return room
    .getLiveTimeline()
    .getEvents()
    .filter(
      (ev) =>
        ev.getType() === "m.room.message" &&
        ev.getTs() >= cutoff &&
        messageBodyOf(ev) !== null
    ).length;
};

/** Case-insensitive substring match against the full mxid AND its localpart. */
export const senderMatches = (mxid: string, senderNeedle: string): boolean => {
  const mxidLower = mxid.toLowerCase();
  if (mxidLower.includes(senderNeedle)) {
    return true;
  }
  const localpart = /^@([^:]+):/.exec(mxid)?.[1]?.toLowerCase() ?? "";
  return localpart.includes(senderNeedle);
};

interface SearchFilters {
  after?: number;
  before?: number;
  needle: string;
  senderNeedle: string;
}

const eventPassesFilters = (
  ev: sdk.MatrixEvent,
  body: string,
  filters: SearchFilters
): boolean => {
  if (
    filters.senderNeedle !== "" &&
    !senderMatches(ev.getSender() ?? "", filters.senderNeedle)
  ) {
    return false;
  }
  const ts = ev.getTs();
  if (filters.after !== undefined && ts < filters.after) {
    return false;
  }
  if (filters.before !== undefined && ts >= filters.before) {
    return false;
  }
  if (filters.needle !== "" && !body.toLowerCase().includes(filters.needle)) {
    return false;
  }
  return true;
};

const lastMessageSenderOf = (room: sdk.Room): string | null => {
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev === undefined) {
      continue;
    }
    if (ev.getType() !== "m.room.message") {
      continue;
    }
    if (messageBodyOf(ev) === null) {
      continue;
    }
    return ev.getSender() ?? null;
  }
  return null;
};

const summarizeRoom = (room: sdk.Room, myUserId: string): RoomSummary => ({
  last_message_ts: roomLastTsOf(room),
  last_sender_is_me: lastMessageSenderOf(room) === myUserId,
  name: roomNameOf(room),
  recent_message_count: countRecentMessages(room),
  room_id: room.roomId,
  topic: stateString(room, "m.room.topic", "topic"),
});

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberField = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const mimetypeOf = (info: Record<string, unknown>): string =>
  nonEmptyString(info.mimetype) ?? "application/octet-stream";

const filenameOf = (
  content: Record<string, unknown>,
  fallback?: string
): string | undefined =>
  nonEmptyString(content.filename) ?? nonEmptyString(content.body) ?? fallback;

const buildAttachment = (
  content: Record<string, unknown>,
  msgtype: string
): MessageAttachment | undefined => {
  if (!MEDIA_MSGTYPES.has(msgtype)) {
    return undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- content.info is sender-supplied JSON; we read fields with typeof guards
  const info = (content.info ?? {}) as Record<string, unknown>;
  const w = numberField(info.w);
  const h = numberField(info.h);
  const size = numberField(info.size);
  const duration = numberField(info.duration);
  const filename = filenameOf(content);
  return {
    ...(w === undefined || h === undefined
      ? {}
      : { dimensions: { height: h, width: w } }),
    ...(duration === undefined ? {} : { duration_ms: duration }),
    encrypted: content.file !== undefined,
    ...(filename === undefined ? {} : { filename }),
    mimetype: mimetypeOf(info),
    ...(size === undefined ? {} : { size_bytes: size }),
  };
};

const KIB = 1024;
const MIB = KIB * 1024;
const GIB = MIB * 1024;

const formatHumanSize = (bytes: number): string => {
  if (bytes >= GIB) {
    return `${(bytes / GIB).toFixed(1)} GB`;
  }
  if (bytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)} MB`;
  }
  if (bytes >= KIB) {
    return `${(bytes / KIB).toFixed(1)} KB`;
  }
  return `${bytes.toString(10)} B`;
};

const validateMediaContent = (
  content: Record<string, unknown>,
  msgtype: string
): string => {
  if (!MEDIA_MSGTYPES.has(msgtype)) {
    throw new Error("Matrix API error: event is not a media message");
  }
  if (content.file !== undefined) {
    throw new Error(
      "Matrix API error: encrypted attachments not supported in this build"
    );
  }
  const mxcUrl = content.url;
  if (typeof mxcUrl !== "string") {
    throw new TypeError("Matrix API error: media event missing url");
  }
  return mxcUrl;
};

/**
 * Format the user-facing description we return for `m.file`/`m.audio`/`m.video`
 * attachments — this build can't render their bytes inline. Shared with the
 * fixture so the wording can't drift.
 */
export const describeNonImageAttachment = (parts: {
  filename?: string;
  mimetype: string;
  sizeBytes?: number;
}): string => {
  const name = parts.filename ?? "(unnamed)";
  const size =
    parts.sizeBytes === undefined
      ? "size unknown"
      : formatHumanSize(parts.sizeBytes);
  return `Attachment: ${name} (${parts.mimetype}, ${size}). This build can only render m.image as an image; other types are referenced but not downloaded.`;
};

const describeNonImageContent = (content: Record<string, unknown>): string => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- content.info is sender-supplied JSON; we read fields with typeof guards
  const info = (content.info ?? {}) as Record<string, unknown>;
  return describeNonImageAttachment({
    filename: filenameOf(content),
    mimetype: mimetypeOf(info),
    sizeBytes: numberField(info.size),
  });
};

const extractReplyTo = (
  content: Record<string, unknown>
): string | undefined => {
  const relatesTo = content["m.relates_to"];
  if (
    relatesTo === null ||
    relatesTo === undefined ||
    typeof relatesTo !== "object"
  ) {
    return undefined;
  }
  const inReplyTo = (relatesTo as Record<string, unknown>)["m.in_reply_to"]; // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion -- narrowed by typeof check above
  if (
    inReplyTo === null ||
    inReplyTo === undefined ||
    typeof inReplyTo !== "object"
  ) {
    return undefined;
  }
  const eventId = (inReplyTo as Record<string, unknown>).event_id; // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion -- narrowed by typeof check above
  return typeof eventId === "string" ? eventId : undefined;
};

const formatMatrixError = (err: unknown): Error => {
  if (err instanceof sdk.MatrixError) {
    const status = err.httpStatus ?? "?";
    const code = err.errcode ?? "M_UNKNOWN";
    const detail = err.data?.error ?? err.message;
    return new Error(`Matrix API error ${status}: ${code} ${detail}`);
  }
  if (err instanceof Error) {
    return new Error(`Matrix API error: ${err.message}`);
  }
  return new Error(`Matrix API error: ${String(err)}`);
};

const wrap = async <T>(promise: Promise<T>): Promise<T> => {
  try {
    return await promise;
  } catch (error) {
    throw formatMatrixError(error);
  }
};

// --- Client ---

export class MatrixClient implements MatrixToolClient {
  private readonly accessToken: string;
  private readonly sdkClient: sdk.MatrixClient;
  private startPromise: Promise<void> | null = null;

  constructor(baseUrl: string, accessToken: string) {
    this.accessToken = accessToken;
    this.sdkClient = sdk.createClient({
      accessToken,
      baseUrl,
    });
  }

  /** Begin syncing and resolve once the initial sync (PREPARED) completes. */
  async start(): Promise<void> {
    this.startPromise ??= this.startInternal();
    await this.startPromise;
  }

  private async startInternal(): Promise<void> {
    // Establish our user id before sync starts so the SDK can build Room
    // objects with correct membership for the syncing user.
    if (this.sdkClient.getUserId() === null) {
      const me = await wrap(this.sdkClient.whoami());
      this.sdkClient.credentials.userId = me.user_id;
    }
    const { promise, resolve, reject } = Promise.withResolvers<null>();
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- bridging matrix-js-sdk's event-driven sync lifecycle into a promise
    const onSync = (
      state: sdk.SyncState,
      _prev: sdk.SyncState | null,
      data?: sdk.SyncStateData
    ): void => {
      if (state === sdk.SyncState.Prepared || state === sdk.SyncState.Syncing) {
        resolve(null);
        return;
      }
      if (state === sdk.SyncState.Error) {
        reject(data?.error ?? new Error("Initial Matrix sync failed"));
      }
    };
    this.sdkClient.on(sdk.ClientEvent.Sync, onSync);
    try {
      await this.sdkClient.startClient({ initialSyncLimit: 20 });
      await promise;
    } finally {
      this.sdkClient.off(sdk.ClientEvent.Sync, onSync);
    }
  }

  stop(): void {
    this.sdkClient.stopClient();
    this.startPromise = null;
  }

  // --- Identity ---

  whoAmI(): { user_id: string } {
    return { user_id: this.sdkClient.getSafeUserId() };
  }

  // --- Rooms (read from synced in-memory state) ---

  listJoinedRooms(): RoomSummary[] {
    const myUserId = this.sdkClient.getSafeUserId();
    return this.sdkClient
      .getRooms()
      .filter(isJoined)
      .map((room) => summarizeRoom(room, myUserId));
  }

  countRoomMessages(roomId: string): number {
    const room = this.sdkClient.getRoom(roomId);
    if (room === null || !isJoined(room)) {
      return 0;
    }
    return room
      .getLiveTimeline()
      .getEvents()
      .filter(
        (ev) => ev.getType() === "m.room.message" && messageBodyOf(ev) !== null
      ).length;
  }

  getRoom(roomId: string): RoomSummary | null {
    const room = this.sdkClient.getRoom(roomId);
    if (room === null || !isJoined(room)) {
      return null;
    }
    return summarizeRoom(room, this.sdkClient.getSafeUserId());
  }

  /**
   * Resolve once a room appears in the synced in-memory state. Useful in tests
   * after createRoom: the room only enters the store on the next /sync tick.
   */
  async waitForRoom(roomId: string, timeoutMs = 10_000): Promise<void> {
    if (this.sdkClient.getRoom(roomId) !== null) {
      return;
    }
    const client = this.sdkClient;
    const { promise, resolve, reject } = Promise.withResolvers<null>();
    const handle: { timer: ReturnType<typeof setTimeout> | null } = {
      timer: null,
    };
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- bridging matrix-js-sdk's Room event into a promise
    const onRoom = (room: sdk.Room): void => {
      if (room.roomId !== roomId) {
        return;
      }
      if (handle.timer !== null) {
        clearTimeout(handle.timer);
      }
      client.off(sdk.ClientEvent.Room, onRoom);
      resolve(null);
    };
    handle.timer = setTimeout(() => {
      client.off(sdk.ClientEvent.Room, onRoom);
      reject(new Error(`Timed out waiting for room ${roomId}`));
    }, timeoutMs);
    client.on(sdk.ClientEvent.Room, onRoom);
    await promise;
  }

  // --- Messages ---

  async readMessages(
    roomId: string,
    options: { from?: string; limit?: number } = {}
  ): Promise<MessagePage> {
    const limit = options.limit ?? 50;
    const filter = new sdk.Filter(this.sdkClient.getUserId());
    filter.setDefinition({
      room: { timeline: { types: ["m.room.message"] } },
    });
    const result = await wrap(
      this.sdkClient.createMessagesRequest(
        roomId,
        options.from ?? null,
        limit,
        sdk.Direction.Backward,
        filter
      )
    );
    const events: MessageEvent[] = [];
    for (const ev of result.chunk) {
      const content = ev.content as Record<string, unknown>;
      const { body, msgtype } = content;
      if (typeof body !== "string" || body === "") {
        continue;
      }
      const normalizedMsgtype =
        typeof msgtype === "string" ? msgtype : MSGTYPE.TEXT;
      const replyToEventId = extractReplyTo(content);
      const attachment = buildAttachment(content, normalizedMsgtype);
      events.push({
        ...(attachment === undefined ? {} : { attachment }),
        body,
        event_id: ev.event_id,
        msgtype: normalizedMsgtype,
        origin_server_ts: ev.origin_server_ts,
        ...(replyToEventId === undefined
          ? {}
          : { reply_to_event_id: replyToEventId }),
        sender: ev.sender,
      });
    }
    return {
      events,
      ...(typeof result.end === "string" ? { next_batch: result.end } : {}),
    };
  }

  /**
   * Case-insensitive substring search across the message bodies of every
   * joined room (or one specific room if `conversation_id` is set), reading
   * from the in-memory synced live timeline. No HTTP calls.
   *
   * Because matrix-js-sdk only keeps a bounded live timeline per room (the
   * default `initialSyncLimit` is 20 events), this can miss older messages
   * that the server has but the client hasn't paged in yet. The result's
   * `truncated` flag is true if any room hit its in-memory limit.
   */
  searchMessages(
    query: string | undefined,
    options: {
      after?: number;
      before?: number;
      conversation_id?: string;
      limit?: number;
      sender?: string;
    } = {}
  ): MessageSearchResult {
    const limit = options.limit ?? 20;
    const needle = query === undefined ? "" : query.toLowerCase();
    const senderNeedle = options.sender?.toLowerCase() ?? "";
    if (needle === "" && senderNeedle === "") {
      return { matches: [], total: 0, truncated: false };
    }
    const filters: SearchFilters = {
      after: options.after,
      before: options.before,
      needle,
      senderNeedle,
    };
    const rooms =
      options.conversation_id === undefined
        ? this.sdkClient.getRooms().filter(isJoined)
        : [this.sdkClient.getRoom(options.conversation_id)].filter(
            (r): r is sdk.Room => r !== null && isJoined(r)
          );
    // Sort rooms by recency so the most relevant matches come first.
    rooms.sort((a, b) => (roomLastTsOf(b) ?? 0) - (roomLastTsOf(a) ?? 0));
    const matches: MessageMatch[] = [];
    let truncated = false;
    let total = 0;
    for (const room of rooms) {
      const events = room.getLiveTimeline().getEvents();
      // The live timeline isn't guaranteed to hold the full room history.
      if (events.length >= 1000) {
        truncated = true;
      }
      const title = roomNameOf(room);
      for (const ev of events) {
        if (ev.getType() !== "m.room.message") {
          continue;
        }
        const body = messageBodyOf(ev);
        if (body === null) {
          continue;
        }
        if (!eventPassesFilters(ev, body, filters)) {
          continue;
        }
        total += 1;
        if (matches.length < limit) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- matrix-js-sdk getContent() is typed as `any`
          const evContent = ev.getContent() as Record<string, unknown>;
          const attachment = buildAttachment(
            evContent,
            nonEmptyString(evContent.msgtype) ?? MSGTYPE.TEXT
          );
          matches.push({
            ...(attachment === undefined ? {} : { attachment }),
            body,
            conversation_id: room.roomId,
            conversation_title: title,
            message_id: ev.getId() ?? "",
            origin_server_ts: ev.getTs(),
            sender: ev.getSender() ?? "",
          });
        }
      }
    }
    return { matches, total, truncated };
  }

  /**
   * Fetch a media attachment from a Matrix room. For `m.image`, downloads the
   * bytes (thumbnail by default) and returns them. For `m.file` / `m.audio` /
   * `m.video`, returns a textual description — this build doesn't render
   * non-image media. Encrypted attachments (`content.file`) are rejected.
   */
  async readMedia(
    roomId: string,
    eventId: string,
    options: { variant?: "thumbnail" | "full" } = {}
  ): Promise<ReadMediaResult> {
    const event = this.findRoomEvent(roomId, eventId);
    const content = event.getContent();
    const msgtype = nonEmptyString(content.msgtype) ?? "";
    const mxcUrl = validateMediaContent(content, msgtype);
    if (msgtype !== MSGTYPE.IMAGE) {
      return {
        text: describeNonImageContent(content),
        type: "description",
      };
    }
    const httpUrl = this.resolveMediaUrl(
      mxcUrl,
      options.variant ?? "thumbnail"
    );
    const { buffer, headerMime } = await this.downloadMedia(httpUrl);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- content.info is sender-supplied JSON; we read fields with typeof guards
    const info = (content.info ?? {}) as Record<string, unknown>;
    const mimetype =
      nonEmptyString(info.mimetype) ?? headerMime ?? "application/octet-stream";
    return { data: new Uint8Array(buffer), mimetype, type: "image" };
  }

  private findRoomEvent(roomId: string, eventId: string): sdk.MatrixEvent {
    const room = this.sdkClient.getRoom(roomId);
    if (room === null || !isJoined(room)) {
      throw new Error("Matrix API error: room not joined or not found");
    }
    for (const ts of room.getTimelineSets()) {
      const event = ts.findEventById(eventId);
      if (event !== undefined) {
        return event;
      }
    }
    throw new Error("Matrix API error: event not found in synced state");
  }

  private resolveMediaUrl(
    mxcUrl: string,
    variant: "thumbnail" | "full"
  ): string {
    const isThumbnail = variant === "thumbnail";
    const httpUrl = this.sdkClient.mxcUrlToHttp(
      mxcUrl,
      isThumbnail ? THUMBNAIL_W : undefined,
      isThumbnail ? THUMBNAIL_H : undefined,
      isThumbnail ? "scale" : undefined,
      false,
      true,
      true
    );
    if (httpUrl === null) {
      throw new Error("Matrix API error: failed to resolve mxc url");
    }
    return httpUrl;
  }

  private async downloadMedia(
    httpUrl: string
  ): Promise<{ buffer: ArrayBuffer; headerMime: string | undefined }> {
    const response = await fetch(httpUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(
        `Matrix API error ${response.status}: media download failed`
      );
    }
    const lenHeader = response.headers.get("content-length");
    const declaredLen =
      lenHeader === null ? null : Number.parseInt(lenHeader, 10);
    if (
      declaredLen !== null &&
      !Number.isNaN(declaredLen) &&
      declaredLen > MAX_MEDIA_BYTES
    ) {
      throw new Error("Matrix API error: media exceeds size limit");
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_MEDIA_BYTES) {
      throw new Error("Matrix API error: media exceeds size limit");
    }
    const headerMime = response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim();
    return { buffer, headerMime: nonEmptyString(headerMime) };
  }

  async sendText(roomId: string, body: string): Promise<SendEventResponse> {
    const result = await wrap(this.sdkClient.sendTextMessage(roomId, body));
    return { event_id: result.event_id };
  }

  async sendReply(
    roomId: string,
    inReplyToEventId: string,
    body: string
  ): Promise<SendEventResponse> {
    const result = await wrap(
      this.sdkClient.sendMessage(roomId, {
        body,
        "m.relates_to": {
          "m.in_reply_to": { event_id: inReplyToEventId },
        },
        msgtype: sdk.MsgType.Text,
      })
    );
    return { event_id: result.event_id };
  }

  // --- Test/admin helpers ---

  async createRoom(options: CreateRoomOptions): Promise<{ room_id: string }> {
    const result = await wrap(this.sdkClient.createRoom(options));
    return { room_id: result.room_id };
  }

  async leaveRoom(roomId: string): Promise<void> {
    await wrap(this.sdkClient.leave(roomId));
  }

  async forgetRoom(roomId: string): Promise<void> {
    await wrap(this.sdkClient.forget(roomId));
  }
}
