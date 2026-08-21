# UI Specification

## Screens
1. **Login / Signup** — simple email + password form
2. **Dashboard** (main page)
   - "Add Event" button/form (name + deadline datetime picker, optional
     "repeats weekly" toggle + day-of-week picker)
   - Hero Countdown Card (the nearest upcoming event)
   - A single continuous **Timeline** — today and future events together in
     one list, color-coded by urgency
   - Recurring Events section — pinned separately (e.g. below the
     timeline), one card per recurring event
   - Past Events section — compact, pinned at the bottom of the page, for
     events whose deadline just passed

## Hero Countdown Card (nearest event)
- Large, visually prominent card pinned at the top of the dashboard
- Displays: event name, live countdown formatted as `Dd Hh Mm Ss`, updating
  every second
- Nice-to-have (not MVP-blocking): description text, a progress bar showing
  time elapsed since `created_at` relative to `deadline`
- Should look visually distinct from other cards — larger type, accent
  border/background color

## Timeline (today + future events, one continuous list)
- Compact list/cards, one row per event, sorted ascending by deadline
- Each item shows: a small colored status dot/marker, event name, date,
  and a right-aligned status label:
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

## Empty State
- No events yet -> friendly message + a clear call-to-action to add the
  first event

## Responsive Behavior
- Mobile-first: everything stacks vertically
- Hero Card is full-width at the top on all screen sizes
