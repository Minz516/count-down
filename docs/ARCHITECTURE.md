# Architecture

## Tech Stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend/DB: Supabase (Postgres + Auth)
- Deployment: Vercel (frontend) + Supabase Cloud (backend)

## High-Level Design
The Next.js frontend talks directly to Supabase via the Supabase JS client.
No custom Express/Node backend is needed — Supabase provides the database,
authentication, and row-level authorization directly.

## Folder Structure (proposed)
```
app/
  layout.tsx
  page.tsx                  -> main countdown dashboard
  login/page.tsx
  signup/page.tsx
components/
  EventForm.tsx
  HeroCountdownCard.tsx      -> nearest event, live D:H:M:S
  EventListItem.tsx          -> other events, day count only
  PastEventsList.tsx
lib/
  supabaseClient.ts
  useCountdown.ts            -> hook for the live-ticking countdown
types/
  event.ts
```

## Database Schema (Supabase / Postgres)

**table: events**
| column                | type        | notes                                          |
|-----------------------|-------------|--------------------------------------------------|
| id                    | uuid        | primary key, default gen_random_uuid()          |
| user_id               | uuid        | references auth.users(id), not null             |
| name                  | text        | not null                                        |
| deadline              | timestamptz | not null                                        |
| description           | text        | nullable                                        |
| created_at            | timestamptz | default now()                                   |
| is_recurring          | boolean     | default false                                   |
| recurrence_day_of_week| smallint    | nullable, 0 (Sunday) – 6 (Saturday); only set when is_recurring = true |

Notes:
- `is_archived` is **not** used anymore — expired non-recurring events are
  hard-deleted (see cleanup job below) rather than archived.
- Recurring events never get deleted; when their `deadline` passes, a
  scheduled job rolls `deadline` forward to the next matching
  `recurrence_day_of_week`, 7 days later.

**Row Level Security (RLS)**
- Enable RLS on `events`
- Policy: users may select/insert/update/delete only rows where
  `user_id = auth.uid()`

## Sorting & Priority Logic
1. Fetch all non-recurring events for the logged-in user, ordered by
   `deadline` ascending, plus recurring events fetched separately
2. That one fetched list is split client-side (a render-time filter on the
   already-presentational `getEventStatus()`, not a second query) into the
   **Timeline** — today and future events, one continuous list — and the
   **Past Events section** — anything whose deadline has already passed
3. The first future/today event in the sorted list is the nearest event ->
   also rendered as the Hero Card above the timeline
4. Recurring events render in their own pinned section below the main
   timeline, not mixed into the sort order; the Past Events section is
   pinned below that, at the bottom of the page

## Urgency Color Coding
Computed client-side from `deadline` vs. current time, applied per item in
the timeline (the "Past" row below no longer applies to the Timeline itself
since those rows move to the Past Events section instead - it's kept here
because the same `getEventStatus()` status enum still classifies them):
| Status  | Condition                                  | Color        |
|---------|---------------------------------------------|--------------|
| Past    | `deadline < now()`                           | Green (muted)|
| Today   | `deadline` falls on today's date (the nearest event) | Red  |
| Soon    | `0 < days remaining <= 7`                    | Yellow       |
| Later   | `days remaining > 7`                         | Default/muted|

## Scheduled Cleanup & Recurrence Rollover
Client-side filtering is not enough for hard-delete or recurrence, since
those must happen even if no one has the app open. This needs a
**server-side scheduled job** — use a Supabase Edge Function on a cron
schedule (Supabase Scheduled Functions), or the `pg_cron` Postgres
extension, running once a day:
1. **Delete expired non-recurring events:**
   `DELETE FROM events WHERE is_recurring = false AND deadline < now() - interval '1 day'`
2. **Roll forward recurring events:**
   For every row where `is_recurring = true AND deadline < now()`, update
   `deadline` to the next date matching `recurrence_day_of_week` (i.e. add
   7 days, repeated if needed until the result is in the future).

## Real-Time Countdown Logic
- `useCountdown(deadline)` custom hook:
  - Uses `setInterval` at 1000ms to recompute days/hours/minutes/seconds
    remaining
  - Cleans up the interval on unmount
- Only the nearest (Hero) event uses this live-ticking hook. Other events
  only need a "days remaining" value computed once per render — no need to
  tick every second for those, to avoid unnecessary re-renders.

## Auth Flow
- Supabase Auth, email + password to start (magic link can be added later)
- Session managed via the Supabase client
- Protected routes redirect to `/login` if there is no active session
