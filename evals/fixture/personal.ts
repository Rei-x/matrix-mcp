/**
 * Personal-life eval fixture: 1:1 DMs with mom/best-friend/partner, group
 * chats for a vacation, family, and a book club, plus a WhatsApp bridge.
 *
 * All timestamps are frozen in mid-to-late September 2025 so qa_pair answers
 * stay stable across runs. The fixture is designed to support eval questions
 * that mirror real-world personal Matrix usage:
 *
 *   - "what's the most recent thing in my chats?"
 *   - "what time did <person> say to meet?"
 *   - "what URL was shared for X?"
 *   - "what date did we agree on for Y?"
 *   - "across all my chats, who/which conversation mentioned Z?"
 *   - "when did I send <kind of> message?"
 */

import type { Fixture, FixtureRoom } from "./types";
import { tsOf as ts } from "./types";

export const PERSONAL_USER_ID = "@rei:fixture.local";

const ME = PERSONAL_USER_ID;
const MOM = "@mom:fixture.local";
const SAM = "@sam:fixture.local";
const JAMIE = "@jamie:fixture.local";
const MARIA = "@maria:fixture.local";
const TOM = "@tom:fixture.local";
const LISA = "@lisa:fixture.local";
const WABRIDGE = "@whatsappbridge:fixture.local";

