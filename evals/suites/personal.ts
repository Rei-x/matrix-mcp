import { PERSONAL_FIXTURE } from "../fixture/personal";
import type { EvalSuite } from "./types";

/**
 * Personal-life eval suite.
 *
 * The qa_pairs target the kinds of questions a Claude agent driving the
 * matrix-mcp would actually face when helping a real person manage their
 * Matrix world: catching up on what's recent, pulling specific facts out of
 * DMs (times, dates, URLs, decisions), correlating across multiple chats,
 * and identifying who said what.
 *
 * Categories represented:
 *   - triage / catch-up           ("what's the most recent thing?")
 *   - fact recall                 ("what time / what date / which restaurant?")
 *   - URL retrieval               ("what airbnb / what registry link?")
 *   - coordination                ("when does the booking start? when's grandma's birthday?")
 *   - cross-conversation          ("how many of my chats has this person posted in?")
 *   - room identification         ("which conversation contains X?")
 *   - person-specific correlation ("which chat has the wedding mention?")
 *   - synthesis over self-history ("when did I send the thank-you for the cake?")
 *
 * All answers were verified by hand against `evals/fixture/personal.ts` and
 * are stable as long as the fixture doesn't change.
 */
export const PERSONAL_SUITE: EvalSuite = {
  description:
    "Personal-life retrieval and synthesis: DMs with mom/best-friend/partner, group plans (vacation, family, book club), and a WhatsApp bridge.",
  fixture: PERSONAL_FIXTURE,
  questions: [
    // ── Triage / catch-up ──────────────────────────────────────────────
    {
      answer: "Mom",
      question:
        "Among all of your joined conversations, which conversation contains the single most recent message of any kind? Reply with just the conversation's title, exactly as it appears in `list_conversations`.",
      slug: "most-recent-conversation",
    },

    // ── Fact recall in 1:1 DMs ────────────────────────────────────────
    {
      answer: "2025-10-03",
      question:
        "In your direct-message conversation with Mom, you confirm to her that you booked Lisa's dentist appointment. On what calendar date is the appointment itself scheduled to take place (NOT the date you sent the message saying you'd booked it)? Reply in YYYY-MM-DD format. The current year is 2025.",
      slug: "dm-mom-dentist-date",
    },
    {
      answer: "6:30",
      question:
        "In your direct-message conversation with Sam, Sam suggested a time to meet at Brooklyn Boulders for climbing. What is just the clock time he wrote (the digits and colon — NOT the venue, NOT 'at <place>', NOT any am/pm if Sam didn't write one)? Reply with only the clock value, e.g. '7:00'.",
      slug: "dm-sam-climbing-time",
    },
    {
      answer: "Rosella",
      question:
        "In your direct-message conversation with Jamie, Jamie made a reservation for your anniversary. At which restaurant? Reply with just the restaurant name.",
      slug: "dm-jamie-anniversary-restaurant",
    },

    // ── URL retrieval ─────────────────────────────────────────────────
    {
      answer: "https://airbnb.com/rooms/lisbon-alfama-loft",
      question:
        "Find the conversation that is planning a trip to Lisbon. What is the URL of the airbnb that someone shared in that chat? Reply with just the URL — no surrounding text or quotes.",
      slug: "lisbon-airbnb-url",
    },

    // ── Coordination / dates ──────────────────────────────────────────
    {
      answer: "2026-03-14",
      question:
        "In the conversation planning the trip to Lisbon, on what date does the booked accommodation check in? Reply in YYYY-MM-DD format.",
      slug: "lisbon-checkin-date",
    },
    {
      answer: "The Overstory",
      question:
        "Find your book club conversation. What is the title of the book chosen for October? Reply with just the book title, exactly as written in the message (no author, no quote marks).",
      slug: "book-club-october-title",
    },
    {
      answer: "2025-10-05",
      question:
        "In your family group chat, on what date is grandma's birthday this year? Reply in YYYY-MM-DD format. (Assume the current year is 2025 and the upcoming birthday has not happened yet.)",
      slug: "family-grandma-birthday",
    },

    // ── Cross-conversation correlation ────────────────────────────────
    {
      answer: "2",
      question:
        "Across all of your joined conversations, in how many distinct conversations has the user with localpart 'maria' (i.e. @maria:fixture.local) sent at least one message? Reply with just the integer.",
      slug: "maria-conversation-count",
    },

    // ── Room identification by content ────────────────────────────────
    {
      answer: "Sam",
      question:
        "Across all of your joined conversations, in which conversation did someone share a Spotify playlist link? Reply with just the conversation's title, exactly as it appears in `list_conversations`.",
      slug: "spotify-link-conversation",
    },
    {
      answer: "Old Friends (WA)",
      question:
        "Across all of your joined conversations, in which conversation does someone ask whether anyone is going to a wedding in October? Reply with just the conversation's title, exactly as it appears in `list_conversations`.",
      slug: "wedding-question-conversation",
    },

    // ── Self-history synthesis ────────────────────────────────────────
    {
      answer: "2025-09-29",
      question:
        "In your direct-message conversation with Mom, you sent a message thanking her for the cake from your birthday. On what date did you send that thank-you message? Reply in YYYY-MM-DD format.",
      slug: "dm-mom-cake-thanks-date",
    },
  ],
  slug: "personal",
};
