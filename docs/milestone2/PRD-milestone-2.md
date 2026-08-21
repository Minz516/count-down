# Countdown App — Milestone 2: Group Countdown

## Scope of This Milestone
Builds on Milestone 1 (personal countdown + todo checklist, already
working). This milestone adds **Group Countdown**: a shared timeline that
multiple users can view and edit together.

**Not included yet:** todo checklists on group events — group event cards
do not show a checklist at the end of this milestone. That is
Milestone 3.

## Overview
A user can create a Group (e.g. "COSC2087 classmates"), get a shareable
invite code, and other users join using that code. Everyone in the group
sees and can manage the same shared timeline of deadlines — same
Hero Card / Timeline / color-coding / recurring-events UI as the personal
dashboard, just scoped to the group instead of to one person.

## Goals
- Create a group, get a unique invite code
- Join a group by entering its invite code
- Cap group membership at **10 members**
- All members have equal permissions — anyone can add, edit, or delete
  events in the group (no owner-only restrictions)
- Reuse the Milestone 1 Hero Card / Timeline / color-coding / recurring
  logic, scoped to the group's events instead of the user's own
- Each group has its own Discord Webhook (separate from a member's
  personal one), for a daily digest posted to the group's own channel

## User Flow
1. From a "Groups" screen, user taps "Create Group", names it, and
   receives an invite code
2. User shares the invite code (e.g. via the group's Discord chat)
3. Other users tap "Join Group", paste the code, and are added as members
   — up to 10 members total; the 11th join attempt is rejected with a
   clear error message
4. Any member opens the Group Dashboard and sees the same kind of
   Hero Card + Timeline + Recurring section as their personal dashboard,
   but showing only that group's events
5. Any member can add/edit/delete an event in the group — changes are
   visible to everyone
6. In the group's own Settings, any member can paste a Discord Webhook
   URL for the group; once set, a daily digest of the group's upcoming
   deadlines (within 7 days) is posted there

## Core Features (new in this milestone)
- [ ] Create group (name -> generates a unique invite code)
- [ ] Join group via invite code, enforcing a hard cap of 10 members
- [ ] Group Dashboard: Hero Card + Timeline + color coding + Recurring
      section, scoped to one group's events (reusing Milestone 1's UI
      components)
- [ ] Equal-permission editing: any member can add/edit/delete any event
      in the group
- [ ] Group Settings: view/copy invite code, view member count (e.g.
      "7/10"), configure the group's own Discord Webhook URL
- [ ] Group Discord daily digest (separate from each member's personal
      digest)

## Out of Scope for This Milestone
- Todo checklists on group events (Milestone 3)
- Any owner-only permission tier (kicking members, restricting edits) —
  explicitly decided against for the MVP; all members are equal
- Merging personal and group timelines into one combined view — they
  stay as separate dashboards/tabs

## Assumptions
- The 10-member cap is a hard limit enforced at the database level, not
  just in the UI (so it can't be bypassed by a direct API call)
- A user can be a member of multiple groups at once
- The personal dashboard and each Group's dashboard remain separate views
