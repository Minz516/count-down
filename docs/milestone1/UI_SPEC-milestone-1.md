# UI Specification — Milestone 1: Personal Countdown + Todo Checklist

## Screens
1. **Login / Signup** — simple email + password form
2. **Personal Dashboard** (main page)
   - "Add Event" button/form (name + deadline datetime picker, optional
     "repeats weekly" toggle + day-of-week picker)
   - Hero Countdown Card (the nearest upcoming event)
   - A single continuous Timeline — past, today, and future events
     together in one list, color-coded by urgency
   - Recurring Events section — pinned separately, one card per
     recurring event
   - Each event card is expandable to show its Todo Checklist
3. **Settings**
   - Discord Webhook URL input (text field + Save button)
   - "Enable daily digest" toggle
   - "Send test message" button — sends a sample digest immediately

## Hero Countdown Card (nearest event)
- Large, prominent card at the top of the dashboard
- Displays: event name, live countdown formatted `Dd Hh Mm Ss`, updating
  every second
- Nice-to-have (not blocking): description text, a progress bar based on
  todo checklist completion (e.g. "3/5 done") instead of just elapsed time
- Visually distinct — larger type, accent border/background

## Timeline (all events, one continuous list)
- Compact list/cards, sorted ascending by deadline
- Each item shows: a colored status dot, event name, date, right-aligned
  status label:
  - Past: "Đã qua" (grey/green, de-emphasized)
  - Today / nearest: "Hôm nay" (red, bold)
  - Within 7 days: "còn X ngày" (yellow)
  - Beyond 7 days: "còn X ngày" (default/muted)
- Edit and delete actions per item (icon buttons)
- Past events disappear automatically once the backend deletes them after
  24 hours — no user action needed

## Todo Checklist (per event)
- Collapsed by default on each event card; tapping/clicking expands it
  in place
- Simple checklist UI: text input to add an item, list of items with a
  checkbox, item count shown on the collapsed card header (e.g. "2/5")

## Recurring Events Section
- Pinned separately from the main timeline (dashed border or distinct
  card style)
- One card per recurring event: "Lặp lại - [day] hàng tuần" label, event
  name, "còn X ngày" until the next occurrence
- Does not participate in the main timeline's sort order

## Add / Edit Event Form
- Fields: Name (required), Deadline (required), Description (optional),
  "Repeats weekly" toggle + day-of-week picker (optional)
- Warns (does not block) if the deadline is already in the past

## Empty State
- No events yet -> friendly message + a clear call-to-action to add the
  first event

## Responsive Behavior
- Mobile-first: everything stacks vertically
- Hero Card is full-width at the top on all screen sizes
