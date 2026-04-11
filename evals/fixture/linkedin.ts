/**
 * LinkedIn-bridge eval fixture.
 *
 * Models the way LinkedIn DMs typically appear when bridged into Matrix via
 * a puppeting bridge such as mautrix-linkedin: each LinkedIn DM thread is its
 * own Matrix room and each LinkedIn user becomes a puppet mxid of the form
 * `@linkedin_<slug>:fixture.local`. The room name is set to the puppet's
 * display name so it shows up sensibly in `list_conversations`.
 *
 * The seven rooms cover the typical real-world LinkedIn workload:
 *
 *   1. Senior Backend Eng @ Acme — recruiter with a clear comp range and a
 *      CV request, where I replied and we agreed on a slot.
 *   2. Staff Eng @ Stripe — vague-comp cold reach + CV ask, no reply yet.
 *   3. Senior SWE @ Google — concrete comp + CV ask + I politely declined
 *      because I'm not actively looking.
 *   4. Founder cold reach about a CTO/founding-eng role with explicit
 *      equity range, no reply.
 *   5. Backend Eng @ Klarna in payments — I declined because of the domain.
 *   6. Old colleague catching up + asking to introduce me to a friend
 *      (NOT a recruiter — networking, not job hunting).
 *   7. Generic recruiter spam — no role, no company, no comp, no signal.
 *
 * Timestamps are frozen in mid-to-late September 2025 so qa_pair answers
 * stay stable across runs.
 */

import type { Fixture, FixtureRoom } from "./types";
import { tsOf as ts } from "./types";

export const LINKEDIN_USER_ID = "@rei:fixture.local";

const ME = LINKEDIN_USER_ID;
// Real mautrix-linkedin puppet ids are opaque base64-ish hashes, NOT readable
// names. The agent must identify each candidate by the ROOM TITLE (which the
// bridge sets to the LinkedIn display name), never by the sender mxid.
const SARAH =
  "@linkedin__a_co_a_a_sc_p4xq_b8m_lv9k_jr2_t_y_n_h7w_uvz_qf:fixture.local";
const MARCUS =
  "@linkedin__a_co_a_a_md_b3kx_q9p_mz7r_w_t_v_h_n2_j8u_lcy_pe:fixture.local";
const PRIYA =
  "@linkedin__a_co_a_a_pp_g7yn_h2k_lq8x_v_w_b_m_r5_z9j_xch_kt:fixture.local";
const JAMES =
  "@linkedin__a_co_a_a_jo_t9rb_w4x_kn3y_p_h_f_l_q8_z2v_ydj_mp:fixture.local";
const ANNA =
  "@linkedin__a_co_a_a_al_k4mp_z8j_xw5n_b_y_v_q_h7_r3l_ufc_te:fixture.local";
const TOM =
  "@linkedin__a_co_a_a_tw_n7vh_b3x_kp9q_z_l_w_y_m4_r8j_dft_xc:fixture.local";
const SPAM =
  "@linkedin__a_co_a_a_zz_zzzz_zzz_zzzz_z_z_z_z_zz_zzz_zzz_zz:fixture.local";

const BRIDGED_TOPIC = "Bridged from LinkedIn via mautrix-linkedin.";

