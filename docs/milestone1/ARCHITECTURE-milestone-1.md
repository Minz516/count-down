# Architecture — Milestone 1: Personal Countdown + Todo Checklist

## Tech Stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend/DB: Supabase (Postgres + Auth)
- Deployment: Vercel (frontend) + Supabase Cloud (backend)

## High-Level Design
The Next.js frontend talks directly to Supabase via the Supabase JS client.
No custom Express/Node backend is needed for this milestone.

## Folder Structure
```
app/
  layout.tsx
  page.tsx                  -> personal dashboard
  login/page.tsx
  signup/page.tsx
  settings/page.tsx         -> personal Discord webhook settings
components/
  EventForm.tsx
  HeroCountdownCard.tsx      -> nearest event, live D:H:M:S
  EventListItem.tsx          -> timeline row (past/today/future)
  TodoChecklist.tsx          -> per-event personal checklist
lib/
  supabaseClient.ts
  useCountdown.ts            -> hook for the live-ticking countdown
types/
  event.ts
  todo.ts
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

> Design note: `todos.user_id` is included now even though every event is
> personal at this milestone. This is intentional — it makes the table
> forward-compatible with Milestone 3 (per-member checklists on shared
> group events) without a schema change later.

**table: user_settings**
| column               | type    | notes                                          |
|----------------------|---------|--------------------------------------------------|
| user_id              | uuid    | primary key, references auth.users(id)          |
| discord_webhook_url  | text    | nullable — user's own Discord Webhook URL       |
| digest_enabled       | boolean | default true                                    |

## Row Level Security (RLS)
- `events`: a user can select/insert/update/delete only rows where
  `user_id = auth.uid()`
- `todos`: a user can select/insert/update/delete only rows where
  `user_id = auth.uid()`
- `user_settings`: a user can read/write only their own row
  (`user_id = auth.uid()`)

## Sorting & Priority Logic
1. Fetch all non-recurring events for the logged-in user, ordered by
   `deadline` ascending, plus recurring events fetched separately
2. Render as a single continuous timeline — past, today, and future
   events together in one list
3. The first future/today event in the sorted list is the nearest event ->
   also rendered as the Hero Card above the timeline
4. Recurring events render in their own pinned section, not mixed into
   the sort order

## Urgency Color Coding
| Status  | Condition                                  | Color        |
|---------|---------------------------------------------|--------------|
| Past    | `deadline < now()`                           | Green (muted)|
| Today   | `deadline` falls on today's date (nearest)   | Red          |
| Soon    | `0 < days remaining <= 7`                     | Yellow       |
| Later   | `days remaining > 7`                          | Default/muted|

## Real-Time Countdown Logic
- `useCountdown(deadline)` hook: `setInterval` at 1000ms, recomputes
  days/hours/minutes/seconds remaining, cleans up on unmount
- Only the Hero (nearest) event uses the live-ticking hook; other rows
  just show a static "days remaining" value

## Scheduled Daily Job (Supabase Edge Function, cron-triggered)
One Edge Function, scheduled once daily, does three things:
1. **Delete expired events:**
   `DELETE FROM events WHERE deadline < now() - interval '1 day'`
   (skip rows where `is_recurring = true`)
2. **Roll forward recurring events:** for every row where
   `is_recurring = true AND deadline < now()`, update `deadline` to the
   next date matching `recurrence_day_of_week` (add 7 days, repeated if
   needed until the result is in the future)
3. **Send Discord digests:** for every row in `user_settings` where
   `discord_webhook_url` is set and `digest_enabled = true`, fetch that
   user's events with `deadline` between now and now + 7 days, format as a
   plain-text Discord message, `POST` to their `discord_webhook_url`

A Supabase Edge Function is used (rather than raw `pg_cron`) because it
needs to make an outbound HTTP call to Discord, which plain Postgres
cannot do without the extra `pg_net` extension.

## Auth Flow
- Supabase Auth, email + password
- Session managed via the Supabase client; protected routes redirect to
  `/login` if there is no active session
