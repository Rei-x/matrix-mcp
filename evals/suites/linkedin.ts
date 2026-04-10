import { LINKEDIN_FIXTURE } from "../fixture/linkedin";
import type { EvalSuite } from "./types";

/**
 * LinkedIn-on-Matrix eval suite.
 *
 * The qa_pairs target the realistic workflow of replying to LinkedIn DMs that
 * have been bridged into Matrix (via mautrix-linkedin or similar):
 *
 *   - triage who needs a reply vs who's been ghosted
 *   - extract concrete offer details (role, company, salary, equity)
 *   - compare comp across recruiters
 *   - find every CV/resume request that needs to be fulfilled
 *   - distinguish a real opportunity from generic recruiter spam
 *   - identify the polite-decline you already sent and which company it was for
 *   - separate networking messages from job-hunt messages
 *
 * Every answer was verified by hand against `evals/fixture/linkedin.ts` and is
 * stable as long as the fixture doesn't change.
 */
export const LINKEDIN_SUITE: EvalSuite = {
  description:
    "LinkedIn-on-Matrix workload: replying to recruiters, fulfilling CV requests, comparing offers across cold-reach DMs, and triaging spam vs real opportunities.",
  fixture: LINKEDIN_FIXTURE,
  questions: [
    // ── Compensation comparison ───────────────────────────────────────
    {
      answer: "Priya Patel",
      question:
        "Across all of your LinkedIn conversations that mention a base salary in US dollars, which recruiter offered the highest base salary number? Reply with the recruiter's full name (first and last), exactly as it appears in their message.",
      slug: "highest-base-salary-recruiter",
    },
    {
      answer: "$250k",
      question:
        "Across all of your LinkedIn conversations, what is the highest base salary number explicitly stated in any single message? Reply with just that number including any currency symbol or letter, exactly as it appears in the message (e.g. '$120k', '€110k').",
      slug: "highest-base-salary-amount",
    },

    // ── CV request triage ─────────────────────────────────────────────
    {
      answer: "3",
      question:
        "Across all of your LinkedIn conversations, in how many distinct conversations does the other person explicitly ask you to send your CV or resume? Reply with just the integer.",
      slug: "cv-request-count",
    },

    // ── Role / company identification ─────────────────────────────────
    {
      answer: "Stripe",
      question:
        "In which company is a recruiter on LinkedIn pitching a Staff Engineer position? Reply with just the company name.",
      slug: "staff-engineer-company",
    },
    {
      answer: "$220k",
      question:
        "Find the LinkedIn conversation about a Senior Backend Engineer role on a Payments team. What is the high end of the base salary range mentioned for that role? Reply with just the number including the currency symbol, exactly as it appears in the message.",
      slug: "senior-backend-payments-base-high",
    },

    // ── Founder cold reach (equity instead of salary) ────────────────
    {
      answer: "1-3%",
      question:
        "On LinkedIn, a startup founder reached out to you about a CTO / founding engineer role. What is the equity percentage range mentioned in their message? Reply exactly as it appears (e.g. '1-3%').",
      slug: "founder-equity-range",
    },

    // ── Triage: who needs a response ──────────────────────────────────
    {
      answer: "3",
      question:
        "Across all of your LinkedIn conversations, in how many conversations have you (Rei) never sent a single reply — i.e. every message in the conversation is from the other person and none from you? Reply with just the integer.",
      slug: "never-replied-count",
    },

    // ── Decline tracking ──────────────────────────────────────────────
    {
      answer: "Klarna",
      question:
        "Find the LinkedIn conversation where you politely declined the role specifically because it was about payments. Which company was the recruiter recruiting for? Reply with just the company name.",
      slug: "declined-payments-company",
    },

    // ── Networking vs recruiting ──────────────────────────────────────
    {
      answer: "Tom Wilson",
      question:
        "One of your LinkedIn conversations is from someone who is NOT a recruiter pitching a job — they're an old contact reaching out to catch up and asking to introduce you to a friend. What is that person's full name (first and last)?",
      slug: "non-recruiter-contact-name",
    },
    {
      answer: "Marcia",
      question:
        "In one of your LinkedIn conversations, the other person asks if they can introduce you to a friend who is starting a search for a senior engineering role. What is the first name of the friend they want to introduce you to?",
      slug: "intro-friend-first-name",
    },

    // ── Spam detection ────────────────────────────────────────────────
    {
      answer: "Recruiter (LinkedIn)",
      question:
        "One of your LinkedIn conversations is generic recruiter spam — no specific company, no specific role, and no compensation details, just a vague 'are you interested in opportunities' message. What is the title of that conversation, exactly as it appears in `list_conversations`?",
      slug: "spam-conversation-title",
    },

    // ── Concrete recall: scheduling ───────────────────────────────────
    {
      answer: "Wednesday at 4:30pm",
      question:
        "In your LinkedIn conversation with Sarah Chen, what specific time slot did Sarah ultimately confirm for the intro call? Reply exactly as Sarah wrote it (e.g. 'Wednesday at 4:30pm').",
      slug: "sarah-confirmed-call-time",
    },
  ],
  slug: "linkedin",
};
