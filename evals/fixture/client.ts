import type {
  MatrixToolClient,
  MessagePage,
  RoomSummary,
  SendEventResponse,
} from "@/matrix/client";

import type { Fixture, FixtureMessage, FixtureRoom } from "./types";
import { WORK_FIXTURE } from "./work";

const summarize = (room: FixtureRoom): RoomSummary => {
  const last = room.messages.at(-1);
  return {
    last_message_ts: last?.origin_server_ts ?? null,
    name: room.name,
    room_id: room.room_id,
    topic: room.topic,
  };
};

const toMessageEvent = (m: FixtureMessage) => ({
  body: m.body,
  event_id: m.event_id,
  origin_server_ts: m.origin_server_ts,
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
    return this.fixture.rooms.map(summarize);
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
