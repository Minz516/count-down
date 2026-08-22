# Countdown App — Product Requirements Document

## Overview
Countdown is a web app that lets users track upcoming events by entering a
name and a deadline. Events are automatically sorted by time remaining, with
the single nearest upcoming event highlighted with the most detail
(live real-time countdown).

## Goals
- Let users add, edit, and delete events (name + deadline)
- Automatically sort events by proximity (nearest deadline first)
- Show a live, real-time countdown (days:hours:minutes:seconds) for the
  single nearest upcoming event only
- Show all other events in a simpler list with just "X days left"
- Persist data per user via authentication + database, accessible across
  devices
- Let a personal todo checklist be attached to any event
- Let a user paste their own Discord Webhook URL and receive a daily digest
  of upcoming deadlines
- Let users create/join a Group and share a single timeline of deadlines,
  with equal edit permissions for every member

## User Flow
1. User signs up / logs in (Supabase Auth)
2. User adds an event: name + deadline (date + time)
3. Events list auto-sorts by deadline, ascending (nearest first)
4. The nearest event becomes the "Hero Card" at the top, with a live
   countdown ticking every second
5. All other events render as a compact list showing "X days left"
6. User can edit or delete any event
7. Events whose deadline has passed are shown in a "past" state (greyed
   out / green marker) for a 24-hour grace period, then are **permanently
   deleted** from the database
8. Events near their deadline are visually flagged by urgency (color-coded)
9. Recurring events (e.g. "every Sunday") are supported: once a recurring
   event's deadline passes, it automatically rolls forward to its next
   occurrence instead of being deleted, and displays separately from the
   regular timeline
10. Any event card can be expanded to show a personal todo checklist - add
    items, check them off, see progress (e.g. "2/5")
11. In Settings, the user can paste their own Discord Webhook URL; once
    saved, a daily message lists their events due within the next 7 days
12. From a Groups screen, a user can create a group (receiving a shareable
    invite code) or join one by entering a code, up to 10 members per group
13. Any member opens the Group Dashboard - the same Hero Card/Timeline/
    Recurring UI as the personal dashboard, scoped to that group - and any
    member can add/edit/delete any event there; changes are visible to
    everyone immediately
14. In the group's own Settings, any member can paste a Discord Webhook URL
    for the group, separate from anyone's personal one

## Core Features (MVP)
- [ ] **Auth & data isolation (hard requirement):** sign up / log in / log
      out (Supabase Auth, email + password). Each user must only ever be
      able to see, create, edit, or delete their own events — enforced at
      the database level via Row Level Security (RLS) in Supabase, not just
      hidden in the UI.
- [ ] Create event (name, deadline, optional description)
- [ ] Read / list events, sorted by deadline ascending
- [ ] Update event
- [ ] Delete event
- [ ] Nearest event Hero Card with live D:H:M:S countdown
- [ ] Single continuous timeline listing all events (past, today, future)
      together — not split into separate "upcoming" vs "past" sections
- [ ] Color-coded urgency status per event:
      - Green: deadline has passed (event is in its 24h grace period before
        deletion)
      - Red: deadline is today / the single nearest event
      - Yellow: deadline is within the next 7 days
      - Default/muted: deadline is more than 7 days away
- [ ] Expired (non-recurring) events are automatically, permanently deleted
      24 hours after their deadline passes
- [ ] Recurring events: supports a weekly recurrence (e.g. "every Sunday").
      When a recurring event's deadline passes, it rolls forward to the
      next occurrence automatically instead of being deleted. Displayed in
      its own pinned section, separate from the main timeline.
- [ ] Todo checklist per event (personal, not shared with anyone): add items,
      check them off, item count shown on the card (e.g. "2/5")
- [ ] Settings page: personal Discord Webhook URL + "enable daily digest"
      toggle + a "send test message" button; a scheduled server-side job
      sends the daily digest itself (see `ARCHITECTURE.md` "Discord Digest")
- [ ] Group Countdown: create a group (name -> unique invite code), join a
      group by code (hard cap of 10 members, enforced at the database
      level), a Group Dashboard reusing the Hero Card/Timeline/color-coding/
      Recurring UI scoped to that group, equal-permission editing (any
      member may add/edit/delete any event in the group), and a group-level
      Discord webhook + daily digest (separate from any member's personal
      one)

## Out of Scope (for MVP)
- Push notifications / reminders beyond the Discord digest
- Sharing personal events between users / teams outside of a Group (a
  personal event's checklist items always belong to the individual user;
  group events don't have a checklist yet - see Group Countdown scope below)
- Categories or tags (can be a fast-follow if useful later)
- Recurrence patterns other than weekly (e.g. monthly, custom intervals)
- Todo checklists on group events, and any owner-only permission tier for
  groups (kicking members, restricting edits) - both explicitly deferred;
  every group member currently has equal permissions
- Merging personal and group timelines into one combined view - they stay
  as separate dashboards

## Assumptions (confirm before implementation)
- A deadline is a single point in time, not a date range
- Expired non-recurring events are kept for exactly 24 hours (grace period)
  after their deadline, then hard-deleted; this cannot be undone
- The "add event" form warns (but does not block) if the chosen deadline is
  already in the past
- Todo checklist items always belong to the individual user - there is no
  concept of sharing them yet
- The digest only ever covers non-recurring events - recurring events already
  have their own always-visible pinned section, so they're not re-surfaced
  in the digest too
- The 10-member group cap is a hard limit enforced at the database level, not
  just in the UI (so it can't be bypassed by a direct API call)
- A user can be a member of multiple groups at once, and the personal
  dashboard and each group's dashboard remain fully separate views
