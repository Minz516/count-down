# UI Specification

## Screens
1. **Login / Signup** — Signup collects username, email, password, and confirm password
   (client-side mismatch check before submitting); Login accepts a single "username or
   email" field + password. Both screens show the logo mark next to the "Countdown"
   wordmark.
2. **Dashboard** (main page)
   - Top nav: logo + "Countdown" wordmark, **Personal**/**Group** tabs (1-person
     icon / group icon, active tab underlined), Add Event, notifications, settings,
     account menu - shared with the Groups list screen (`Nav.tsx`); a specific
     group's own dashboard keeps its separate contextual header instead (see
     Group Dashboard below)
   - Account menu: clicking the account icon (shows the signed-in user's avatar, or the
     default silhouette if none is set) opens a small menu - **Edit profile** and **Log
     out** - rather than signing out on the first click; shared by `Nav.tsx` and
     `GroupNav.tsx`
   - Edit Profile (modal, from the account menu): avatar preview + "Change avatar" file
     picker, username field, Save/Cancel. A taken username is rejected with a validation
     message; changing your username changes what you sign in with too (docs/PRD.md)
   - "Add Event" button/form (name + deadline datetime picker, optional
     "repeats weekly" toggle + day-of-week picker)
   - Hero Countdown Card (the nearest upcoming event)
   - A single continuous **Timeline** — today and future events together in
     one list, color-coded by urgency
   - Recurring Events section — pinned separately (e.g. below the
     timeline), one card per recurring event
   - Past Events section — compact, pinned at the bottom of the page, for
     events whose deadline just passed
   - Every event card (Timeline, Recurring, or Past) is expandable in place
     to show its own Todo Checklist
3. **Settings** — Discord Webhook URL input, "enable daily digest" toggle,
   "send test message" button
4. **Groups** (`/groups`) — same top nav as the Dashboard (**Group** tab
   active); list of groups the user belongs to (name, a small overlapping stack of a few
   members' avatars, "N/10" member count), "Create Group" (name -> shows the generated
   invite code with a copy button) and "Join Group" (invite code input) flows
5. **Group Dashboard** (`/groups/[groupId]`) — same layout as the personal
   Dashboard (Hero Card, Timeline, Recurring section), scoped to one group's
   events; event cards are **not** expandable here (no Todo Checklist yet -
   Milestone 3). A "Group Settings" area (modal): invite code + copy button, a member
   roster (avatar + username per member, so anyone can see who else is in the group),
   and the same Discord webhook controls as personal Settings

## Hero Countdown Card (nearest event)
- Large, visually prominent card pinned at the top of the dashboard
- Displays: event name, the deadline as dd/mm/yyyy + 24-hour hh:mm, live
  countdown formatted as `Dd Hh Mm Ss`, updating every second
- Nice-to-have (not MVP-blocking): description text, a progress bar showing
  time elapsed since `created_at` relative to `deadline`
- Should look visually distinct from other cards — larger type, accent
  border/background color

## Timeline (today + future events, one continuous list)
- Compact list/cards, one row per event, sorted ascending by deadline
- Each item shows: a small colored status dot/marker, event name, weekday +
  date + time (dd/mm/yyyy, 24-hour hh:mm), and a right-aligned status label:
  - Today / nearest event: label reads "Hôm nay" (in red, bold)
  - Upcoming within 7 days: label reads "còn X ngày" (in yellow)
  - Upcoming beyond 7 days: label reads "còn X ngày" (default/muted color)
- Edit and delete actions available per item (icon buttons)
- The moment an event's deadline passes, it's removed from the Timeline and
  moves to the Past Events section instead (see below) - it does not
  linger here dimmed.

## Add / Edit Event Form
- Fields:
  - Name — text input, required
  - Deadline — datetime-local input, required
  - Description — optional textarea
- On submit: if the deadline is already in the past, show a warning but
  still allow saving (see Assumptions in PRD.md)
- Identical form on the Group Dashboard - same fields, no group-specific
  additions; only which group (if any) the saved event belongs to differs,
  which the form itself never collects

## Recurring Events Section
- Pinned separately from the main timeline (e.g. dashed border, bottom of
  the dashboard, or a distinct card style)
- One card per recurring event, showing: "Lặp lại - [day] hàng tuần" label,
  event name, and "còn X ngày" until its next occurrence
- Does not participate in the main timeline's sort order

## Past Events Section
- Pinned at the very bottom of the page, below Recurring - the least
  important/most transient content on the dashboard
- Compact, de-emphasized rows: event name, date, edit/delete icons - no
  status dot/label, since the section itself already conveys "past"
- Same lifecycle as before, just relocated: an event sits here for 24 hours
  after its deadline, then disappears automatically once the backend
  deletes it (no user action needed; see `ARCHITECTURE.md` cleanup job)
- Section doesn't render at all when there are no past events

## Todo Checklist (per event)
- Collapsed by default on every event card (Timeline, Recurring, and Past
  alike); a header row toggles it open in place — no navigation away from
  the dashboard
- Collapsed header shows an item count once the checklist has items (e.g.
  "2/5"); nothing shown when it's empty
- Expanded: each item as a checkbox + text row (done items shown
  struck-through/muted), a trash icon per item, and a text input at the
  bottom to add a new item
- Personal only — not shared with anyone, at this milestone

## Settings (personal and Group Settings alike)
- Discord Webhook URL — text input, optional. If one is already saved, the field starts
  **empty** and shows the saved URL as its placeholder instead - a signal that this
  channel/user already has a webhook configured, without displaying it in plain text to
  everyone who opens the page (relevant for Group Settings especially, since any member can
  open it). Typing a new value and saving replaces it; leaving the field blank and saving
  leaves the existing webhook untouched (it is **not** the same as clearing it). A small
  "Remove webhook" link appears under the field (only when one is saved and the input is
  empty) for actually clearing it.
- "Enable daily digest" toggle
- "Send test message" button — uses whatever's currently in the field, or the already-saved
  webhook if the field is empty; posts immediately, doesn't require Save first
- Save persists the URL + toggle; an obviously-malformed webhook URL is
  rejected with a validation message before any network call

## Groups
- Groups list: one row per group the user belongs to - name, "N/10" member
  count, links to that group's Dashboard
- "Create Group": name input -> on success, shows the generated invite code
  with a copy button
- "Join Group": invite code input -> on success, goes straight to that
  group's Dashboard; a full group shows "Nhóm đã đủ 10 thành viên", an
  unrecognized code shows an equivalent invalid-code message - both inline,
  no raw error text
- Empty state (no groups yet): a message prompting the user to either create
  or join one - two calls-to-action, not the single-CTA `EmptyState`
  component used elsewhere

## Group Dashboard
- Header: back link to Groups, group name, "N/10 thành viên", Add Event,
  Group Settings, log out
- Body: identical Hero Card/Timeline/Recurring/Past Events sections and
  color coding as the personal Dashboard, populated from that group's events
  instead of the signed-in user's
- Any member's Edit/Delete icon acts on any event in the group - there's no
  per-row "only the creator can edit" restriction
- Group Settings (modal): invite code + copy button, "N / 10 thành viên",
  Discord Webhook URL input, "enable daily digest" toggle, "send test
  message" button - same behavior as personal Settings, scoped to the group

## Empty State
- No events yet -> friendly message + a clear call-to-action to add the
  first event (used identically on the personal Dashboard and an empty
  Group Dashboard)

## Responsive Behavior
- Mobile-first: everything stacks vertically
- Hero Card is full-width at the top on all screen sizes
