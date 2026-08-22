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
  groups/page.tsx           -> groups list + create/join
  groups/[groupId]/page.tsx -> one group's dashboard
components/
  EventForm.tsx
  HeroCountdownCard.tsx      -> nearest event, live D:H:M:S
  EventListItem.tsx          -> other events, day count only
  PastEventsList.tsx
  TodoChecklist.tsx          -> per-event personal checklist
  SettingsForm.tsx
  GroupNav.tsx               -> Group Dashboard header
  GroupSettingsModal.tsx     -> invite code, member count, group webhook
  GroupDashboardClient.tsx   -> Group Dashboard, reuses the personal one's UI
  GroupsListClient.tsx       -> groups list + create/join flows
lib/
  supabaseClient.ts
  useCountdown.ts            -> hook for the live-ticking countdown
types/
  event.ts
  todo.ts
  settings.ts
  group.ts
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
| group_id              | uuid        | nullable, references groups(id); null = personal event, set = group event |

Notes:
- `is_archived` is **not** used anymore — expired non-recurring events are
  hard-deleted (see cleanup job below) rather than archived.
- Recurring events never get deleted; when their `deadline` passes, a
  scheduled job rolls `deadline` forward to the next matching
  `recurrence_day_of_week`, 7 days later.
- `user_id` still records who created the row even for a group event - it's
  provenance, not an access-control gate, once `group_id` is set (see RLS
  below: any group member may act on a group event regardless of who
  authored it).

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

> `todos.user_id` scopes every row to whoever created it, independent of whether the
> parent event is personal or a group event (`events.group_id` set) - this was
> deliberately designed in from the start so group events could get per-member
> checklists later (docs/milestone3/ARCHITECTURE-milestone-3.md) with no schema or
> RLS change when that milestone arrived. It didn't: a group event with 5 members
> just ends up with up to 5 independent sets of `todos` rows sharing the same
> `event_id`, each already filtered to `user_id = auth.uid()` by the existing policy.

**table: user_settings**
| column               | type    | notes                                          |
|----------------------|---------|--------------------------------------------------|
| user_id              | uuid    | primary key, references auth.users(id)          |
| discord_webhook_url  | text    | nullable — user's own Discord Webhook URL       |
| digest_enabled       | boolean | default true                                    |

**table: groups**
| column       | type        | notes                                          |
|--------------|-------------|--------------------------------------------------|
| id           | uuid        | primary key, default gen_random_uuid()          |
| name         | text        | not null                                        |
| invite_code  | text        | unique, short random string used to join        |
| created_by   | uuid        | references auth.users(id)                       |
| created_at   | timestamptz | default now()                                   |

**table: group_members**
| column     | type        | notes                                          |
|------------|-------------|--------------------------------------------------|
| group_id   | uuid        | references groups(id), not null                 |
| user_id    | uuid        | references auth.users(id), not null             |
| joined_at  | timestamptz | default now()                                   |

Primary key: `(group_id, user_id)`. No `role` column — every member has equal
permissions (docs/PRD.md), including the group's creator.

**table: group_settings**
| column               | type    | notes                                          |
|----------------------|---------|--------------------------------------------------|
| group_id             | uuid    | primary key, references groups(id)              |
| discord_webhook_url  | text    | nullable — the group's own Discord Webhook URL  |
| digest_enabled       | boolean | default true                                    |

**table: profiles**
| column      | type        | notes                                          |
|-------------|-------------|--------------------------------------------------|
| id          | uuid        | primary key, references auth.users(id)          |
| username    | text        | unique, not null                                |
| avatar_url  | text        | nullable — public Supabase Storage URL          |
| created_at  | timestamptz | default now()                                   |

`username`/`created_at` are populated by the `handle_new_user()` trigger (see "Auth Flow"),
never a client insert. `username`/`avatar_url` are user-editable after that (Edit Profile,
from the account menu) - a user may update their own row.

**Storage bucket: avatars** (public read) - one object per user, keyed `{user_id}/avatar`
with no extension (the correct `Content-Type` is set explicitly at upload time instead, so
serving is correct regardless of image format); `upsert: true` on write means changing an
avatar replaces the object rather than accumulating old files. Write policies restrict each
user to their own folder (`(storage.foldername(name))[1] = auth.uid()::text`).

**Row Level Security (RLS)**
- Enable RLS on `events`, `todos`, `user_settings`, `groups`, `group_members`,
  `group_settings`, `profiles`
- `profiles`: select where `auth.uid() = id` **or** the caller shares any group with that
  profile's user (needed for the group member roster and Groups-list avatar previews); update
  where `auth.uid() = id` (Edit Profile) — still no client-facing insert/delete policy; a row
  is only ever created by `handle_new_user()`
- `events`: select/update/delete allowed where
  `user_id = auth.uid() or group_id in (select group_id from group_members where user_id = auth.uid())`
  — insert only needs `user_id = auth.uid()`, since every insert (personal or
  group) sets `user_id` to the acting user regardless of `group_id`
- `todos`, `user_settings`: unchanged from Milestone 1 —
  `user_id = auth.uid()`
- `groups`: **select only** (`id in (select group_id from group_members where user_id = auth.uid())`)
  — no client-facing insert/update/delete policy; a group is only ever
  created via the `create_group()` function below
