# PLAN.md — Countdown App Implementation Plan

> Synthesizes `PRD.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, and `SETUP.md` into an ordered,
> checkable build plan. No code has been written yet — this is the sequencing document to
> follow when implementation starts. Visual/styling decisions defer to `DESIGN.md` /
> `THEME.md` / `TASTE.md`, which are not repeated here.

## Goal

A web app where a signed-in user tracks personal deadlines: add/edit/delete events, see
them auto-sorted nearest-first, get a live-ticking hero countdown for the single nearest
event, a color-coded timeline for everything else, and separate handling for weekly
recurring events. Each user only ever sees their own data (Supabase RLS).

## Explicit non-goals (PRD "Out of Scope")

Do not build: push notifications/reminders, cross-user sharing, categories/tags, or
recurrence patterns other than weekly. Do not implement magic-link auth yet (email+password
only, per `ARCHITECTURE.md`).

## Open assumptions to confirm before/while building

These are stated as assumptions in `PRD.md`, not settled requirements — flag if any need
revisiting once real usage patterns emerge:
1. A deadline is a single instant, not a date range.
2. Grace period is exactly 24h after `deadline`, then hard-delete (irreversible).
3. The add/edit form warns but never blocks saving a past deadline.
4. (From `DESIGN.md`) whether the rainbow-gradient wordmark on the login screen is
   intentional or should be normalized to the single-accent brand system — resolve before
   building the auth screen's visual polish.

---

## Phase 0 — Scaffold & environment

- [ ] `npx create-next-app@latest countdown --typescript --tailwind --app`
- [ ] `npm install @supabase/supabase-js`
- [ ] Create the folder skeleton from `ARCHITECTURE.md`:
  ```
  app/layout.tsx, app/page.tsx, app/login/page.tsx, app/signup/page.tsx
  components/EventForm.tsx, HeroCountdownCard.tsx, EventListItem.tsx, PastEventsList.tsx
  lib/supabaseClient.ts, lib/useCountdown.ts
  types/event.ts
  ```
  (`PastEventsList.tsx` is superseded by the unified Timeline decision in Phase 4 below —
  keep as a placeholder or fold past-event rendering into the Timeline component; don't
  build a separate past-only list, see Phase 4.)
- [ ] Create a Supabase project; note the project URL + anon key.
- [ ] `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] `lib/supabaseClient.ts`: single exported Supabase client instance.

**Done when:** `npm run dev` serves the default Next.js page and the Supabase client
imports without error.

---

## Phase 1 — Database schema & RLS

Run in the Supabase SQL editor (per `ARCHITECTURE.md`):

- [ ] Create `events` table:

  | column | type | notes |
  |---|---|---|
  | `id` | uuid | PK, `default gen_random_uuid()` |
  | `user_id` | uuid | `references auth.users(id)`, not null |
  | `name` | text | not null |
  | `deadline` | timestamptz | not null |
  | `description` | text | nullable |
  | `created_at` | timestamptz | `default now()` |
  | `is_recurring` | boolean | `default false` |
  | `recurrence_day_of_week` | smallint | nullable; 0=Sunday..6=Saturday; only set when `is_recurring = true` |

  No `is_archived` column — expired non-recurring rows are hard-deleted, not archived.

- [ ] Enable RLS on `events`.
- [ ] Policy: `select`/`insert`/`update`/`delete` allowed only where `user_id = auth.uid()`.
- [ ] In Authentication > Providers, confirm Email provider is enabled.

**Done when:** a manual insert/select as one test user succeeds, and the same query
authenticated as a second test user returns zero rows for the first user's events (verifies
RLS is actually enforced, not just assumed).

---

## Phase 2 — Auth

- [ ] `app/login/page.tsx`, `app/signup/page.tsx`: email + password forms against Supabase
      Auth.
- [ ] Session handling via the Supabase client; protected routes (the dashboard) redirect
      to `/login` when there is no active session.
