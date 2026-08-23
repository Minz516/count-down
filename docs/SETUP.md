# Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (https://supabase.com) — free tier is enough

## 1. Create the Supabase Project
1. Create a new project in the Supabase dashboard
2. Open the SQL Editor and run `supabase/schema.sql` (the `events`, `todos`,
   `user_settings`, `groups`, `group_members`, and `group_settings` tables +
   RLS policies, plus the `create_group`/`join_group_by_code` functions and
   the member-cap trigger - this file already includes the length caps,
   indexes, and invite-code rate limiting from `supabase/migrations/`, so a
   brand-new project doesn't need to separately run that migration file) and
   `supabase/cleanup_and_rollover.sql` (the `cleanup_and_roll_events()`
   function - see `ARCHITECTURE.md`)
3. In Authentication > Providers, make sure the Email provider is enabled
4. In Authentication > Settings, decide deliberately whether "Confirm email"
   should be on before first login (`docs/PRODUCTION_READINESS_CHECKLIST.md`
   §3) - it's a real product decision, not something to leave on whatever the
   default happens to be

If you already have an existing project from before this checklist pass, run
`supabase/migrations/20260822000000_production_readiness.sql` once in the SQL
Editor instead of re-running all of `schema.sql`.

## 2. Set Up the Scheduled Daily Job
Deploy the Edge Function that hard-deletes expired events, rolls recurring
events forward, and sends both the personal and group Discord digests
(`ARCHITECTURE.md` "Discord Digest"):
```bash
supabase functions deploy daily-digest
```
No secret to set up: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
reserved names Supabase auto-injects into every Edge Function's environment
already - the CLI actively rejects trying to set them yourself via
`supabase secrets set` ("Env name cannot start with SUPABASE_"). This key
bypasses RLS, so it's worth knowing it exists even though there's nothing to
configure - see `ARCHITECTURE.md` "Discord Digest" for why the function
needs it at all.

Then schedule it to run once daily via Supabase Dashboard > Edge Functions >
`daily-digest` > Cron.

### Locking down who can invoke it
By default, anyone holding the public anon key (i.e. anyone - it's shipped to
every browser) can trigger this function on demand, since Supabase's default
JWT verification accepts the anon key as a valid caller. To close that
(`docs/PRODUCTION_READINESS_CHECKLIST.md` §1):
1. Set a random secret: `supabase secrets set DIGEST_CRON_SECRET=<a long random string>`
2. Make the scheduled invocation send it as an `x-cron-secret` header. If the
   Dashboard's Cron UI doesn't expose custom headers, schedule it via SQL
   instead (requires the `pg_cron` and `pg_net` extensions):
   ```sql
   select cron.schedule(
     'daily-digest',
     '0 23 * * *', -- 06:00 ICT = 23:00 UTC the previous day
     $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/daily-digest',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <anon-or-service-role-key>',
         'x-cron-secret', '<the same random string from step 1>'
       )
     );
     $$
   );
   ```
The function still works with `DIGEST_CRON_SECRET` unset (the check is
skipped entirely) - this step is optional hardening, not required to get the
digest running at all.

### Optional: failure alerts
Set `HEALTH_WEBHOOK_URL` (`supabase secrets set HEALTH_WEBHOOK_URL=<a Discord
webhook URL>`) to a Discord webhook dedicated to app health, separate from any
user's/group's own digest webhook - the function posts a one-line alert there
if cleanup, a digest send, or notification generation throws
(`docs/PRODUCTION_READINESS_CHECKLIST.md` §11).

## 3. How to Get a Discord Webhook URL
1. In Discord, go to the target channel's Settings > Integrations >
   Webhooks > New Webhook
2. Copy the Webhook URL
3. Paste it into the app's Settings page (personal digest) or a group's
   Group Settings modal (that group's digest) - they're independent

## 4. Environment Variables
Create `.env.local` in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
See `.env.local.example` for the additional optional Sentry variables (below).

## 4b. Optional: Error Tracking (Sentry)
`@sentry/nextjs` is already wired in (`instrumentation.ts`,
`instrumentation-client.ts`, `next.config.ts`) but stays completely inactive
until you provide a DSN - this is a step only you can do, since it requires
creating a third-party account:
1. Create a free project at https://sentry.io (Next.js platform)
2. Copy its DSN into `.env.local` as `NEXT_PUBLIC_SENTRY_DSN`
3. Optional, for readable stack traces (uploads source maps at build time):
   also set `SENTRY_ORG`, `SENTRY_PROJECT`, and an auth token as
   `SENTRY_AUTH_TOKEN` (Sentry > Settings > Auth Tokens)

Leaving all of these unset is fine - the app builds and runs identically
either way (`docs/PRODUCTION_READINESS_CHECKLIST.md` §11).

## 4c. Database Backups
`.github/workflows/backup.yml` runs a weekly `pg_dump` (Sundays, 02:00 UTC) and
uploads the result as a GitHub Actions artifact, kept 90 days - a supplement
to whatever backup/retention Supabase's own plan provides, given free-tier
retention is limited (`docs/PRODUCTION_READINESS_CHECKLIST.md` §12).

**One-time setup:**
1. Get the *direct* database connection string (not the pgbouncer/pooler
   one): Supabase Dashboard > Project Settings > Database > Connection
   string > URI (port 5432). Replace `[YOUR-PASSWORD]` in it with your actual
   database password (same page, or reset it there if you don't have it)
2. Add it as a GitHub repo secret: **Settings > Secrets and variables >
   Actions > New repository secret**, name `SUPABASE_DB_URL`

You can also trigger a backup on demand (e.g. right before a risky migration)
via the Actions tab > Database Backup > **Run workflow**.

**Test a restore at least once** (an untested backup is an assumption, not a
guarantee) - download the artifact from a completed run, then locally:
```bash
# Against a throwaway local Postgres (e.g. via Docker):
docker run -d --name pg-restore-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16
createdb -h localhost -p 5433 -U postgres test_restore
pg_restore -h localhost -p 5433 -U postgres --clean --if-exists -d test_restore backup.dump
```
If that completes without errors, the backup is confirmed usable.

## 5. Install & Run
```bash
npx create-next-app@latest countdown --typescript --tailwind --app
cd countdown
npm install @supabase/supabase-js
npm run dev
```

## 6. Deployment
1. Push the project to GitHub - `.github/workflows/ci.yml` runs `npm run
   lint` and `npm run build` automatically on every push/PR to `main`
2. Import the repo into Vercel
3. Add the same environment variables in the Vercel project settings (plus
   the Sentry ones from step 4b, if you're using it)
4. Deploy

## Suggested Implementation Order (for Claude Code)
1. Supabase client setup + auth pages (login / signup) + RLS policies
2. Events CRUD (Supabase queries: create, read, update, delete), including
   the `is_recurring` / `recurrence_day_of_week` fields
3. Dashboard page: fetch events, sort by deadline
4. `useCountdown` hook + Hero Countdown Card
5. Unified Timeline component with urgency color coding (past/today/
   soon/later)
6. Recurring Events section (separate pinned cards)
7. Todo Checklist: `todos` table CRUD + expandable per-event UI
8. Settings page: Discord Webhook URL input, enable toggle, test-message
   button
9. Edge Function (scheduled): hard-delete + recurrence rollover + Discord
   digest send
10. Polish: empty states, loading states, responsive styling
11. Group Countdown: `groups`/`group_members`/`group_settings` tables +
    member-cap trigger, the `create_group`/`join_group_by_code` functions,
    the updated `events` RLS, the Groups list screen, and the Group
    Dashboard (reusing the personal dashboard's components scoped to
    `group_id`)
12. Extend the Edge Function with the group-digest pass, sent via
    `Promise.all` alongside the personal one
