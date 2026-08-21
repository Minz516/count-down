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

## Out of Scope (for MVP)
- Push notifications / reminders
- Sharing events between users / teams
- Categories or tags (can be a fast-follow if useful later)
- Recurrence patterns other than weekly (e.g. monthly, custom intervals)

## Assumptions (confirm before implementation)
- A deadline is a single point in time, not a date range
- Expired non-recurring events are kept for exactly 24 hours (grace period)
  after their deadline, then hard-deleted; this cannot be undone
- The "add event" form warns (but does not block) if the chosen deadline is
  already in the past
