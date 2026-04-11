/**
 * Real-pattern hiring/inbox eval fixture.
 *
 * Modelled directly on the patterns observed in a real Polish-speaking
 * founder/hiring-manager's Matrix inbox (read via the matrix-mcp before
 * authoring the suite). The CONTENT is fabricated, but every structural
 * pattern is real:
 *
 *  1. LinkedIn DMs are bridged via mautrix-linkedin. Each thread is its own
 *     room, named after the candidate (the only readable identifier). The
 *     puppet sender mxid is an OPAQUE hash like `@linkedin__a_co_a_a_xyz...`,
 *     so the agent has to identify candidates by ROOM TITLE, not sender id.
 *  2. The hiring manager (rei) replies in a mix of Polish and English in the
 *     same thread depending on the candidate's preferred language.
 *  3. Replies follow a templated pattern: thank → ask for CV via a job link
 *     → confirm receipt → send a Google Calendar appointment link.
 *  4. Some candidates send strong, multi-paragraph pitches; others send
 *     two-line requests; one is generic recruiter-style spam.
 *  5. The Google Messages bridge is broken — its bot spams an identical
 *     `BAD_CREDENTIALS` error every ~4 hours. Real noise.
 *  6. There's residue from this very project's integration tests cluttering
 *     the inbox: rooms named `matrix-mcp test <timestamp>-<slug>`.
 *  7. There's a Polish friend group chat with casual, lowercase messages.
 *
 * Frozen timestamps (early April 2026) keep qa_pair answers stable.
 */

import type { Fixture, FixtureRoom } from "./types";
import { tsOf as ts } from "./types";

export const HIRING_USER_ID = "@rei:fixture.local";

const ME = HIRING_USER_ID;

// LinkedIn puppet senders use the real mautrix-linkedin format: an opaque
// hash that the agent should NOT try to read as a name.
const JULIA =
  "@linkedin__a_co_a_a_e_f_sfn_u_bqv34m_f_g9_v_p_pm_uhj:fixture.local";
const AHMED =
  "@linkedin__a_co_a_a_g_u0_f_h8_bc_i_b4k5ofd_z3x5t_iw_es:fixture.local";
const PATRICIA =
  "@linkedin__a_co_a_a_dts_p_jw_bhwb_mrl61_es_k_t_viaw_xu:fixture.local";
const KAROL =
  "@linkedin__a_co_a_a_c_m_s_y1w_b5i4yre_ghpeyl7_om_dd_r5_n:fixture.local";
const SPAM_RECRUITER =
  "@linkedin__a_co_a_a_zz_zzz_zzz_zzz_zzz_zzz_zzz_zzz_zzz:fixture.local";
const ANTONI = "@antoni:fixture.local";
const KUBA = "@kuba:fixture.local";
const ALA = "@ala:fixture.local";
const GMSGSBOT = "@gmessagesbot:fixture.local";

const LINKEDIN_TOPIC = "Bridged from LinkedIn via mautrix-linkedin.";
const TECHTREE_JOB_URL =
  "https://jobs.techtree.example/job/c0756e12-42d8-4e7c-853e-8ea55e6ac88f";
const CALENDAR_URL =
  "https://calendar.google.com/appointments/schedules/AcZssZ_demo_slot_picker";