- [ ] Log out affordance (dashboard nav, per the reference mockups).

**Done when:** sign up creates a user + session, log out clears it and redirects, and
visiting `/` while logged out redirects to `/login` instead of flashing dashboard content.

---

## Phase 3 — Events CRUD (data layer + form)

- [ ] `types/event.ts`: `Event` type matching the schema exactly (including
      `is_recurring` / `recurrence_day_of_week`).
- [ ] Data functions (create / read / update / delete) against Supabase — RLS makes the
      per-user scoping automatic, no manual `user_id` filtering needed on read, but `insert`
      must still set `user_id` to the current session's user.
- [ ] `components/EventForm.tsx` (shared by add and edit), per `UI_SPEC.md`:
  - Name (text, required)
  - Deadline (`datetime-local`, required)
  - Description (textarea, optional)
  - "Repeats weekly" toggle + day-of-week picker (sets `is_recurring` +
    `recurrence_day_of_week`)
  - On submit with a past deadline: show a non-blocking warning, still allow save.

**Done when:** an event can be created, edited, and deleted end-to-end through the UI, and
a recurring event correctly persists its `recurrence_day_of_week`.

**Watch for:** `datetime-local` inputs are timezone-naive (local wall-clock, no offset). It
must be converted to a correct UTC `timestamptz` on write, and converted back to the user's
local time when displaying/editing an existing event — otherwise deadlines silently drift by
the user's UTC offset.

---

## Phase 4 — Dashboard data fetching & list composition

Per `ARCHITECTURE.md` "Sorting & Priority Logic," this is two separate queries feeding two
separate UI regions, not one list with client-side splitting:

- [ ] Query A: all non-recurring events for the logged-in user, ordered by `deadline`
      ascending. This is the single continuous **Timeline** — past, today, and future
      together, unsplit.
- [ ] Query B: all recurring events for the logged-in user, fetched and rendered separately;
      never merged into Query A's sort order.
- [ ] Nearest event = the first future-or-today item in Query A's result → also renders
      (expanded) as the Hero Card above the Timeline.
- [ ] Empty state (`UI_SPEC.md`): when Query A returns nothing, show a friendly message +
      a clear "Add Event" call-to-action instead of an empty Hero Card / Timeline.

**Done when:** with a mix of past, today, upcoming, and recurring test events seeded, the
dashboard shows exactly one Hero Card (the true nearest non-recurring event), one unified
Timeline containing every other non-recurring event including past ones, and a separate
recurring section — with no event appearing in two places except the Hero/Timeline overlap
that's intentional by design.

---

## Phase 5 — Hero Countdown Card + live countdown

- [ ] `lib/useCountdown.ts`: `setInterval` at 1000ms recomputing days/hours/minutes/seconds
      remaining until a given `deadline`; cleans up the interval on unmount.
- [ ] `components/HeroCountdownCard.tsx`: event name, live countdown formatted `Dd Hh Mm
      Ss`, ticking every second. Visually distinct per `UI_SPEC.md` (larger type, accent
      border/background — see `DESIGN.md` §8.2 for the exact treatment).
- [ ] Nice-to-have, not MVP-blocking: description text, a progress bar from `created_at` to
      `deadline`.
- [ ] Only the Hero Card uses `useCountdown`. Timeline/recurring items must **not** use it —
      they compute "days remaining" once per render (Phase 6/7), per `ARCHITECTURE.md`'s
      explicit perf note.

**Done when:** the Hero Card's seconds visibly tick once per second, the interval is
confirmed to clear on navigation away (no leaked timer), and no other component re-renders
every second.

---

## Phase 6 — Timeline component with urgency coding

- [ ] `components/EventListItem.tsx`, one row per Timeline event: small colored status dot,
      event name, date, right-aligned status label, edit/delete icon buttons.
