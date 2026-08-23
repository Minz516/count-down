# Countdown App — Milestone 3: Todo Checklist on Group Events

## Scope of This Milestone
Builds on Milestone 1 (todo checklist, already built for personal events)
and Milestone 2 (Group Countdown, already built without checklists). This
milestone connects the two: every member of a group gets their own
personal checklist on each shared group event.

## Why This Is a Small Milestone
The `todos` table was already designed back in Milestone 1 to be scoped
by `user_id`, specifically so it would work for group events later
without a schema change. So this milestone is mostly about **enabling the
existing Todo Checklist UI on group event cards** and making sure the
per-user scoping is visibly clear to users — not building new backend
plumbing.

## Overview
On the Group Dashboard, each event card becomes expandable (like personal
events already are), showing the current viewer's own checklist for that
event. Two group members looking at the same event each see and manage
their own independent checklist — nobody sees anyone else's items.

## Goals
- Expand any group event card to show/manage a personal todo checklist
- Make it visually obvious that the checklist is personal, not shared
  (e.g. "Việc của bạn: 2/5" rather than just "2/5")
- No new sharing model — explicitly, there is still no single shared
  checklist visible to the whole group

## User Flow
1. Member opens the Group Dashboard
2. Taps/clicks an event card to expand it
3. Sees their own checklist for that event (empty if they haven't added
   anything yet)
4. Adds items, checks them off — this is private to them; other members
   opening the same event see only their own checklist, independently

## Core Features (new in this milestone)
- [ ] Group event cards become expandable, reusing the `TodoChecklist`
      component from Milestone 1
- [ ] Clear "personal, not shared" labeling on the checklist within a
      group event (e.g. a small note or label distinguishing it from a
      shared list)
- [ ] Progress indicator on the collapsed group event card reflects the
      current viewer's own completion (e.g. "Bạn: 2/5")

## Out of Scope for This Milestone
- A genuinely shared/collective checklist option (everyone ticks the same
  list) — not planned; would be a separate future feature if ever wanted
- Assigning specific checklist items to specific members

## Assumptions
- No backend/schema changes are needed — `todos.user_id` already scopes
  correctly regardless of whether the parent event is personal
  (`events.group_id is null`) or shared (`events.group_id` set)
- Existing RLS on `todos` (`user_id = auth.uid()`) already covers this
  case correctly and does not need to change