const ROOMS: FixtureRoom[] = [
  // ─────────────────────────────────────────────────────────────────────
  // 1. STRONG candidate, Polish, with substantial pitch + asks for chat.
  //    Hiring manager engages, eventually sends a calendar link.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "Hej Bartek, mam Twój LinkedIn na oku już od jakiegoś czasu. Studiuję CS w USA, ale planuję powrót do Europy. Pracuję full-stacku od 4+ lat (Python, React, TypeScript, FastAPI, PostgreSQL, plus Next.js i AWS). Prowadzę research na uczelni z RL w pojazdach autonomicznych, a na boku robię side projekty (Sauté — consumer AI, Runwave — fintech dashboard skończony w 24h). Załączam CV. Daj znać czy widzisz fit :)",
        event_id: "$evt-li-julia-1:fixture.local",
        origin_server_ts: ts("2026-04-07T12:41:00Z"),
        sender: JULIA,
      },
      {
        body: "impressive background muszę przyznać, ciekawi mnie w czym czujesz się najlepsza? bo widzę dużo doświadczenia w zróżnicowanych obszarach",
        event_id: "$evt-li-julia-2:fixture.local",
        origin_server_ts: ts("2026-04-07T12:48:00Z"),
        sender: ME,
      },
      {
        body: "Product engineering — budowanie funkcjonalności end-to-end, szczególnie z naciskiem na UX/UI. Większość moich staży była backendowa (Amazon, Tryp), ale najbardziej cieszą mnie projekty gdzie mogę robić jednocześnie strukturę bazy danych i estetyczny interfejs. Tl;dr: najbardziej widzę się w funkcjach opartych na danych e2e :)",
        event_id: "$evt-li-julia-3:fixture.local",
        origin_server_ts: ts("2026-04-07T13:43:00Z"),
        sender: JULIA,
      },
      {
        body: "no to bardzo mnie cieszy, dokładnie takiej osoby szukamy. powinnaś dostać maila z linkiem do zabookowania godzinki ze mną",
        event_id: "$evt-li-julia-4:fixture.local",
        origin_server_ts: ts("2026-04-08T08:52:00Z"),
        sender: ME,
      },
      {
        body: `tutaj masz kalendarzyk bezpośrednio do CTO, bo chciałby z Tobą pogadać: ${CALENDAR_URL}`,
        event_id: "$evt-li-julia-5:fixture.local",
        origin_server_ts: ts("2026-04-08T10:06:00Z"),
        sender: ME,
      },
      {
        body: "Hej, wybacz późną odpowiedź — egzaminy semestralne. Pasowałby Wam 13 kwietnia? Wolałabym moc skupić się na rozmowie z Wami, mając już wolną głowę :)",
        event_id: "$evt-li-julia-6:fixture.local",
        origin_server_ts: ts("2026-04-09T00:36:00Z"),
        sender: JULIA,
      },
      {
        body: "jak najbardziej przyszły tydzień nam odpowiada, zależy nam żeby znaleźć kogoś naprawdę dobrego. życzę powodzenia na egzaminach!!",
        event_id: "$evt-li-julia-7:fixture.local",
        origin_server_ts: ts("2026-04-09T07:13:00Z"),
        sender: ME,
      },
    ],
    name: "Julia Zdziechowska (LinkedIn)",
    room_id: "!linkedin-julia:fixture.local",
    topic: LINKEDIN_TOPIC,
  },

  // ─────────────────────────────────────────────────────────────────────
  // 2. English-speaking applicant. Sent the standard reply template, then
  //    they submitted CV. Currently waiting on us.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "Hi Bartosz, I am a member of the TechTree network here helping engineers find work. I'm in the UK now, eligible to work in Poland as well, and ready to start on tasks immediately. Salary-wise I'm flexible. Let's have a quick talk soon? — A",
        event_id: "$evt-li-ahmed-1:fixture.local",
        origin_server_ts: ts("2026-04-07T10:23:00Z"),
        sender: AHMED,
      },
      {
        body: `Hi Ahmed,\n\nThanks for reaching out, and good to hear from someone already in the TechTree network.\n\nTo put you in the same flow as the other applicants, could you send over your CV and a short note describing your relevant experience based on the job post? Details here: ${TECHTREE_JOB_URL}\n\nBartek`,
        event_id: "$evt-li-ahmed-2:fixture.local",
        origin_server_ts: ts("2026-04-08T08:02:00Z"),
        sender: ME,
      },
      {
        body: "Hello Bartosz, sure will do shortly. — A",
        event_id: "$evt-li-ahmed-3:fixture.local",
        origin_server_ts: ts("2026-04-08T08:25:00Z"),
        sender: AHMED,
      },
      {
        body: "Hello Bartosz, I've submitted now. Can't wait to join your team and contribute here. I am also available anytime to discuss everything in detail. Have a great day ahead — A",
        event_id: "$evt-li-ahmed-4:fixture.local",
        origin_server_ts: ts("2026-04-08T11:24:00Z"),
        sender: AHMED,
      },
    ],
    name: "Ahmed Fahmy (LinkedIn)",
    room_id: "!linkedin-ahmed:fixture.local",
    topic: LINKEDIN_TOPIC,
  },

  // ─────────────────────────────────────────────────────────────────────
  // 3. English candidate who already submitted CV, you acknowledged, and
  //    they thanked you. CLOSED LOOP — no action needed from us.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "Hello, is this still available? I'm interested. Please let me know if there is anything I can do.",
        event_id: "$evt-li-pat-1:fixture.local",
        origin_server_ts: ts("2026-04-07T21:38:00Z"),
        sender: PATRICIA,
      },
      {
        body: `Hi Patricia,\n\nYes, the role is still open.\n\nCould you share your CV and a short note describing your relevant experience based on the job post? Details here: ${TECHTREE_JOB_URL}\n\nBartek`,
        event_id: "$evt-li-pat-2:fixture.local",
        origin_server_ts: ts("2026-04-08T07:59:00Z"),
        sender: ME,
      },
      {
        body: "I'm a backend-focused Python engineer with production experience using FastAPI. At my last role I implemented RESTful APIs end-to-end, owned the routing/services/data layer, and optimised database performance using SQLAlchemy and Alembic. I worked on JWT/OAuth2 auth, async endpoints, and Docker + CI/CD pipelines. Patricia_Costras_Backend_EU.pdf",
        event_id: "$evt-li-pat-3:fixture.local",
        origin_server_ts: ts("2026-04-08T13:43:00Z"),
        sender: PATRICIA,
      },
      {
        body: "Hi Patricia, thanks for the CV and the writeup. Your application is being processed and I'll get back to you within a week. — Bartek",
        event_id: "$evt-li-pat-4:fixture.local",
        origin_server_ts: ts("2026-04-08T15:22:00Z"),
        sender: ME,
      },
      {
        body: "Thank you so much!",
        event_id: "$evt-li-pat-5:fixture.local",
        origin_server_ts: ts("2026-04-08T19:56:00Z"),
        sender: PATRICIA,
      },
    ],
    name: "Patricia Costras (LinkedIn)",
    room_id: "!linkedin-patricia:fixture.local",
    topic: LINKEDIN_TOPIC,
  },

  // ─────────────────────────────────────────────────────────────────────
  // 4. Polish candidate, already sent CV, scheduling call after-hours.
  //    Confirmed final slot.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "wysyłam CV i czekam na Twoją wiadomość :)",
        event_id: "$evt-li-karol-1:fixture.local",
        origin_server_ts: ts("2026-04-07T16:52:00Z"),
        sender: KAROL,
      },
      {
        body: "powinieneś dostać zaproszenie na maila by umówić spotkanko ze mną",
        event_id: "$evt-li-karol-2:fixture.local",
        origin_server_ts: ts("2026-04-08T08:50:00Z"),
        sender: ME,
      },
      {
        body: "Hej, dostałem maila, dzięki! Umówię się prawdopodobnie do końca dnia. Masz tylko terminy w ciągu dnia i muszę ogarnąć kiedy nie będę miał spotkań — akurat nowy sprint się zaczął.",
        event_id: "$evt-li-karol-3:fixture.local",
        origin_server_ts: ts("2026-04-08T10:54:00Z"),
        sender: KAROL,
      },
      {
        body: "jak chcesz to możemy coś ogarnąć po pracy, ale to dopiero next week wtedy",
        event_id: "$evt-li-karol-4:fixture.local",
        origin_server_ts: ts("2026-04-08T12:36:00Z"),
        sender: ME,
      },
      {
        body: "Po pracy, to jakie godziny masz na myśli?",
        event_id: "$evt-li-karol-5:fixture.local",
        origin_server_ts: ts("2026-04-08T12:37:00Z"),
        sender: KAROL,
      },
      {
        body: "po 18",
        event_id: "$evt-li-karol-6:fixture.local",
        origin_server_ts: ts("2026-04-08T12:39:00Z"),
        sender: ME,
      },
      {
        body: "Hej, zapisałem się na piątek na 15, do zobaczenia!",
        event_id: "$evt-li-karol-7:fixture.local",
        origin_server_ts: ts("2026-04-08T19:53:00Z"),
        sender: KAROL,
      },
      {
        body: "ooo super, do zobaczenia!!",
        event_id: "$evt-li-karol-8:fixture.local",
        origin_server_ts: ts("2026-04-08T22:48:00Z"),
        sender: ME,
      },
    ],
    name: "Karol Sawicki (LinkedIn)",
    room_id: "!linkedin-karol:fixture.local",
    topic: LINKEDIN_TOPIC,
  },

  // ─────────────────────────────────────────────────────────────────────
  // 5. Generic recruiter-style spam. No specific role, no comp, no fit.
  //    No reply from us. Currently being ghosted on purpose.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "Hi! Are you open to new opportunities? I have several roles that might interest you. Reply YES for more info.",
        event_id: "$evt-li-spam-1:fixture.local",
        origin_server_ts: ts("2026-04-06T03:14:00Z"),
        sender: SPAM_RECRUITER,
      },
      {
        body: "Just bumping this — let me know if you're interested!",
        event_id: "$evt-li-spam-2:fixture.local",
        origin_server_ts: ts("2026-04-08T02:30:00Z"),
        sender: SPAM_RECRUITER,
      },
    ],
    name: "Recruiter (LinkedIn)",
    room_id: "!linkedin-spam:fixture.local",
    topic: LINKEDIN_TOPIC,
  },

  // ─────────────────────────────────────────────────────────────────────
  // 6. Polish friend / collaborator 1:1, casual lowercase Polish.
  //    Mix of plans, work talk, memes.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "Chcecie wbić 24 na urodziniki?",
        event_id: "$evt-ant-1:fixture.local",
        origin_server_ts: ts("2026-04-08T22:09:00Z"),
        sender: ANTONI,
      },
      {
        body: "ooo zapytam się aluni",
        event_id: "$evt-ant-2:fixture.local",
        origin_server_ts: ts("2026-04-08T22:46:00Z"),
        sender: ME,
      },
      {
        body: "powiedziała że pewnie",
        event_id: "$evt-ant-3:fixture.local",
        origin_server_ts: ts("2026-04-10T16:01:00Z"),
        sender: ME,
      },
      {
        body: "Ja dzisiaj idę do roboty i się okazuje że na jednej apce tailwinda wyjebałem xdd",
        event_id: "$evt-ant-4:fixture.local",
        origin_server_ts: ts("2026-04-10T17:45:00Z"),
        sender: ANTONI,
      },
      {
        body: "XDDDD mocarne",
        event_id: "$evt-ant-5:fixture.local",
        origin_server_ts: ts("2026-04-10T17:45:30Z"),
        sender: ME,
      },
    ],
    name: "Antoni Czaplicki",
    room_id: "!dm-antoni:fixture.local",
    topic: null,
  },

  // ─────────────────────────────────────────────────────────────────────
  // 7. Polish student-org group chat coordinating an event for elderly
  //    people on AI ("Wiosenny Puls Seniora"). Bilingual + collaborative.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "No właśnie chciałam napisać „AI dla każdego” ale miałam takie czy to jest bardzo ogólne i czy to kogoś zachęci xd",
        event_id: "$evt-grp-1:fixture.local",
        origin_server_ts: ts("2026-04-08T11:03:00Z"),
        sender: ALA,
      },
      {
        body: 'moze takie cos: "Sztuczna inteligencja bez stresu – jak z niej korzystać?"',
        event_id: "$evt-grp-2:fixture.local",
        origin_server_ts: ts("2026-04-08T12:31:00Z"),
        sender: ALA,
      },
      {
        body: "Git",
        event_id: "$evt-grp-3:fixture.local",
        origin_server_ts: ts("2026-04-08T12:37:00Z"),
        sender: KUBA,
      },
      {
        body: "Moi drodzy, już jesteśmy w artykule :)) https://gazetawroclawska.example/wiosenny-puls-seniora-forum-15-kwietnia",
        event_id: "$evt-grp-4:fixture.local",
        origin_server_ts: ts("2026-04-08T14:51:00Z"),
        sender: ALA,
      },
      {
        body: "spoko, ja sie zajme kartkami. do prezki pewnie będę mógł siąść dopiero piątek/niedziela",
        event_id: "$evt-grp-5:fixture.local",
        origin_server_ts: ts("2026-04-09T08:53:00Z"),
        sender: ME,
      },
      {
        body: "Generalnie podeślę wam link do prezki do 15:00, bo muszę do domu wrócić najpierw",
        event_id: "$evt-grp-6:fixture.local",
        origin_server_ts: ts("2026-04-10T10:01:00Z"),
        sender: ALA,
      },
      {
        body: "https://canva.example/design/seniorzy-ai-prezka-2026",
        event_id: "$evt-grp-7:fixture.local",
        origin_server_ts: ts("2026-04-10T13:15:00Z"),
        sender: ALA,
      },
      {
        body: "dajcie mi znac czy mozecie ją edytować",
        event_id: "$evt-grp-8:fixture.local",
        origin_server_ts: ts("2026-04-10T13:16:00Z"),
        sender: ALA,
      },
    ],
    name: "Seniorzy + AI + Solvro",
    room_id: "!grp-seniorzy:fixture.local",
    topic: "Przygotowania do prezki na Wiosenny Puls Seniora 15.04",
  },

  // ─────────────────────────────────────────────────────────────────────
  // 8. The broken Google Messages bridge: same BAD_CREDENTIALS error every
  //    ~4 hours, totally noise. The agent should be able to identify this
  //    as a broken bridge that's spamming, NOT real conversation.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "State update for `+48-XXXXXXXXX`: `BAD_CREDENTIALS` (`gm-phone-not-responding`): Your Google Messages app is not responding. Open the Google Messages app on your phone, ensure messages send, and battery optimization is off. If needed, remove and re-add the connection.",
        event_id: "$evt-gm-1:fixture.local",
        origin_server_ts: ts("2026-04-09T01:03:00Z"),
        sender: GMSGSBOT,
      },
      {
        body: "State update for `+48-XXXXXXXXX`: `BAD_CREDENTIALS` (`gm-phone-not-responding`): Your Google Messages app is not responding. Open the Google Messages app on your phone, ensure messages send, and battery optimization is off. If needed, remove and re-add the connection.",
        event_id: "$evt-gm-2:fixture.local",
        origin_server_ts: ts("2026-04-09T05:02:00Z"),
        sender: GMSGSBOT,
      },
      {
        body: "State update for `+48-XXXXXXXXX`: `BAD_CREDENTIALS` (`gm-phone-not-responding`): Your Google Messages app is not responding. Open the Google Messages app on your phone, ensure messages send, and battery optimization is off. If needed, remove and re-add the connection.",
        event_id: "$evt-gm-3:fixture.local",
        origin_server_ts: ts("2026-04-09T09:02:00Z"),
        sender: GMSGSBOT,
      },
      {
        body: "State update for `+48-XXXXXXXXX`: `BAD_CREDENTIALS` (`gm-phone-not-responding`): Your Google Messages app is not responding. Open the Google Messages app on your phone, ensure messages send, and battery optimization is off. If needed, remove and re-add the connection.",
        event_id: "$evt-gm-4:fixture.local",
        origin_server_ts: ts("2026-04-09T13:02:00Z"),
        sender: GMSGSBOT,
      },
      {
        body: "State update for `+48-XXXXXXXXX`: `BAD_CREDENTIALS` (`gm-phone-not-responding`): Your Google Messages app is not responding. Open the Google Messages app on your phone, ensure messages send, and battery optimization is off. If needed, remove and re-add the connection.",
        event_id: "$evt-gm-5:fixture.local",
        origin_server_ts: ts("2026-04-09T17:02:00Z"),
        sender: GMSGSBOT,
      },
      {
        body: "State update for `+48-XXXXXXXXX`: `BAD_CREDENTIALS` (`gm-phone-not-responding`): Your Google Messages app is not responding. Open the Google Messages app on your phone, ensure messages send, and battery optimization is off. If needed, remove and re-add the connection.",
        event_id: "$evt-gm-6:fixture.local",
        origin_server_ts: ts("2026-04-09T21:02:00Z"),
        sender: GMSGSBOT,
      },
      {
        body: "State update for `+48-XXXXXXXXX`: `BAD_CREDENTIALS` (`gm-phone-not-responding`): Your Google Messages app is not responding. Open the Google Messages app on your phone, ensure messages send, and battery optimization is off. If needed, remove and re-add the connection.",
        event_id: "$evt-gm-7:fixture.local",
        origin_server_ts: ts("2026-04-10T01:03:00Z"),
        sender: GMSGSBOT,
      },
    ],
    name: "Google Messages bridge bot",
    room_id: "!gmsgs-bot:fixture.local",
    topic: "mautrix-gmessages bridge bot status room",
  },

  // ─────────────────────────────────────────────────────────────────────
  // 9. Test residue from this very project — clutter the agent should be
  //    able to identify and offer to clean up.
  // ─────────────────────────────────────────────────────────────────────
  {
    messages: [
      {
        body: "matrix-mcp integration test room (seed message)",
        event_id: "$evt-test-1:fixture.local",
        origin_server_ts: ts("2026-04-10T19:29:00Z"),
        sender: ME,
      },
      {
        body: "Hello from MCP integration test!",
        event_id: "$evt-test-2:fixture.local",
        origin_server_ts: ts("2026-04-10T19:29:30Z"),
        sender: ME,
      },
      {
        body: "Original for reply test",
        event_id: "$evt-test-3:fixture.local",
        origin_server_ts: ts("2026-04-10T19:29:45Z"),
        sender: ME,
      },
      {
        body: "Thread reply body",
        event_id: "$evt-test-4:fixture.local",
        origin_server_ts: ts("2026-04-10T19:30:00Z"),
        sender: ME,
      },
    ],
    name: "matrix-mcp test 1775849349554-z582hha",
    room_id: "!test-residue-1:fixture.local",
    topic: null,
  },
];

export const HIRING_FIXTURE: Fixture = {
  rooms: ROOMS,
  user_id: HIRING_USER_ID,
};