- [ ] Status derivation (client-side, from `deadline` vs. `now()`, presentational only —
      does not affect sort order or deletion, which run purely off the raw timestamp):

  | Status | Condition | Label | Color |
  |---|---|---|---|
  | Past | `deadline < now()` | "Đã qua" | green, muted |
  | Today | `deadline` falls on today's date (the nearest event) | "Hôm nay" | red, bold |
  | Soon | `0 < days remaining <= 7` | "còn X ngày" | yellow |
  | Later | `days remaining > 7` | "còn X ngày" | default/muted |

- [ ] Past events stay visible (de-emphasized) until the backend cleanup job removes them
      (Phase 8) — the client does not hide them itself after 24h; it just renders whatever
      Query A currently returns.
- [ ] Edit opens `EventForm.tsx` pre-filled; delete removes the row (confirm before
      destructive delete).

**Done when:** an event's status label and color update correctly as its deadline crosses
each threshold (verified by seeding events at each boundary), and edit/delete both work from
the Timeline.

---

## Phase 7 — Recurring Events section

- [ ] Separate component/section, pinned (e.g. below the Timeline, dashed-border card style
      per `UI_SPEC.md` / `DESIGN.md` §8.4).
- [ ] Each card shows: "Lặp lại - [day] hàng tuần" label, event name, "còn X ngày" until the
      next occurrence (computed from the stored `deadline`, once per render — same
      non-ticking treatment as regular Timeline items).
- [ ] Confirm these cards never appear in the main Timeline and are excluded from Query A.

**Done when:** a recurring event shows correctly in its own section only, with an accurate
"days until next occurrence" count.

---

## Phase 8 — Scheduled cleanup & recurrence rollover (server-side)

This cannot be client-driven — it must run even when no one has the app open. Per
`ARCHITECTURE.md` / `SETUP.md`, use `pg_cron` (simplest) or a Supabase Edge Function on a
schedule, running once daily:

- [ ] **Hard-delete expired non-recurring events:**
  ```sql
  DELETE FROM events
  WHERE is_recurring = false
    AND deadline < now() - interval '1 day';
  ```
- [ ] **Roll recurring events forward:** for every row where `is_recurring = true AND
      deadline < now()`, advance `deadline` by 7-day increments (repeated until the result
      is in the future) to the next date matching `recurrence_day_of_week`.

  This second step is more than a single `UPDATE` statement — it needs a loop (advance by
  7 days repeatedly until `deadline > now()`, to correctly handle an event that's been
  overdue for multiple weeks, e.g. the user was away). Implement as a `plpgsql` function
  invoked by `pg_cron`, or as the Edge Function's JS logic if going that route. Pick one
  mechanism for both steps 1 and 2 rather than splitting them across pg_cron and an Edge
  Function, to keep the scheduled job in one place.

- [ ] Schedule the job to run daily (Supabase Scheduled Functions or `pg_cron`).

**Done when:** manually back-dating a test event's `deadline` by >24h and running the job
confirms it's deleted (non-recurring) or correctly rolled forward to a future date matching
its `recurrence_day_of_week` (recurring) — including a case backdated by >7 days, to verify
the loop-forward logic rather than a single fixed +7-day add.

---

## Phase 9 — Polish

- [ ] Empty, loading, and error states for the dashboard and the form (see `DESIGN.md`
      §8.8-8.9 for the specified treatment — skeleton rows, not a spinner).
- [ ] Responsive layout: mobile-first, everything stacks vertically, Hero Card full-width at
      every breakpoint (`UI_SPEC.md` "Responsive Behavior").
- [ ] Apply the full visual system from `DESIGN.md` / `THEME.md` (color tokens, type scale,
      shape/elevation locks, motion spec) — not re-specified here.

**Done when:** the app is usable end-to-end on a small mobile viewport with no horizontal
scroll, and matches the `references/*.png` mockups per `DESIGN.md`.

---

## Phase 10 — Deployment

