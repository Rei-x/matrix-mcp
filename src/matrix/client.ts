import * as sdk from "matrix-js-sdk";
import { logger as sdkLogger } from "matrix-js-sdk/lib/logger.js";

// matrix-js-sdk uses loglevel internally; silence its noisy default output.
/* eslint-disable @typescript-eslint/no-deprecated, @typescript-eslint/no-unsafe-type-assertion -- loglevel API not in typings; the deprecated `logger` constant is the only handle on the underlying loglevel singleton */
(sdkLogger as unknown as { disableAll: () => void }).disableAll();
/* eslint-enable @typescript-eslint/no-deprecated, @typescript-eslint/no-unsafe-type-assertion */

// --- Public types ---

export interface RoomSummary {
  last_message_ts: number | null;
  name: string | null;
  room_id: string;
  topic: string | null;
}

export interface MessageEvent {
  body: string;
  event_id: string;
  msgtype: string;
  origin_server_ts: number;
  reply_to_event_id?: string;
  sender: string;
}

export interface MessagePage {
  events: MessageEvent[];
  next_batch?: string;
}

export interface SendEventResponse {
  event_id: string;
}

export interface MessageMatch {
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
  readMessages(
    roomId: string,
    options?: { from?: string; limit?: number }
  ): Promise<MessagePage>;
  searchMessages(
    query: string,
    options?: { conversation_id?: string; limit?: number }
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

const summarizeRoom = (room: sdk.Room): RoomSummary => ({
  last_message_ts: roomLastTsOf(room),
  name: roomNameOf(room),
  room_id: room.roomId,
  topic: stateString(room, "m.room.topic", "topic"),
});

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
  private readonly sdkClient: sdk.MatrixClient;
  private startPromise: Promise<void> | null = null;

  constructor(baseUrl: string, accessToken: string) {
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
    return this.sdkClient.getRooms().filter(isJoined).map(summarizeRoom);
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
    return summarizeRoom(room);
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
      const replyToEventId = extractReplyTo(content);
      events.push({
        body,
        event_id: ev.event_id,
        msgtype: typeof msgtype === "string" ? msgtype : "m.text",
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
    query: string,
    options: { conversation_id?: string; limit?: number } = {}
  ): MessageSearchResult {
    const limit = options.limit ?? 20;
    const needle = query.toLowerCase();
    if (needle === "") {
      return { matches: [], total: 0, truncated: false };
    }
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
        if (!body.toLowerCase().includes(needle)) {
          continue;
        }
        total += 1;
        if (matches.length < limit) {
          matches.push({
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
