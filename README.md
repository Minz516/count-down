# Countdown

Track your deadlines with a live, real-time countdown. Personal event tracking plus
shared "Group Countdown" boards for friends/teams, with Discord digest notifications
and in-app alerts.

## Features

- Event CRUD with a live-ticking hero countdown, a unified past/today/future timeline,
  and weekly recurring events that auto-roll forward instead of disappearing
- Per-event todo checklists
- Group Countdown: shared boards joined via invite code, per-member todo checklists,
  a group member roster with avatars
- Username-based auth (sign up with a username, sign in with username or email) plus
  Google OAuth
- Profile editing with avatar upload (Supabase Storage)
- Discord webhook daily digest (personal and per-group), configurable per user/group
- In-app notification bell (event passed / due today / due tomorrow)
- Rate limiting on event creation and group invite-code join attempts
- Optional Sentry error tracking (dormant until a DSN is configured)

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + [Tailwind CSS v4](https://tailwindcss.com)
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, and a scheduled Edge Function
- [Motion](https://motion.dev) for animation, [Phosphor Icons](https://phosphoricons.com)
- No custom backend server — the frontend talks to Supabase directly via `@supabase/ssr`

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase
project's API settings. The app will not run without these — `proxy.ts` needs a Supabase
client to check the session on every request.

Sentry variables in `.env.local.example` are optional; the app builds and runs fine with
them unset.

### 3. Set up the database

In the Supabase SQL editor, run `supabase/schema.sql` — it creates every table (`events`,
`todos`, `user_settings`, `groups`, `group_members`, `group_settings`, `profiles`,
`notifications`), their RLS policies, the `create_group`/`join_group_by_code`/
`get_email_for_username` functions, the signup trigger, and the `avatars` Storage bucket.

Then run `supabase/cleanup_and_rollover.sql`, and any files under `supabase/migrations/`
in timestamp order if they weren't already folded into `schema.sql`.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (also runs the TypeScript check) |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check only, faster than a full build |

## Scheduled job (Discord digest + notifications)

`supabase/functions/daily-digest/` is a Supabase Edge Function that sends the daily
Discord digest (personal and group), rolls recurring events forward, cleans up expired
events, and generates in-app notifications. Deploy and schedule it once, daily:

```bash
supabase functions deploy daily-digest
```

`SUPABASE_SERVICE_ROLE_KEY` is auto-injected by Supabase — nothing to configure there.
Optional: set `DIGEST_CRON_SECRET` to gate its invocation, and `HEALTH_WEBHOOK_URL` for a
Discord alert if a run fails.

## Deployment

- **Frontend:** [Vercel](https://vercel.com) — set the same environment variables from
  `.env.local` in the project's Production (and Preview) environment settings.
- **Backend:** Supabase Cloud — schema and the scheduled function are deployed manually
  (see above), not as part of any build step.

## CI

`.github/workflows/ci.yml` runs lint + build on every push/PR to `main`.
`.github/workflows/backup.yml` runs a weekly `pg_dump` and uploads it as a 90-day GitHub
Actions artifact; it needs a one-time `SUPABASE_DB_URL` repo secret (the direct connection
string, not the pooler one).