- [ ] Push to GitHub.
- [ ] Import the repo into Vercel.
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Vercel project
      environment variables.
- [ ] Deploy.

**Done when:** the deployed Vercel URL reproduces the same auth + CRUD + countdown behavior
verified locally, against the same Supabase project.

---

## Phase 11 — Todo Checklist per event

- [ ] `todos` table + RLS (`ARCHITECTURE.md`), `modules/todos/` (repository → service →
      interface), `types/todo.ts`.
- [ ] One query for every event's checklist (`todosInterface.listAllForUser` +
      `groupByEvent`), called once in `app/page.tsx` alongside `getDashboardData` - not one
      query per event card.
- [ ] `components/TodoChecklist.tsx`: collapsed by default, header shows "done/total" once
      non-empty, expands to a checkbox+text row per item plus an add-item input. Manages its
      own local state from the `initialTodos` prop rather than `router.refresh()`-ing -
      todos don't affect sort/urgency/anything else on the page.
- [ ] Embedded in all three card types: `EventListItem`, `RecurringEventCard`,
      `PastEventCard`.

**Done when:** adding/checking/deleting a checklist item on any of the three card types
persists (survives a page refresh) without affecting that event's position, status, or any
other event's checklist.

---

## Phase 12 — Settings page (Discord webhook)

- [ ] `user_settings` table + RLS, `modules/settings/` (repository → service → interface,
      including webhook-URL-shape validation), `types/settings.ts`.
- [ ] `app/settings/page.tsx` + `components/SettingsForm.tsx`: webhook URL input, "enable
      daily digest" toggle, Save, and "Send test message" (posts directly from the browser
      to the URL currently in the field - Discord webhooks accept cross-origin POSTs, no
      Edge Function needed for this one action).
- [ ] Nav link from the dashboard to `/settings`.

**Done when:** saving an obviously-malformed URL is rejected before any network call, saving
a real webhook URL persists across a reload, and "Send test message" delivers a message to
the Discord channel.

---

## Phase 13 — Discord digest (Edge Function)

- [ ] `supabase/functions/daily-digest/index.ts`: one Edge Function that (1) calls
      `cleanup_and_roll_events()` via `.rpc()` - reusing Phase 8's SQL function instead of
      re-implementing it in Deno, (2) reads every `user_settings` row with
      `digest_enabled = true` and a webhook set, (3) for each, fetches that user's
      non-recurring events due within 7 days and `POST`s a formatted digest to their webhook.
      Uses the service-role key (a function secret) since it has no signed-in user - the only
      place in the codebase that isn't anon-key-only.
- [ ] Remove the standalone `cron.schedule(...)` from `cleanup_and_rollover.sql` in favor of
      scheduling this one function daily (keeps the job in one place, per Phase 8's "pick one
      mechanism" note).

**Done when:** manually invoking the deployed function sends exactly one digest per
opted-in user listing their events due in the next 7 days, and a user with
`digest_enabled = false` (or no webhook set) receives nothing.

---

## Cross-cutting risks to keep in view throughout

- **RLS is the hard requirement** (PRD marks it as such) — verify it with a second test
  account at the end of Phase 1, not just assumed from the policy SQL.
- **Timezone correctness** for `datetime-local` ↔ `timestamptz` conversion (Phase 3) — the
  most likely source of "off by a few hours" bugs.
- **The two independent list queries** (Phase 4) must stay independent — a bug that merges
  recurring events into the Timeline's sort, or vice versa, breaks the PRD's explicit
  "displays separately" requirement.
- **The ticking-hook boundary** (Phase 5/6) — only one component on the page should be on a
  1-second re-render cycle. Regressing this (e.g. giving every Timeline row its own
  `useCountdown`) is a real perf issue on a list of any size.
- **Recurrence rollover math** (Phase 8) — must handle events overdue by more than one week,
  not just the common one-week case.