const ROOMS: FixtureRoom[] = [
  {
    messages: [
      {
        body: "Hi Rei! I'm Sarah, Senior Recruiter at Acme Corp. I came across your profile and I think you'd be a strong fit for our Senior Backend Engineer role on the Payments team. The base salary range is $180k-$220k base + equity. Would you be open to a 30-min intro call this week?",
        event_id: "$evt-li-sarah-1:fixture.local",
        origin_server_ts: ts("2025-09-22T10:15:00Z"),
        sender: SARAH,
      },
      {
        body: "Also, could you send me your latest CV when you get a chance?",
        event_id: "$evt-li-sarah-2:fixture.local",
        origin_server_ts: ts("2025-09-22T10:18:00Z"),
        sender: SARAH,
      },
      {
        body: "Hi Sarah, thanks for reaching out. I'd be interested to learn more — Wednesday after 4pm or Thursday morning both work for me.",
        event_id: "$evt-li-sarah-3:fixture.local",
        origin_server_ts: ts("2025-09-23T09:30:00Z"),
        sender: ME,
      },
      {
        body: "I'll send the CV today.",
        event_id: "$evt-li-sarah-4:fixture.local",
        origin_server_ts: ts("2025-09-23T09:31:00Z"),
        sender: ME,
      },
      {
        body: "Wednesday at 4:30pm works! I'll send a calendar invite. Looking forward to it.",
        event_id: "$evt-li-sarah-5:fixture.local",
        origin_server_ts: ts("2025-09-23T14:00:00Z"),
        sender: SARAH,
      },
    ],
    name: "Sarah Chen (LinkedIn)",
    room_id: "!linkedin-sarah-chen:fixture.local",
    topic: BRIDGED_TOPIC,
  },
  {
    messages: [
      {
        body: "Hey Rei, hope you're doing well. I'm reaching out about a Staff Engineer position on Stripe's Connect platform. We're scaling fast and the comp package is competitive (base + significant equity). Would you be open to a 30-min chat?",
        event_id: "$evt-li-marcus-1:fixture.local",
        origin_server_ts: ts("2025-09-19T16:30:00Z"),
        sender: MARCUS,
      },
      {
        body: "Also, if you have a moment, would you mind sharing your latest resume so I can pass it along to the hiring manager?",
        event_id: "$evt-li-marcus-2:fixture.local",
        origin_server_ts: ts("2025-09-20T11:00:00Z"),
        sender: MARCUS,
      },
      {
        body: "Hi Rei, just bumping this — let me know if you'd like to chat or if it's not the right time.",
        event_id: "$evt-li-marcus-3:fixture.local",
        origin_server_ts: ts("2025-09-25T09:00:00Z"),
        sender: MARCUS,
      },
    ],
    name: "Marcus Davies (LinkedIn)",
    room_id: "!linkedin-marcus-davies:fixture.local",
    topic: BRIDGED_TOPIC,
  },
  {
    messages: [
      {
        body: "Hi Rei, I'm Priya from Google's recruiting team. I noticed your background in distributed systems and I have you in mind for an L5 Senior Software Engineer role on the Cloud Spanner team. Total comp is around $250k base + $80k bonus + equity. Are you open to exploring?",
        event_id: "$evt-li-priya-1:fixture.local",
        origin_server_ts: ts("2025-09-18T14:00:00Z"),
        sender: PRIYA,
      },
      {
        body: "Could you send me your CV so I can route it to the hiring manager?",
        event_id: "$evt-li-priya-2:fixture.local",
        origin_server_ts: ts("2025-09-18T14:02:00Z"),
        sender: PRIYA,
      },
      {
        body: "Hi Priya, I appreciate the outreach but I'm not actively looking right now. Let's stay in touch though.",
        event_id: "$evt-li-priya-3:fixture.local",
        origin_server_ts: ts("2025-09-19T10:00:00Z"),
        sender: ME,
      },
      {
        body: "Totally understand — I'll keep you on file. Thanks for the quick response!",
        event_id: "$evt-li-priya-4:fixture.local",
        origin_server_ts: ts("2025-09-19T10:05:00Z"),
        sender: PRIYA,
      },
    ],
    name: "Priya Patel (LinkedIn)",
    room_id: "!linkedin-priya-patel:fixture.local",
    topic: BRIDGED_TOPIC,
  },
  {
    messages: [
      {
        body: "Rei — long shot here, but I'm building something in the climate / energy space and looking for a founding engineer / CTO. We're pre-seed but already have serious LOIs from two enterprise customers. Salary would be modest ($120k) but equity is meaningful (1-3%). Would love to chat if you're curious.",
        event_id: "$evt-li-james-1:fixture.local",
        origin_server_ts: ts("2025-09-17T22:00:00Z"),
        sender: JAMES,
      },
      {
        body: "Hey, just bumping this in case it got buried — no pressure at all.",
        event_id: "$evt-li-james-2:fixture.local",
        origin_server_ts: ts("2025-09-24T18:00:00Z"),
        sender: JAMES,
      },
    ],
    name: "James O'Brien (LinkedIn)",
    room_id: "!linkedin-james-obrien:fixture.local",
    topic: BRIDGED_TOPIC,
  },
  {
    messages: [
      {
        body: "Hi Rei! We have a Backend Engineer opening at Klarna on the Payments Risk team. Comp is EUR 95k-110k base + bonus. Stockholm or remote within EU. Would you be interested in a quick chat?",
        event_id: "$evt-li-anna-1:fixture.local",
        origin_server_ts: ts("2025-09-15T11:00:00Z"),
        sender: ANNA,
      },
      {
        body: "Hi Anna, thanks for reaching out, but I'm not looking to move to a payments role at the moment. Best of luck with the search!",
        event_id: "$evt-li-anna-2:fixture.local",
        origin_server_ts: ts("2025-09-16T13:00:00Z"),
        sender: ME,
      },
      {
        body: "Thanks for the quick reply — I'll keep you in mind for future roles outside payments.",
        event_id: "$evt-li-anna-3:fixture.local",
        origin_server_ts: ts("2025-09-16T13:02:00Z"),
        sender: ANNA,
      },
    ],
    name: "Anna Lindqvist (LinkedIn)",
    room_id: "!linkedin-anna-lindqvist:fixture.local",
    topic: BRIDGED_TOPIC,
  },
  {
    messages: [
      {
        body: "Hey Rei, long time! Saw you posted about your new project — looks great. Would love to catch up sometime. Are you in the city next month?",
        event_id: "$evt-li-tom-1:fixture.local",
        origin_server_ts: ts("2025-09-21T19:00:00Z"),
        sender: TOM,
      },
      {
        body: "Tom! Yes, in town all of October. Coffee?",
        event_id: "$evt-li-tom-2:fixture.local",
        origin_server_ts: ts("2025-09-22T08:00:00Z"),
        sender: ME,
      },
      {
        body: "Definitely. Also — totally separate thing — my friend Marcia is starting a search for a senior eng role and I think she'd love your perspective. Can I introduce you over email?",
        event_id: "$evt-li-tom-3:fixture.local",
        origin_server_ts: ts("2025-09-22T08:30:00Z"),
        sender: TOM,
      },
    ],
    name: "Tom Wilson (LinkedIn)",
    room_id: "!linkedin-tom-wilson:fixture.local",
    topic: BRIDGED_TOPIC,
  },
  {
    messages: [
      {
        body: "Hi! Are you interested in new opportunities? I have several roles that might interest you. Reply YES for more info.",
        event_id: "$evt-li-spam-1:fixture.local",
        origin_server_ts: ts("2025-09-26T03:14:00Z"),
        sender: SPAM,
      },
      {
        body: "Just following up — please let me know if you're interested!",
        event_id: "$evt-li-spam-2:fixture.local",
        origin_server_ts: ts("2025-09-27T02:30:00Z"),
        sender: SPAM,
      },
    ],
    name: "Recruiter (LinkedIn)",
    room_id: "!linkedin-unknown-recruiter:fixture.local",
    topic: BRIDGED_TOPIC,
  },
];

export const LINKEDIN_FIXTURE: Fixture = {
  rooms: ROOMS,
  user_id: LINKEDIN_USER_ID,
};
