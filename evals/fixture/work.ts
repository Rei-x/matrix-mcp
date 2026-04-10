/**
 * Work-flavoured eval fixture: engineering channels, an incident postmortem,
 * a release coordination room, a design-doc DM with a coworker, and a
 * Discord bridge. All timestamps are frozen to early-to-mid September 2025
 * so qa_pair answers stay stable across runs.
 */

import type { Fixture, FixtureRoom } from "./types";
import { tsOf as ts } from "./types";

export const WORK_USER_ID = "@rei:fixture.local";

const ALICE = "@alice:fixture.local";
const BOB = "@bob:fixture.local";
const CHARLIE = "@charlie:fixture.local";
const DISCORDBOT = "@discordbot:fixture.local";
const ME = WORK_USER_ID;

const ROOMS: FixtureRoom[] = [
  {
    messages: [
      {
        body: "Standup: working on the auth redesign today.",
        event_id: "$evt-eng-1:fixture.local",
        origin_server_ts: ts("2025-09-10T09:00:00Z"),
        sender: ME,
      },
      {
        body: "Standup: PR #234 is up for review, needs eyes from the platform team.",
        event_id: "$evt-eng-2:fixture.local",
        origin_server_ts: ts("2025-09-10T09:01:00Z"),
        sender: BOB,
      },
      {
        body: "Standup: migrating analytics pipeline to the new warehouse.",
        event_id: "$evt-eng-3:fixture.local",
        origin_server_ts: ts("2025-09-10T09:02:00Z"),
        sender: CHARLIE,
      },
      {
        body: "Anyone seeing flaky CI on PR #240?",
        event_id: "$evt-eng-4:fixture.local",
        origin_server_ts: ts("2025-09-12T14:00:00Z"),
        sender: ALICE,
      },
      {
        body: "Yeah, the test_database_migration test is flaky. Filed FLAKE-12 to track it.",
        event_id: "$evt-eng-5:fixture.local",
        origin_server_ts: ts("2025-09-12T14:05:00Z"),
        sender: BOB,
      },
      {
        body: "Will pick up FLAKE-12 after standup tomorrow.",
        event_id: "$evt-eng-6:fixture.local",
        origin_server_ts: ts("2025-09-12T14:10:00Z"),
        sender: ME,
      },
    ],
    name: "engineering-team",
    room_id: "!engineering:fixture.local",
    topic: "Engineering team async standup and discussion.",
  },
  {
    messages: [
      {
        body: "PagerDuty alert: API latency spike on east-1.",
        event_id: "$evt-inc-1:fixture.local",
        origin_server_ts: ts("2025-09-14T08:32:00Z"),
        sender: BOB,
      },
      {
        body: "Looking into it. Checking deployment history for the last hour.",
        event_id: "$evt-inc-2:fixture.local",
        origin_server_ts: ts("2025-09-14T08:34:00Z"),
        sender: ME,
      },
      {
        body: "Database replica lag is at 12 seconds and climbing.",
        event_id: "$evt-inc-3:fixture.local",
        origin_server_ts: ts("2025-09-14T08:41:00Z"),
        sender: ALICE,
      },
      {
        body: "Found it. The 14:30 deploy ran a CREATE INDEX without CONCURRENTLY and is holding a table lock.",
        event_id: "$evt-inc-4:fixture.local",
        origin_server_ts: ts("2025-09-14T09:02:00Z"),
        sender: ME,
      },
      {
        body: "Rollback in progress.",
        event_id: "$evt-inc-5:fixture.local",
        origin_server_ts: ts("2025-09-14T09:10:00Z"),
        sender: ME,
      },
      {
        body: "Rolled back. Latency is normalising.",
        event_id: "$evt-inc-6:fixture.local",
        origin_server_ts: ts("2025-09-14T09:15:00Z"),
        sender: ME,
      },
      {
        body: "Post-mortem: migration 0042 was missing the CONCURRENTLY keyword on CREATE INDEX. Adding a lint rule to catch this in CI.",
        event_id: "$evt-inc-7:fixture.local",
        origin_server_ts: ts("2025-09-14T10:30:00Z"),
        sender: ALICE,
      },
    ],
    name: "incident-2025-09-14",
    room_id: "!incident-20250914:fixture.local",
    topic: "Incident response channel for the Sept 14 latency spike.",
  },
  {
    messages: [
      {
        body: "v2.3.0 ready for release. Cutting branch tomorrow.",
        event_id: "$evt-rel-1:fixture.local",
        origin_server_ts: ts("2025-09-20T13:00:00Z"),
        sender: CHARLIE,
      },
      {
        body: "Branch cut. Please freeze main.",
        event_id: "$evt-rel-2:fixture.local",
        origin_server_ts: ts("2025-09-21T09:00:00Z"),
        sender: BOB,
      },
      {
        body: "Found a bug in the release branch. Pushing fix.",
        event_id: "$evt-rel-3:fixture.local",
        origin_server_ts: ts("2025-09-21T11:30:00Z"),
        sender: ME,
      },
      {
        body: "Release notes draft: https://wiki.fixture.local/releases/v2.3.0",
        event_id: "$evt-rel-4:fixture.local",
        origin_server_ts: ts("2025-09-21T14:00:00Z"),
        sender: CHARLIE,
      },
      {
        body: "v2.3.0 deployed to staging. Smoke tests green.",
        event_id: "$evt-rel-5:fixture.local",
        origin_server_ts: ts("2025-09-22T10:00:00Z"),
        sender: CHARLIE,
      },
      {
        body: "v2.3.0 deployed to production.",
        event_id: "$evt-rel-6:fixture.local",
        origin_server_ts: ts("2025-09-23T15:30:00Z"),
        sender: CHARLIE,
      },
    ],
    name: "release-discussion",
    room_id: "!release:fixture.local",
    topic: "Release coordination for the v2.x line.",
  },
  {
    messages: [
      {
        body: "Hey, can you review the design doc I shared?",
        event_id: "$evt-dm-1:fixture.local",
        origin_server_ts: ts("2025-09-15T10:00:00Z"),
        sender: ALICE,
      },
      {
        body: "Here's the link: https://docs.fixture.local/d/auth-redesign",
        event_id: "$evt-dm-2:fixture.local",
        origin_server_ts: ts("2025-09-15T10:01:00Z"),
        sender: ALICE,
      },
      {
        body: "Sure, looking now.",
        event_id: "$evt-dm-3:fixture.local",
        origin_server_ts: ts("2025-09-15T10:30:00Z"),
        sender: ME,
      },
      {
        body: "Looks good overall. Left comments on slide 4 about the token TTL — I think 24h is too long.",
        event_id: "$evt-dm-4:fixture.local",
        origin_server_ts: ts("2025-09-15T11:15:00Z"),
        sender: ME,
      },
      {
        body: "Thanks! Will revise.",
        event_id: "$evt-dm-5:fixture.local",
        origin_server_ts: ts("2025-09-15T11:20:00Z"),
        sender: ALICE,
      },
    ],
    name: "Alice",
    room_id: "!dm-alice:fixture.local",
    topic: null,
  },
  {
    messages: [
      {
        body: "[discord:user42] Hello from the Discord side!",
        event_id: "$evt-dis-1:fixture.local",
        origin_server_ts: ts("2025-09-11T20:00:00Z"),
        sender: DISCORDBOT,
      },
      {
        body: "Hi! This channel is bridged from Discord — replies show up there too.",
        event_id: "$evt-dis-2:fixture.local",
        origin_server_ts: ts("2025-09-11T20:05:00Z"),
        sender: ME,
      },
      {
        body: "[discord:moderator] Heads up: Discord server upgrade tonight at 22:00 UTC.",
        event_id: "$evt-dis-3:fixture.local",
        origin_server_ts: ts("2025-09-12T18:00:00Z"),
        sender: DISCORDBOT,
      },
    ],
    name: "discord-bridge",
    room_id: "!discord:fixture.local",
    topic: "Bridge from #general on the community Discord server.",
  },
];

export const WORK_FIXTURE: Fixture = {
  rooms: ROOMS,
  user_id: WORK_USER_ID,
};
