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
  settings/page.tsx         -> personal Discord webhook settings
components/
  EventForm.tsx
  HeroCountdownCard.tsx      -> nearest event, live D:H:M:S
  EventListItem.tsx          -> other events, day count only
  PastEventsList.tsx
  TodoChecklist.tsx          -> per-event personal checklist
  SettingsForm.tsx
lib/
  supabaseClient.ts
  useCountdown.ts            -> hook for the live-ticking countdown
types/
  event.ts
  todo.ts
  settings.ts
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

**table: todos**
| column      | type        | notes                                          |
|-------------|-------------|--------------------------------------------------|
| id          | uuid        | primary key, default gen_random_uuid()          |
| event_id    | uuid        | references events(id), not null                 |
| user_id     | uuid        | references auth.users(id), not null             |
| content     | text        | not null                                        |
| is_done     | boolean     | default false                                   |
| position    | integer     | for manual ordering within the checklist        |
| created_at  | timestamptz | default now()                                   |

> `todos.user_id` is included even though every event is personal today —
> forward-compatible with a future shared-event milestone without a schema
> change later.

**table: user_settings**
| column               | type    | notes                                          |
|----------------------|---------|--------------------------------------------------|
| user_id              | uuid    | primary key, references auth.users(id)          |
| discord_webhook_url  | text    | nullable — user's own Discord Webhook URL       |
| digest_enabled       | boolean | default true                                    |

**Row Level Security (RLS)**
- Enable RLS on `events`, `todos`, `user_settings`
- Policy: users may select/insert/update/delete only rows where
  `user_id = auth.uid()` (see `supabase/schema.sql` for the exact policies)

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

Implemented as `public.cleanup_and_roll_events()`, a `plpgsql` function
(`supabase/cleanup_and_rollover.sql`).

## Discord Digest
The daily digest needs an outbound HTTP call to Discord, which plain
`pg_cron` can't do on its own (no `pg_net`). Rather than split the scheduled
job across two mechanisms, **one Supabase Edge Function**
(`supabase/functions/daily-digest/`), scheduled once daily via its own cron
trigger, does all of it:
1. Calls `cleanup_and_roll_events()` via `.rpc()` — reuses the same SQL
   function above instead of re-implementing that math in the function.
2. Reads every row in `user_settings` where `discord_webhook_url` is set and
   `digest_enabled = true`.
3. For each, fetches that user's **non-recurring** events with `deadline`
   between now and now + 7 days (recurring events already have their own
   always-visible pinned section, so they're excluded from the digest),
   formats a plain-text Discord message, and `POST`s it to their
   `discord_webhook_url`. One user's failed send doesn't abort the rest of
   the batch.

This function runs with no signed-in user, so it authenticates with the
Supabase **service-role key** (a function secret, never the anon key) —
the one deliberate exception to this app's anon-key-only rule elsewhere,
since it must act across every user's data, not one session's.

The Settings page's "Send test message" button is a separate, simpler path:
it POSTs directly from the browser to the webhook URL currently in the form
(Discord webhooks accept cross-origin POSTs) — no Edge Function involved,
since that action has a signed-in user and only needs to talk to Discord.

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
