import { WORK_FIXTURE } from "../fixture/work";
import type { EvalSuite } from "./types";

export const WORK_SUITE: EvalSuite = {
  description:
    "Work-flavoured retrieval and synthesis: incident postmortems, release coordination, engineering standups, design-doc DMs, and a Discord bridge.",
  fixture: WORK_FIXTURE,
  questions: [
    {
      answer: "alice",
      question:
        "Find the channel about the production incident that took place on 2025-09-14. Which user reported that the database replica lag was climbing? Reply with only the username (no @ sign and no domain).",
      slug: "incident-replica-lag-reporter",
    },
    {
      answer: "0042",
      question:
        "Find the channel about the production incident that took place on 2025-09-14. According to the post-mortem message in that channel, which migration number was missing the CONCURRENTLY keyword? Reply with just the migration number, exactly as it appears in the message.",
      slug: "incident-postmortem-migration",
    },
    {
      answer: "43",
      question:
        "In the channel about the production incident from 2025-09-14, how many whole minutes elapsed between the very first PagerDuty alert and the message confirming that the rollback had completed and latency was normalising? Reply with just the integer.",
      slug: "incident-rollback-duration-minutes",
    },
    {
      answer: "https://docs.fixture.local/d/auth-redesign",
      question:
        "Find your direct-message conversation with the user named Alice. What URL did Alice share for the design document she asked you to review? Reply with just the URL — no surrounding text.",
      slug: "dm-alice-design-doc-url",
    },
    {
      answer: "bob",
      question:
        "Find the conversation where the v2.3.0 release was coordinated. Which user posted the message announcing that the release branch had been cut and asking the team to freeze main? Reply with only the username (no @ sign and no domain).",
      slug: "release-branch-cut-author",
    },
    {
      answer: "2025-09-23",
      question:
        "Find the conversation where the v2.3.0 release was coordinated. On what date was v2.3.0 actually deployed to production (not staging)? Reply in YYYY-MM-DD format.",
      slug: "release-prod-deploy-date",
    },
    {
      answer: "FLAKE-12",
      question:
        "Find the engineering team's standup channel. A ticket id was mentioned in connection with a flaky test. What is the exact ticket id? Reply with just the ticket id, in the same format and case it appears in the message.",
      slug: "engineering-flake-ticket-id",
    },
    {
      answer: "4",
      question:
        "Find your direct-message conversation with Alice. After Alice shared the design document, you left a comment about the token TTL. On which slide of the document did you leave that comment? Reply with just the slide number as an integer.",
      slug: "dm-alice-token-ttl-slide",
    },
    {
      answer: "discordbot",
      question:
        "Find the conversation that bridges messages from Discord. The heads-up about the upcoming Discord server upgrade was posted to Matrix by a single bridge-bot user (not a real human; the original Discord author appears as a `[discord:<name>]` prefix in the message body). What is the localpart of that bridge-bot's Matrix user id (no @ sign, no domain)?",
      slug: "discord-bridge-upgrade-sender",
    },
    {
      answer: "3",
      question:
        "Across all of your joined conversations, in how many distinct conversations does at least one message appear from the user whose username localpart is 'bob'? Reply with just the integer.",
      slug: "bob-conversation-count",
    },
  ],
  slug: "work",
};