- `group_members`: **select only**, and self-referencing — a member can see
  every row for a group they themselves belong to (needed for the member
  count), not just their own row. No client-facing insert/update/delete
  policy — joining only happens via `join_group_by_code()` below, so a
  client can never join a group by guessing/knowing its `group_id` alone
- `group_settings`: select/insert/update where
  `group_id in (select group_id from group_members where user_id = auth.uid())`
  (see `supabase/schema.sql` for the exact policies)

## Group Countdown
A group is a shared timeline: same Hero Card/Timeline/color-coding/Recurring
UI as the personal dashboard, just scoped to `group_id` instead of to one
user, with equal edit permissions for every member (docs/PRD.md - no
owner-only tier).

- **Creating and joining both go through `security definer` Postgres
  functions**, never a raw client insert (`groups`/`group_members` have no
  insert policy at all - see RLS above):
  - `create_group(p_name text)`: generates a short unique invite code (retry
    loop on a collision), inserts the group row and the creator's
    `group_members` row together (one function call = one transaction, so a
    partial failure can't leave a group with zero members).
  - `join_group_by_code(p_invite_code text)`: looks up the group by code
    (raises a friendly exception if none matches), inserts the caller's
    `group_members` row.
- **The 10-member cap is enforced with a database trigger**, not just
  application code, so it can't be bypassed by a direct API call:
  a `before insert on group_members` trigger raises an exception once a
  group already has 10 members. It fires regardless of which function (or,
  hypothetically, any other path) performed the insert.
  `modules/groups/groups.service.ts` catches that exception (and the
  invalid-code one) and re-throws the friendly Vietnamese messages the UI
  expects ("Nhóm đã đủ 10 thành viên", etc.) instead of a raw Postgres error.
- **The Group Dashboard reuses Milestone 1's dashboard components
  unchanged** (`Timeline`, `RecurringEventsSection`, `PastEventsSection`,
  `EventForm`, `ConfirmDialog`, `EmptyState`, `HeroCountdownCard`) - only the
  query differs (`getGroupDashboardData(groupId)` instead of
  `getDashboardData(userId)`). Group event cards aren't expandable yet (no
  todo checklist - that's Milestone 3, once "whose checklist is it" for a
  shared event is designed) - `showChecklist={false}` is passed down from
  `GroupDashboardClient.tsx` to suppress it, the one caller that does so.

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
4. Does the same for `group_settings`: every opted-in group's own
   non-recurring events (`group_id = ...`, not filtered by any one member's
   `user_id`), formatted and posted to that group's own
   `discord_webhook_url` — entirely separate from any member's personal
   digest.

Personal and group digests are sent via `Promise.all` (both the two
categories, and every recipient within each) rather than a sequential loop,
so the function's runtime doesn't grow linearly with the number of
users/groups.

This function runs with no signed-in user, so it authenticates with the
Supabase **service-role key** (never the anon key) — the one deliberate
exception to this app's anon-key-only rule elsewhere, since it must act
across every user's (and every group's) data, not one session's.
`SUPABASE_SERVICE_ROLE_KEY` (with `SUPABASE_URL`) is auto-injected into
every Edge Function's environment by Supabase itself - there's no secret to
configure, and `supabase secrets set` refuses to let a reserved
`SUPABASE_`-prefixed name be set manually.

The Settings page's (and the Group Settings modal's) "Send test message"
button is a separate, simpler path: it POSTs directly from the browser to
the webhook URL currently in the form (Discord webhooks accept cross-origin
POSTs) — no Edge Function involved, since that action has a signed-in user
and only needs to talk to Discord.

## Real-Time Countdown Logic
- `useCountdown(deadline)` custom hook:
  - Uses `setInterval` at 1000ms to recompute days/hours/minutes/seconds
    remaining
  - Cleans up the interval on unmount
- Only the nearest (Hero) event uses this live-ticking hook. Other events
  only need a "days remaining" value computed once per render — no need to
  tick every second for those, to avoid unnecessary re-renders.

## Auth Flow
- Supabase Auth, email + password (magic link can be added later)
- Session managed via the Supabase client
- Protected routes redirect to `/login` if there is no active session
- Signup collects a **username** (in addition to email/password/confirm-password), passed as
  `options: { data: { username } }` on `supabase.auth.signUp` - `auth.users` itself can't be
  extended with custom columns, so a `handle_new_user()` trigger (`after insert on
  auth.users`, `security definer`) copies it into a separate `public.profiles` table
  (`id references auth.users`, `username unique not null`). A duplicate username raises a
  clean `'Username already taken'` exception the client translates to a friendly message.
- **Sign in accepts either a username or an email.** An input containing `@` is treated as
  an email directly; otherwise it's resolved to an email first via
  `get_email_for_username(username)` (`security definer`, callable while unauthenticated -
  that's the point) before calling `signInWithPassword`, which only ever accepts an email. A
  username with no matching profile fails with the same generic "invalid credentials"
  message as a wrong password - it never confirms/denies whether a username exists, and
  never reaches Supabase Auth with a non-email string.
- Pre-existing accounts (created before username support existed) simply have no `profiles`
  row and keep signing in by email only - no backfill/migration needed.
