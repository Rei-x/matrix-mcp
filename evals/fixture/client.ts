import type {
  MatrixToolClient,
  MessageMatch,
  MessagePage,
  MessageSearchResult,
  RoomSummary,
  SendEventResponse,
} from "@/matrix/client";

import type { Fixture, FixtureMessage, FixtureRoom } from "./types";
import { WORK_FIXTURE } from "./work";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const senderMatches = (mxid: string, senderNeedle: string): boolean => {
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

const messagePassesFilters = (
  m: FixtureMessage,
  filters: SearchFilters
): boolean => {
  if (
    filters.senderNeedle !== "" &&
    !senderMatches(m.sender, filters.senderNeedle)
  ) {
    return false;
  }
  if (filters.after !== undefined && m.origin_server_ts < filters.after) {
    return false;
  }
  if (filters.before !== undefined && m.origin_server_ts >= filters.before) {
    return false;
  }
  if (filters.needle !== "" && !m.body.toLowerCase().includes(filters.needle)) {
    return false;
  }
  return true;
};

const summarize = (room: FixtureRoom, myUserId: string): RoomSummary => {
  const last = room.messages.at(-1);
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return {
    last_message_ts: last?.origin_server_ts ?? null,
    last_sender_is_me: last?.sender === myUserId,
    name: room.name,
    recent_message_count: room.messages.filter(
      (m) => m.origin_server_ts >= cutoff
    ).length,
    room_id: room.room_id,
    topic: room.topic,
  };
};

const toMessageEvent = (m: FixtureMessage) => ({
  body: m.body,
  event_id: m.event_id,
  msgtype: m.msgtype ?? "m.text",
  origin_server_ts: m.origin_server_ts,
  ...(m.reply_to_event_id === undefined
    ? {}
    : { reply_to_event_id: m.reply_to_event_id }),
  sender: m.sender,
});

/**
 * Cursor format: `<roomId>::<offsetFromNewest>`. The fixture serves messages
 * newest-first (matching the real `/messages?dir=b` behaviour) so the offset
 * is the count of newest-first messages we've already returned.
 */
const encodeCursor = (roomId: string, offset: number): string =>
  `${roomId}::${offset.toString(10)}`;

const decodeCursor = (
  cursor: string | undefined
): { offset: number; roomId: string | null } => {
  if (cursor === undefined) {
    return { offset: 0, roomId: null };
  }
  const sep = cursor.lastIndexOf("::");
  if (sep === -1) {
    return { offset: 0, roomId: null };
  }
  const roomId = cursor.slice(0, sep);
  const offset = Number.parseInt(cursor.slice(sep + 2), 10);
  return {
    offset: Number.isNaN(offset) ? 0 : offset,
    roomId,
  };
};

/* eslint-disable class-methods-use-this -- methods exist to satisfy MatrixToolClient; some don't need instance state */
export class FixtureMatrixClient implements MatrixToolClient {
  private readonly fixture: Fixture;

  constructor(fixture: Fixture = WORK_FIXTURE) {
    this.fixture = fixture;
  }

  whoAmI(): { user_id: string } {
    return { user_id: this.fixture.user_id };
  }

  listJoinedRooms(): RoomSummary[] {
    return this.fixture.rooms.map((room) =>
      summarize(room, this.fixture.user_id)
    );
  }

  countRoomMessages(roomId: string): number {
    const room = this.fixture.rooms.find((r) => r.room_id === roomId);
    return room?.messages.length ?? 0;
  }

  // eslint-disable-next-line require-await -- conform to MatrixToolClient
  async readMessages(
    roomId: string,
    options: { from?: string; limit?: number } = {}
  ): Promise<MessagePage> {
    const room = this.fixture.rooms.find((r) => r.room_id === roomId);
    if (room === undefined) {
      throw new Error(
        `Matrix API error 404: M_NOT_FOUND no fixture room with id ${roomId}`
      );
    }
    const limit = options.limit ?? 50;
    const cursor = decodeCursor(options.from);
    const startOffset =
      cursor.roomId === roomId || cursor.roomId === null ? cursor.offset : 0;

    const newestFirst = room.messages.toReversed();
    const slice = newestFirst.slice(startOffset, startOffset + limit);
    const nextOffset = startOffset + slice.length;

    const events = slice.map(toMessageEvent);
    const reachedEnd = nextOffset >= newestFirst.length;
    return {
      events,
      ...(reachedEnd ? {} : { next_batch: encodeCursor(roomId, nextOffset) }),
    };
  }

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
        ? this.fixture.rooms
        : this.fixture.rooms.filter(
            (r) => r.room_id === options.conversation_id
          );
    // Sort rooms by recency so the most relevant matches come first.
    const sortedRooms = [...rooms].toSorted((a, b) => {
      const aTs = a.messages.at(-1)?.origin_server_ts ?? 0;
      const bTs = b.messages.at(-1)?.origin_server_ts ?? 0;
      return bTs - aTs;
    });
    const matches: MessageMatch[] = [];
    let total = 0;
    for (const room of sortedRooms) {
      for (const m of room.messages) {
        if (!messagePassesFilters(m, filters)) {
          continue;
        }
        total += 1;
        if (matches.length < limit) {
          matches.push({
            body: m.body,
            conversation_id: room.room_id,
            conversation_title: room.name,
            message_id: m.event_id,
            origin_server_ts: m.origin_server_ts,
            sender: m.sender,
          });
        }
      }
    }
    return { matches, total, truncated: false };
  }

  // eslint-disable-next-line require-await -- read-only fixture; refuse all writes
  async sendText(_roomId: string, _body: string): Promise<SendEventResponse> {
    throw new Error(
      "Matrix API error 403: M_FORBIDDEN fixture client is read-only (eval mode)"
    );
  }

  // eslint-disable-next-line require-await -- read-only fixture; refuse all writes
  async sendReply(
    _roomId: string,
    _inReplyToEventId: string,
    _body: string
  ): Promise<SendEventResponse> {
    throw new Error(
      "Matrix API error 403: M_FORBIDDEN fixture client is read-only (eval mode)"
    );
  }
}
/* eslint-enable class-methods-use-this */
