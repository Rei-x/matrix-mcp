import { HIRING_FIXTURE } from "../fixture/hiring";
import type { EvalSuite } from "./types";

/**
 * Real-pattern hiring/inbox eval suite.
 *
 * The qa_pairs target the actual workflow of a Polish-speaking founder /
 * hiring manager whose Matrix inbox is a bridged firehose of LinkedIn DMs
 * about an open engineering role at a TechTree-style startup.
 *
 * Workflow categories these questions test:
 *
 *   1. Find a candidate by content (NOT by sender mxid — LinkedIn puppet
 *      ids are opaque hashes; the agent must rely on room titles).
 *   2. Recover the canonical job-application URL the manager sends to all
 *      candidates as the first reply.
 *   3. Track who is in which stage of the funnel: never replied to /
 *      template sent / CV submitted / call scheduled.
 *   4. Multilingual recall — Polish or English depending on the candidate.
 *   5. Calendar coordination — what slot was confirmed.
 *   6. Bridge-noise detection — identify the broken Google Messages bridge
 *      bot that's spamming an identical credential error every ~4 hours.
 *   7. Test-residue identification — find rooms left behind by integration
 *      tests so the manager can leave/forget them.
 *   8. Spam vs real opportunity — a generic "are you interested" recruiter
 *      DM with no role/company is the spam signal.
 *
 * Every answer is verified against `evals/fixture/hiring.ts`.
 */
export const HIRING_SUITE: EvalSuite = {
  description:
    "Real-pattern hiring/inbox workload: triaging bridged LinkedIn candidate DMs (Polish + English), tracking the application funnel, finding broken bridges, and identifying test residue.",
  fixture: HIRING_FIXTURE,
  questions: [
    // ── Funnel triage: who's in which stage ───────────────────────────
    {
      answer: "1",
      question:
        "Across your bridged LinkedIn candidate conversations, in how many of them have you (rei) NEVER sent a single reply — i.e. every message in that LinkedIn conversation is from the candidate's puppet user, none from you? Reply with just the integer. Do not count non-LinkedIn rooms.",
      slug: "hiring-never-replied-linkedin-count",
    },
    {
      answer: "Recruiter (LinkedIn)",
      question:
        "One of your LinkedIn-bridged conversations is generic recruiter spam — no specific company, no specific role, no compensation, just a vague 'are you interested in opportunities' message. What is the title of that conversation, exactly as it appears in `list_conversations`?",
      slug: "hiring-spam-room-title",
    },

    // ── Canonical job-application URL ────────────────────────────────
    {
      answer:
        "https://jobs.techtree.example/job/c0756e12-42d8-4e7c-853e-8ea55e6ac88f",
      question:
        "Across your LinkedIn candidate conversations you reply with a standard template that includes a single job-posting URL on jobs.techtree.example. What is that URL? Reply with just the URL — no surrounding text.",
      slug: "hiring-canonical-job-url",
    },

    // ── Polish-only multilingual recall ───────────────────────────────
    {
      answer: "13 kwietnia",
      question:
        "Find the Polish-language LinkedIn conversation with a candidate who is currently studying CS in the USA and asked to push the intro call back because of semester exams. Which exact date did she propose for the call? Reply with the exact Polish date phrase she used (e.g. 'X kwietnia').",
      slug: "hiring-julia-proposed-date-pl",
    },

    // ── Calendar coordination ─────────────────────────────────────────
    {
      answer: "po 18",
      question:
        "Find the Polish-speaking LinkedIn candidate who couldn't book the daytime calendar slots because his work sprint had just started, and asked to schedule the call after work. What time-of-day constraint did you give him? Reply with the exact short Polish phrase you used in your message.",
      slug: "hiring-karol-after-hours-phrase",
    },
    {
      answer: "Karol Sawicki (LinkedIn)",
      question:
        "Find the LinkedIn conversation where the candidate confirms they have booked themselves into the slot 'na piątek na 15'. What is the title of that conversation, exactly as it appears in `list_conversations`?",
      slug: "hiring-karol-friday-slot-room",
    },

    // ── CV / resume tracking ──────────────────────────────────────────
    {
      answer: "Patricia_Costras_Backend_EU.pdf",
      question:
        "Find the LinkedIn conversation where a candidate sent in a backend-focused Python / FastAPI pitch and attached a resume. What is the exact filename of the attached resume mentioned in the message? Reply with just the filename.",
      slug: "hiring-patricia-cv-filename",
    },

    // ── Stage of funnel: who is currently waiting on US to act ───────
    {
      answer: "2",
      question:
        "Across your LinkedIn candidate conversations, count the conversations that satisfy BOTH of these conditions at the same time: (a) the candidate has already submitted their CV / resume — this counts EITHER if they attached a `.pdf` file with the resume in their message OR if they wrote in plain text that they have just submitted it (e.g. 'I've submitted now', 'wysyłam CV'); AND (b) the very most recent message in the conversation is from the candidate, not from you. Reply with just the integer count of conversations that meet BOTH conditions.",
      slug: "hiring-cv-submitted-awaiting-us",
    },

    // ── Calendar URL retrieval ───────────────────────────────────────
    {
      answer:
        "https://calendar.google.com/appointments/schedules/AcZssZ_demo_slot_picker",
      question:
        "In one of the LinkedIn conversations you forward a Google Calendar appointment-booking URL because the candidate should book a slot directly with the CTO. What is that URL? Reply with just the URL.",
      slug: "hiring-cto-calendar-url",
    },

    // ── Broken bridge detection ──────────────────────────────────────
    {
      answer: "BAD_CREDENTIALS",
      question:
        "One of the bridge-bot rooms in your inbox is repeatedly sending an identical machine-generated error message every few hours and contains nothing else. What is the exact uppercase error code that appears in every one of those error messages? Reply with just the error code.",
      slug: "hiring-broken-bridge-error-code",
    },
    {
      answer: "Google Messages bridge bot",
      question:
        "Which room in your inbox is exclusively a broken bridge bot spamming the same `BAD_CREDENTIALS` error message every few hours, with NO real human conversation in it? Reply with just the room title, exactly as it appears in `list_conversations`.",
      slug: "hiring-broken-bridge-room",
    },

    // ── Test residue (matrix-mcp's own integration tests) ────────────
    {
      answer: "1",
      question:
        "Some rooms in your inbox were left behind by integration tests for the matrix-mcp project itself. How many distinct conversations in your joined room list have a `title` field that begins with the literal string `matrix-mcp test` (not just any room — only ones whose title starts with that exact prefix)? Reply with just the integer count of matching conversations.",
      slug: "hiring-test-residue-count",
    },
  ],
  slug: "hiring",
};
