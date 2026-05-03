/**
 * Common types for matrix-mcp eval fixtures.
 *
 * A `Fixture` is a frozen, deterministic snapshot of one user's Matrix world.
 * Multiple fixtures can coexist (e.g. work vs personal) and each suite picks
 * which one its qa_pairs run against.
 */

import type { MessageAttachment } from "@/matrix/client";

export interface FixtureMessage {
  attachment?: MessageAttachment;
  body: string;
  event_id: string;
  msgtype?: string;
  origin_server_ts: number;
  reply_to_event_id?: string;
  sender: string;
}

export interface FixtureRoom {
  /** chronological (oldest → newest); the fixture client serves them backwards */
  messages: FixtureMessage[];
  name: string;
  room_id: string;
  topic: string | null;
}

export interface Fixture {
  rooms: FixtureRoom[];
  /** mxid of the syncing user this fixture represents */
  user_id: string;
}

export const tsOf = (iso: string): number => new Date(iso).getTime();
