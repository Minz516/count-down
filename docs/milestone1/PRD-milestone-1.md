# Countdown App — Milestone 1: Personal Countdown + Todo Checklist

## Scope of This Milestone
A fully working **personal** countdown app — one user, their own events,
their own todo checklists. No groups yet (that's Milestone 2).

## Overview
Countdown lets a user track upcoming events by entering a name and a
deadline. Events auto-sort by proximity, the nearest one is highlighted
with a live countdown, and each event can have its own personal todo
checklist.

## Goals
- Auth so each user's data is private to them
- Create, edit, delete events (name + deadline)
- Auto-sort events by deadline, nearest first
- Live real-time countdown (D:H:M:S) for the single nearest event
- A single continuous timeline (past, today, future together),
  color-coded by urgency
- Expired events auto-delete 24 hours after their deadline
- Recurring weekly events that roll forward instead of being deleted
- A personal todo checklist attached to any event
- A daily Discord digest of upcoming deadlines, sent to a webhook the user
  configures themselves

## User Flow
1. User signs up / logs in (Supabase Auth)
2. User adds an event: name + deadline, optionally "repeats weekly"
3. Timeline auto-sorts by deadline ascending
4. Nearest event becomes the Hero Card, with a live ticking countdown
5. All other events show in the same timeline as compact rows with
   "còn X ngày"
6. User can edit or delete any event
7. Events whose deadline has passed show in a "past" state for 24 hours,
   then are permanently deleted
8. Events near their deadline are color-flagged (see Color Coding)
9. Recurring events roll forward to their next occurrence automatically,
   shown in their own pinned section
10. Any event can be expanded to show a personal todo checklist — add
    items, check them off, see progress (e.g. "2/5")
11. In Settings, the user can paste their own Discord Webhook URL; once
    saved, a daily message lists events due within the next 7 days

## Core Features (MVP for this milestone)
- [ ] Auth & data isolation (hard requirement): sign up / log in / log out
      via Supabase Auth. RLS ensures a user only ever sees their own data.
- [ ] Create / read / update / delete events
- [ ] Single continuous Timeline (past + today + future together)
- [ ] Color-coded urgency:
      - Green: deadline has passed (24h grace period before deletion)
      - Red: deadline is today / the single nearest event
      - Yellow: deadline is within the next 7 days
      - Default/muted: deadline is more than 7 days away
- [ ] Hero Countdown Card for the nearest event, live D:H:M:S countdown
- [ ] Expired events hard-deleted 24 hours after their deadline
- [ ] Recurring weekly events (roll forward automatically, shown separately)
- [ ] Todo checklist per event (personal, not shared with anyone)
- [ ] Settings page: personal Discord Webhook URL + daily digest

## Out of Scope for This Milestone
- Group Countdown (Milestone 2)
- Per-member todo checklists on group events (Milestone 3)
- Push notifications beyond the Discord digest
- Recurrence patterns other than weekly
- Categories / tags

## Assumptions
- A deadline is a single point in time, not a date range
- Expired events are kept for exactly 24 hours (grace period), then
  hard-deleted — this cannot be undone
- The "add event" form warns (but does not block) if the chosen deadline
  is already in the past
- Todo checklist items always belong to the individual user — there is no
  concept of sharing yet at this milestone