const ROOMS: FixtureRoom[] = [
  {
    messages: [
      {
        body: "Don't forget Sunday dinner — 6pm at our place",
        event_id: "$evt-mom-1:fixture.local",
        origin_server_ts: ts("2025-09-18T09:15:00Z"),
        sender: MOM,
      },
      {
        body: "Got it. Should I bring anything?",
        event_id: "$evt-mom-2:fixture.local",
        origin_server_ts: ts("2025-09-18T14:22:00Z"),
        sender: ME,
      },
      {
        body: "Just yourself. And maybe a bottle of red wine if you can",
        event_id: "$evt-mom-3:fixture.local",
        origin_server_ts: ts("2025-09-18T14:23:00Z"),
        sender: MOM,
      },
      {
        body: "Just leaving — see you in 30 min",
        event_id: "$evt-mom-4:fixture.local",
        origin_server_ts: ts("2025-09-21T18:30:00Z"),
        sender: ME,
      },
      {
        body: "Did you call the dentist about Lisa's appointment?",
        event_id: "$evt-mom-5:fixture.local",
        origin_server_ts: ts("2025-09-23T11:00:00Z"),
        sender: MOM,
      },
      {
        body: "Yes, booked her in for Oct 3 at 2pm",
        event_id: "$evt-mom-6:fixture.local",
        origin_server_ts: ts("2025-09-23T17:45:00Z"),
        sender: ME,
      },
      {
        body: "Happy birthday darling! Can't wait to see you",
        event_id: "$evt-mom-7:fixture.local",
        origin_server_ts: ts("2025-09-26T08:00:00Z"),
        sender: MOM,
      },
      {
        body: "Thanks Mom! See you Saturday",
        event_id: "$evt-mom-8:fixture.local",
        origin_server_ts: ts("2025-09-26T08:15:00Z"),
        sender: ME,
      },
      {
        body: "Photo from the party — you look so happy",
        event_id: "$evt-mom-9:fixture.local",
        origin_server_ts: ts("2025-09-28T19:00:00Z"),
        sender: MOM,
      },
      {
        body: "Thank you for everything yesterday. The cake was amazing",
        event_id: "$evt-mom-10:fixture.local",
        origin_server_ts: ts("2025-09-29T22:00:00Z"),
        sender: ME,
      },
    ],
    name: "Mom",
    room_id: "!dm-mom:fixture.local",
    topic: null,
  },
  {
    messages: [
      {
        body: "Yo, you free Friday? Climbing gym after work?",
        event_id: "$evt-sam-1:fixture.local",
        origin_server_ts: ts("2025-09-15T12:30:00Z"),
        sender: SAM,
      },
      {
        body: "Yes! What time?",
        event_id: "$evt-sam-2:fixture.local",
        origin_server_ts: ts("2025-09-15T13:00:00Z"),
        sender: ME,
      },
      {
        body: "6:30 at Brooklyn Boulders",
        event_id: "$evt-sam-3:fixture.local",
        origin_server_ts: ts("2025-09-15T13:02:00Z"),
        sender: SAM,
      },
      {
        body: "https://open.spotify.com/playlist/2024-rewind — that playlist I told you about",
        event_id: "$evt-sam-4:fixture.local",
        origin_server_ts: ts("2025-09-19T20:00:00Z"),
        sender: SAM,
      },
      {
        body: "Listening now, love it",
        event_id: "$evt-sam-5:fixture.local",
        origin_server_ts: ts("2025-09-20T09:00:00Z"),
        sender: ME,
      },
      {
        body: "Bro you absolutely have to read this https://thoughts.example.com/why-everything-is-fine",
        event_id: "$evt-sam-6:fixture.local",
        origin_server_ts: ts("2025-09-22T21:00:00Z"),
        sender: SAM,
      },
      {
        body: "Coffee tomorrow? My usual spot, 10am",
        event_id: "$evt-sam-7:fixture.local",
        origin_server_ts: ts("2025-09-25T16:00:00Z"),
        sender: SAM,
      },
      {
        body: "Yes can't wait",
        event_id: "$evt-sam-8:fixture.local",
        origin_server_ts: ts("2025-09-26T09:30:00Z"),
        sender: ME,
      },
      {
        body: "Was so nice catching up. Don't forget the party tomorrow at Maria's, 8pm",
        event_id: "$evt-sam-9:fixture.local",
        origin_server_ts: ts("2025-09-27T14:00:00Z"),
        sender: SAM,
      },
      {
        body: "That party was amazing. We should do it more often",
        event_id: "$evt-sam-10:fixture.local",
        origin_server_ts: ts("2025-09-29T11:00:00Z"),
        sender: ME,
      },
    ],
    name: "Sam",
    room_id: "!dm-sam:fixture.local",
    topic: null,
  },
  {
    messages: [
      {
        body: "On my way home. Need anything from the store?",
        event_id: "$evt-jam-1:fixture.local",
        origin_server_ts: ts("2025-09-16T17:30:00Z"),
        sender: JAMIE,
      },
      {
        body: "Milk and eggs please",
        event_id: "$evt-jam-2:fixture.local",
        origin_server_ts: ts("2025-09-16T17:32:00Z"),
        sender: ME,
      },
      {
        body: "Reminder: dentist tomorrow at 9am",
        event_id: "$evt-jam-3:fixture.local",
        origin_server_ts: ts("2025-09-19T08:00:00Z"),
        sender: JAMIE,
      },
      {
        body: "Heading there now, talk later",
        event_id: "$evt-jam-4:fixture.local",
        origin_server_ts: ts("2025-09-20T08:50:00Z"),
        sender: ME,
      },
      {
        body: "What movie tonight?",
        event_id: "$evt-jam-5:fixture.local",
        origin_server_ts: ts("2025-09-22T19:00:00Z"),
        sender: JAMIE,
      },
      {
        body: "Anything but horror please",
        event_id: "$evt-jam-6:fixture.local",
        origin_server_ts: ts("2025-09-22T19:01:00Z"),
        sender: ME,
      },
      {
        body: "I made reservations for our anniversary on Oct 12 at Rosella, 7pm",
        event_id: "$evt-jam-7:fixture.local",
        origin_server_ts: ts("2025-09-24T12:00:00Z"),
        sender: JAMIE,
      },
      {
        body: "Perfect, can't wait",
        event_id: "$evt-jam-8:fixture.local",
        origin_server_ts: ts("2025-09-24T12:05:00Z"),
        sender: ME,
      },
      {
        body: "Was great seeing your friends tonight. Maria is hilarious",
        event_id: "$evt-jam-9:fixture.local",
        origin_server_ts: ts("2025-09-27T22:00:00Z"),
        sender: JAMIE,
      },
      {
        body: "Let's plan the trip to Lisbon for next March. Three weeks?",
        event_id: "$evt-jam-10:fixture.local",
        origin_server_ts: ts("2025-09-29T09:00:00Z"),
        sender: JAMIE,
      },
    ],
    name: "Jamie",
    room_id: "!dm-jamie:fixture.local",
    topic: null,
  },
  {
    messages: [
      {
        body: "OK so when are we doing this Lisbon trip? We've been talking about it for a year",
        event_id: "$evt-lis-1:fixture.local",
        origin_server_ts: ts("2025-09-19T20:00:00Z"),
        sender: MARIA,
      },
      {
        body: "March or April? Weather is best",
        event_id: "$evt-lis-2:fixture.local",
        origin_server_ts: ts("2025-09-19T20:15:00Z"),
        sender: SAM,
      },
      {
        body: "March works for me. I have time off the second half of the month",
        event_id: "$evt-lis-3:fixture.local",
        origin_server_ts: ts("2025-09-19T20:30:00Z"),
        sender: TOM,
      },
      {
        body: "March 14-21 then?",
        event_id: "$evt-lis-4:fixture.local",
        origin_server_ts: ts("2025-09-19T20:45:00Z"),
        sender: ME,
      },
      {
        body: "Confirmed for me",
        event_id: "$evt-lis-5:fixture.local",
        origin_server_ts: ts("2025-09-20T10:00:00Z"),
        sender: MARIA,
      },
      {
        body: "Same",
        event_id: "$evt-lis-6:fixture.local",
        origin_server_ts: ts("2025-09-20T11:00:00Z"),
        sender: SAM,
      },
      {
        body: "Found a cool airbnb https://airbnb.com/rooms/lisbon-alfama-loft can sleep 4",
        event_id: "$evt-lis-7:fixture.local",
        origin_server_ts: ts("2025-09-21T14:00:00Z"),
        sender: TOM,
      },
      {
        body: "Looks perfect, let's book it",
        event_id: "$evt-lis-8:fixture.local",
        origin_server_ts: ts("2025-09-21T15:00:00Z"),
        sender: ME,
      },
      {
        body: "Booked for March 14-21 2026. Check in 3pm",
        event_id: "$evt-lis-9:fixture.local",
        origin_server_ts: ts("2025-09-22T09:00:00Z"),
        sender: TOM,
      },
      {
        body: "Flights look good — about €180 return from BCN",
        event_id: "$evt-lis-10:fixture.local",
        origin_server_ts: ts("2025-09-25T18:00:00Z"),
        sender: SAM,
      },
      {
        body: "I'm so excited for this",
        event_id: "$evt-lis-11:fixture.local",
        origin_server_ts: ts("2025-09-28T19:00:00Z"),
        sender: MARIA,
      },
    ],
    name: "Lisbon Trip 2026",
    room_id: "!trip-lisbon:fixture.local",
    topic: "Planning the spring 2026 trip to Lisbon.",
  },
  {
    messages: [
      {
        body: "Mom can we do dinner Sunday?",
        event_id: "$evt-fam-1:fixture.local",
        origin_server_ts: ts("2025-09-16T19:00:00Z"),
        sender: LISA,
      },
      {
        body: "Yes! Sunday 6pm. Rei and Jamie are coming too",
        event_id: "$evt-fam-2:fixture.local",
        origin_server_ts: ts("2025-09-16T19:05:00Z"),
        sender: MOM,
      },
      {
        body: "Reminder: grandma's birthday is Oct 5, gift ideas?",
        event_id: "$evt-fam-3:fixture.local",
        origin_server_ts: ts("2025-09-20T14:00:00Z"),
        sender: LISA,
      },
      {
        body: "She mentioned wanting one of those weighted blankets",
        event_id: "$evt-fam-4:fixture.local",
        origin_server_ts: ts("2025-09-20T14:15:00Z"),
        sender: ME,
      },
      {
        body: "Good idea. I'll order one. Lisa we can split it 3 ways",
        event_id: "$evt-fam-5:fixture.local",
        origin_server_ts: ts("2025-09-20T14:20:00Z"),
        sender: MOM,
      },
      {
        body: "Anyone heard from Uncle Pete? He hasn't replied to my messages",
        event_id: "$evt-fam-6:fixture.local",
        origin_server_ts: ts("2025-09-23T10:00:00Z"),
        sender: LISA,
      },
      {
        body: "He's away in Italy until next week",
        event_id: "$evt-fam-7:fixture.local",
        origin_server_ts: ts("2025-09-23T10:30:00Z"),
        sender: MOM,
      },
      {
        body: "Happy birthday Rei! See you tomorrow",
        event_id: "$evt-fam-8:fixture.local",
        origin_server_ts: ts("2025-09-26T12:00:00Z"),
        sender: MOM,
      },
      {
        body: "Happy bday big sib",
        event_id: "$evt-fam-9:fixture.local",
        origin_server_ts: ts("2025-09-26T12:30:00Z"),
        sender: LISA,
      },
      {
        body: "Such a great party last night. Love you all",
        event_id: "$evt-fam-10:fixture.local",
        origin_server_ts: ts("2025-09-28T20:00:00Z"),
        sender: MOM,
      },
    ],
    name: "Family",
    room_id: "!family:fixture.local",
    topic: "Mom, Lisa, and me. Family chat.",
  },
  {
    messages: [
      {
        body: "October book is decided: 'The Overstory' by Richard Powers",
        event_id: "$evt-bk-1:fixture.local",
        origin_server_ts: ts("2025-09-15T09:00:00Z"),
        sender: MARIA,
      },
      {
        body: "Already reading it, it's beautiful",
        event_id: "$evt-bk-2:fixture.local",
        origin_server_ts: ts("2025-09-15T09:15:00Z"),
        sender: TOM,
      },
      {
        body: "Discussion meet date?",
        event_id: "$evt-bk-3:fixture.local",
        origin_server_ts: ts("2025-09-15T10:00:00Z"),
        sender: LISA,
      },
      {
        body: "Oct 22, my place 7pm",
        event_id: "$evt-bk-4:fixture.local",
        origin_server_ts: ts("2025-09-16T14:00:00Z"),
        sender: MARIA,
      },
      {
        body: "Started it yesterday, the prologue is incredible",
        event_id: "$evt-bk-5:fixture.local",
        origin_server_ts: ts("2025-09-19T16:00:00Z"),
        sender: ME,
      },
      {
        body: "Halfway through. The chapter about the chestnut tree made me cry",
        event_id: "$evt-bk-6:fixture.local",
        origin_server_ts: ts("2025-09-22T11:00:00Z"),
        sender: TOM,
      },
      {
        body: "I'm finding it slow. Anyone else?",
        event_id: "$evt-bk-7:fixture.local",
        origin_server_ts: ts("2025-09-25T18:00:00Z"),
        sender: LISA,
      },
      {
        body: "Stick with it, the second half is where it grabs you",
        event_id: "$evt-bk-8:fixture.local",
        origin_server_ts: ts("2025-09-25T18:30:00Z"),
        sender: MARIA,
      },
      {
        body: "Just finished. Amazing book",
        event_id: "$evt-bk-9:fixture.local",
        origin_server_ts: ts("2025-09-28T22:00:00Z"),
        sender: ME,
      },
    ],
    name: "Book Club",
    room_id: "!bookclub:fixture.local",
    topic: "Monthly book club. Maria, Tom, Lisa, me.",
  },
  {
    messages: [
      {
        body: "[whatsapp:Sofia] Anyone going to the wedding in October?",
        event_id: "$evt-wa-1:fixture.local",
        origin_server_ts: ts("2025-09-17T21:00:00Z"),
        sender: WABRIDGE,
      },
      {
        body: "[whatsapp:Marco] Yes! Both events?",
        event_id: "$evt-wa-2:fixture.local",
        origin_server_ts: ts("2025-09-17T21:15:00Z"),
        sender: WABRIDGE,
      },
      {
        body: "[whatsapp:Sofia] Just the ceremony for me, can't make the reception",
        event_id: "$evt-wa-3:fixture.local",
        origin_server_ts: ts("2025-09-17T21:20:00Z"),
        sender: WABRIDGE,
      },
      {
        body: "I'll be at both. Looking forward to seeing everyone",
        event_id: "$evt-wa-4:fixture.local",
        origin_server_ts: ts("2025-09-20T12:00:00Z"),
        sender: ME,
      },
      {
        body: "[whatsapp:Marco] Anyone know a good gift idea for the couple?",
        event_id: "$evt-wa-5:fixture.local",
        origin_server_ts: ts("2025-09-24T19:00:00Z"),
        sender: WABRIDGE,
      },
      {
        body: "[whatsapp:Sofia] They have a registry on https://zola.com/registry/elena-and-paolo",
        event_id: "$evt-wa-6:fixture.local",
        origin_server_ts: ts("2025-09-24T19:30:00Z"),
        sender: WABRIDGE,
      },
      {
        body: "Got my gift sorted, see you all Saturday",
        event_id: "$evt-wa-7:fixture.local",
        origin_server_ts: ts("2025-09-29T10:00:00Z"),
        sender: ME,
      },
    ],
    name: "Old Friends (WA)",
    room_id: "!whatsapp-oldfriends:fixture.local",
    topic: "Bridged from a WhatsApp group of old friends.",
  },
];

export const PERSONAL_FIXTURE: Fixture = {
  rooms: ROOMS,
  user_id: PERSONAL_USER_ID,
};
