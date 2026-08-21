# UI Specification — Milestone 2: Group Countdown

## Scope
Builds on `UI_SPEC-milestone-1.md`. The Hero Card, Timeline, color coding,
and Recurring Events section visuals are identical to Milestone 1 — this
document only covers the new screens and what's scoped differently.

## New Screens

### Groups (list)
- List of groups the user belongs to (name + member count, e.g. "7/10")
- "Create Group" button — name input, then shows the generated invite
  code with a copy button
- "Join Group" button — input field for an invite code, with a clear
  error message if the group is full ("Nhóm đã đủ 10 thành viên") or the
  code is invalid

### Group Dashboard (`/groups/[groupId]`)
- Same layout as the Personal Dashboard from Milestone 1: Hero Countdown
  Card, Timeline (color-coded), Recurring Events section
- Difference: every event shown belongs to the group, not the individual
  user — and any member can edit or delete any event here
- **No Todo Checklist on event cards yet** — that's introduced in
  Milestone 3; event cards here are not expandable
- A "Group Settings" area (can be a modal or a separate tab within this
  page):
  - Invite code display + copy button
  - Member count (e.g. "7 / 10 thành viên")
  - Discord Webhook URL input for the group's own channel + "Enable daily
    digest" toggle + "Send test message" button

## Add / Edit Event Form (Group Dashboard)
- Same fields as Milestone 1 (name, deadline, description, repeats-weekly
  toggle) — no changes, just scoped to `group_id` instead of `user_id`
  when saving

## Empty States
- No groups yet -> prompt to create or join one
- A group with no events yet -> same empty state style as the personal
  dashboard, prompting the first member to add an event

## Responsive Behavior
- Same mobile-first approach as Milestone 1
