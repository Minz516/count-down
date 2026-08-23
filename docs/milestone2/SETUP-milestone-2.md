# Setup Guide — Milestone 2: Group Countdown

## Prerequisites
- Milestone 1 already implemented and working

## 1. Apply the Schema Changes
In the Supabase SQL Editor, run:
1. `alter table events add column group_id uuid references groups(id);`
   (create the `groups` table first — see `ARCHITECTURE-milestone-2.md`)
2. The `groups`, `group_members`, and `group_settings` table definitions
3. The `check_group_member_cap` trigger function + trigger
4. The updated RLS policy on `events` (replacing the Milestone 1 policy)
5. RLS policies for `groups`, `group_members`, `group_settings`
6. The Postgres function used for joining a group by invite code (see
   `ARCHITECTURE-milestone-2.md`, "RLS Changes")

## 2. Update the Scheduled Edge Function
Extend the Milestone 1 Edge Function with the group-digest step described
in `ARCHITECTURE-milestone-2.md`. No new schedule/trigger needed — same
function, same cron.

## 3. No New Environment Variables
This milestone doesn't need any new env vars beyond Milestone 1.

## Suggested Implementation Order (for Claude Code)
1. `groups`, `group_members`, `group_settings` tables + member-cap trigger
2. `events.group_id` column + updated RLS policy
3. Join-by-invite-code Postgres function + "Join Group" UI with error
   handling for full/invalid codes
4. "Create Group" flow (name -> generate invite code -> show it)
5. Groups list screen
6. Group Dashboard page — reuse Hero Card / Timeline / Recurring
   components from Milestone 1, scoped to `group_id`
7. Group Settings UI (invite code, member count, Discord webhook)
8. Extend the scheduled Edge Function with the group-digest step
9. Polish: empty states, error states (full group, invalid code)

## Next Step
Once group events are working end-to-end, continue with
`PRD-milestone-3.md` / `ARCHITECTURE-milestone-3.md` /
`UI_SPEC-milestone-3.md` / `SETUP-milestone-3.md` to enable per-member
todo checklists on group events.
