# Production Readiness Checklist — Countdown App

## How to Use This File (for Claude Code)
This is not a feature spec — it's an infrastructure/ops audit. For each
section below:
1. Run the "How to Check" steps to see if the item already exists
2. If it exists, check the box and move on
3. If it's missing, follow "If Missing → Implement" and then check the box
4. Do not skip a section just because it feels "too advanced" for a small
   app — instead, the **Priority** label at the end of each section tells
   you whether it's worth doing now or can be deferred. Still verify the
   current state either way.

This checklist applies across all milestones (M1–M4) — it's about the
underlying app as a whole, not any one feature.

---

## 1. APIs & Backend Logic

### Current Design
This app has no custom REST/GraphQL API layer — the Next.js frontend
talks directly to Supabase (Postgres + Auth) via the Supabase JS client.
"Backend logic" lives in two places: Postgres functions (e.g. the
join-group-by-invite-code function from Milestone 2) and Supabase Edge
Functions (the scheduled daily job, the Discord interactions handler).

### Checklist
- [x] No business logic that should be server-side is instead implemented
      only in the client (e.g. the 10-member group cap must be enforced
      by a database trigger, not just a check in a React component) —
      confirmed: `check_group_member_cap()` trigger in `supabase/schema.sql`
- [x] Every Postgres function callable by the client (`join_group`, etc.)
      validates its inputs and uses `SECURITY DEFINER` only where
      genuinely needed, with an explicit comment explaining why — confirmed
      for all of `create_group`/`join_group_by_code`/`is_group_member`/
      `get_email_for_username`/`handle_new_user`
- [x] Edge Functions validate their inputs — N/A in practice: this app never
      built a Discord interactions (inbound slash-command) handler, only the
      one-way outbound `daily-digest` cron function, so there's no inbound
      payload to verify signatures on. Its own *invocation*, however, wasn't
      gated beyond Supabase's default JWT check (which the public anon key
      satisfies trivially) — closed with an optional `DIGEST_CRON_SECRET`
      header check (see `docs/SETUP.md`)
- [x] No API keys or secrets are ever sent to the client — only
      `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      should appear in frontend code — confirmed via
      `grep -r "SERVICE_ROLE" app/ components/ lib/ modules/` (empty)

### How to Check
- `grep -r "SERVICE_ROLE" app/ components/ lib/` — should return nothing;
  the service role key must only appear inside `supabase/functions/`
- Read through each Postgres function's definition in the SQL migration
  files for input validation
- Read through Edge Function code for missing validation/verification

### If Missing → Implement
- Move any client-side-only validation (like the member cap) into a
  Postgres trigger or function
- Add input validation (e.g. with zod) at the top of each Edge Function,
  returning a clear 400 error before doing any work

**Priority: Critical** — a missing server-side check here (like the
member cap) can be bypassed by anyone calling the Supabase API directly.

---

## 2. Database & Storage

### Current Design
Postgres via Supabase. Tables across milestones: `events`, `todos`,
`user_settings`, `groups`, `group_members`, `group_settings`,
`discord_links`, `discord_link_codes`. No file storage (Supabase Storage)
is used yet — nothing in the spec requires uploading files.

### Checklist
- [x] Every foreign key has an explicit `ON DELETE` behavior decided on
      purpose (e.g. deleting a user should cascade-delete their `events`
      and `todos`; deleting a group should cascade-delete its events and
      `group_members` rows) — not left as the Postgres default — confirmed,
      all `cascade` except `groups.created_by` (`set null`, deliberate)
- [x] Indexes exist on columns used in frequent `WHERE`/`ORDER BY`
      clauses: `events(user_id)`, `events(group_id)`, `events(deadline)`,
      `todos(event_id)`, `todos(user_id)`, `group_members(group_id)`,
      `group_members(user_id)` — `events(group_id)`, `todos(user_id)`, and
      `group_members(user_id)` were missing; added in
      `supabase/migrations/20260822000000_production_readiness.sql`
- [x] Text fields that accept free-form user input (`events.name`,
      `events.description`) have a sane length cap so one bad request
      can't insert a multi-megabyte row — added as check constraints
      (`events.name` ≤200, `events.description` ≤2000, `todos.content`
      ≤500, `groups.name` ≤100), mirrored in each module's `*.service.ts`
      and as `maxLength` on the relevant form inputs
- [x] `invite_code` on `groups` has a `UNIQUE` constraint (not just
      "usually unique" — enforced by the database) — confirmed, and
      generated via `gen_random_uuid()` (cryptographically random, not
      sequential)

### How to Check
```sql
-- see all foreign keys and their delete behavior
select conname, confdeltype from pg_constraint where contype = 'f';

-- see existing indexes
select tablename, indexname from pg_indexes where schemaname = 'public';
```

### If Missing → Implement
```sql
alter table events
  add constraint events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index idx_events_user_id on events(user_id);
create index idx_events_group_id on events(group_id);
create index idx_events_deadline on events(deadline);
create index idx_todos_event_id on todos(event_id);
create index idx_todos_user_id on todos(user_id);

alter table events add constraint name_length check (char_length(name) <= 200);
```

**Priority: Important** — missing indexes won't break anything at small
scale but will slow down as data grows; missing cascade deletes can leave
orphaned rows.

---

## 3. Auth & Permissions

### Current Design
Supabase Auth, email + password. Personal data isolated via RLS
(`user_id = auth.uid()`); group data via equal-permission RLS
(`group_id` membership check).

### Checklist
- [x] Row Level Security is **enabled** (not just "has policies") on
      every table containing user data — confirmed via `alter table ...
      enable row level security` on every table in `supabase/schema.sql`
- [x] Email confirmation setting in Supabase Auth is a deliberate choice,
      not left on the default — decide whether users must verify their
      email before first login — confirmed **on** (screenshot review,
      2026-08-23). This meant `supabase.auth.signUp()` returns no session
      until the link is clicked; `AuthForm.tsx` previously redirected to
      the dashboard unconditionally regardless, silently bouncing new
      users back to `/login` via `proxy.ts` — fixed: it now detects the
      no-session case and shows a "Check your email" panel instead
- [x] Session handling: the Supabase client's auto-refresh-token behavior
      is relied on (not disabled), and there's a Next.js middleware or
      layout-level check that redirects unauthenticated users away from
      protected pages — confirmed in `proxy.ts`
- [x] There is no page or API route that reads/writes `events`, `todos`,
      or group data using the service role key from a client-reachable
      code path (that would bypass RLS entirely) — confirmed via the same
      grep as §1

### How to Check
- Supabase Dashboard > Database > Tables — each table should show "RLS
  enabled" (not just "policies: N")
- Supabase Dashboard > Authentication > Settings — check "Confirm email"
- Check for a `middleware.ts` file handling session redirects

### If Missing → Implement
```sql
alter table events enable row level security;
alter table todos enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_settings enable row level security;
alter table user_settings enable row level security;
```
Add a `middleware.ts` that checks for a valid Supabase session and
redirects to `/login` if missing, for all routes except `/login` and
`/signup`.

**Priority: Critical** — this is the single most important section in
the whole checklist; a table with policies defined but RLS not enabled
is **fully open to anyone**, policies or not.

---

## 4. Hosting & Deployment

### Current Design
Vercel for the Next.js frontend, Supabase Cloud for the backend.

### Checklist
- [ ] Production environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set in the Vercel project
      settings, not only in a local `.env.local` — **Vercel dashboard
      setting, can't be checked from the codebase; confirm yourself**
- [x] `npm run build` completes with no TypeScript errors before relying
      on Vercel's build to catch it — confirmed clean (`npx tsc --noEmit`,
      `npm run lint`, `npm run build` all pass) as of this pass, and now
      also enforced automatically by `.github/workflows/ci.yml` on every
      push/PR
- [ ] Preview deployments are enabled for branches/PRs (Vercel does this
      by default — just confirm it's not disabled) — **Vercel dashboard
      setting, confirm yourself**
- [ ] A custom domain is configured if the app is meant to be shared
      with the friend group under a memorable URL (optional) — your call

### How to Check
- Vercel Dashboard > Project > Settings > Environment Variables
- Run `npm run build` locally

### If Missing → Implement
- Add the missing env vars in Vercel's dashboard for the Production
  environment (and Preview, if different values are needed)
- Fix any build errors surfaced locally before they block deployment

**Priority: Critical** — the app literally cannot run in production
without this.

---

## 5. Cloud & Compute

### Current Design
Vercel serverless/edge functions for the Next.js app itself; Supabase
Edge Functions (Deno runtime) for the scheduled daily job and the
Discord interactions handler.

### Checklist
- [x] The Supabase project's region is set close to where most users
      actually are (for this app, likely Singapore, for lowest latency
      from Vietnam) — this cannot be changed after project creation
      without migrating, so it's worth getting right early — checked
      (screenshot, 2026-08-23): currently `ap-northeast-2` (Seoul), not
      Singapore. Reviewed and deliberately deferred - free-plan project
      limit reached, so migrating now isn't possible anyway; revisit and
      migrate to Singapore once that constraint lifts and before there's
      much production data to move
- [x] Edge Function execution time stays well within Supabase's execution
      time limit — confirmed: `sendPersonalDigests`/`sendGroupDigests`/
      `generateNotifications` all run via `Promise.all`, and each
      recipient's Discord POST inside those is also `Promise.all`'d, not a
      sequential loop
- N/A The Discord interactions Edge Function replies within Discord's
      3-second timeout — this app has no inbound Discord interactions
      handler (see §1), only the outbound `daily-digest` cron function, so
      this bullet doesn't apply to anything that was actually built

### How to Check
- Supabase Dashboard > Project Settings > General — check the region
- Read the scheduled job's code for sequential vs. parallel HTTP calls
  (`for` loop with `await` inside vs. `Promise.all`)

### If Missing → Implement
- If the region is wrong, this requires creating a new project in the
  correct region and migrating data — flag this to the user rather than
  doing it silently, since it's disruptive
- Change sequential digest-sending loops to `Promise.all(...)`

**Priority: Important** (region is best fixed early; the rest matters
more as usage grows).

---

## 6. CI/CD & Version Control

### Current Design
Assumed: a GitHub repository, with Vercel auto-deploying on push to
`main`.

### Checklist
- [x] `.gitignore` excludes `.env.local`, `node_modules`, and `.next` —
      confirmed (`.env*`, `/node_modules`, `/.next/`)
- [x] Database schema changes are tracked as versioned SQL migration
      files in the repo (e.g. `supabase/migrations/`), not only applied
      ad hoc through the Supabase SQL Editor — otherwise there's no
      record of what schema state a given commit expects — added
      `supabase/migrations/20260822000000_production_readiness.sql` as
      the first tracked migration; use this directory for future schema
      changes
- [x] A basic CI check (GitHub Actions or similar) runs `npm run build`
      and lint on every pull request, so broken code can't merge silently
      — added `.github/workflows/ci.yml`
- [x] Branch protection on `main`, if more than one person will push code
      — enabled on the GitHub repo (confirmed by user, 2026-08-23)

### How to Check
- `cat .gitignore`
- `ls supabase/migrations` (or wherever migrations would live)
- `ls .github/workflows`

### If Missing → Implement
- Add the standard Next.js `.gitignore` entries if missing
- Use `supabase migration new <name>` going forward instead of only the
  SQL Editor, so every schema change has a corresponding file in the repo
- Add a minimal `.github/workflows/ci.yml` running `npm ci && npm run
  build && npm run lint` on pull requests

**Priority: Important** — not urgent for a solo project today, but
becomes painful to retrofit once the group friends idea means multiple
people might touch the code, or once the schema has evolved through many
undocumented manual changes.

---

## 7. Security & RLS

### Current Design
RLS is the primary security boundary for this app (see Section 3). This
section covers security concerns beyond just "is RLS on."

### Checklist
- [x] Every table has RLS policies for **all four** operations
      (SELECT/INSERT/UPDATE/DELETE) — not just SELECT, which is the most
      common thing to remember and the easiest to forget for the others
      — reviewed every `create policy` in `supabase/schema.sql`:
      `events`/`todos`/`notifications` have all four; `user_settings`/
      `group_settings`/`profiles` are missing only `delete` (deliberate —
      nothing in the app ever deletes those rows directly, they cascade
      from `auth.users`); `groups`/`group_members` are select-only by
      design (writes only via the `security definer` functions)
- [x] The service role key is never present in any file that ships to
      the browser (see Section 1) — confirmed
- [x] `invite_code` values are generated with a cryptographically
      reasonable random source and are long enough to resist guessing
      (e.g. not a short sequential or predictable string) — confirmed,
      `gen_random_uuid()`-derived; brute-force attempts are now also
      rate-limited (see §8)
- [x] Discord Webhook URLs entered by users are validated to actually be
      `https://discord.com/api/webhooks/...` URLs before being saved or
      used by the scheduled job — confirmed,
      `modules/settings/settings.discord.ts`'s `WEBHOOK_URL_PATTERN`
- [x] User-supplied text (event names, descriptions) is never rendered
      with `dangerouslySetInnerHTML` — React's default escaping is
      relied on throughout — confirmed, no matches in `app/`/`components/`

### How to Check
```sql
select tablename, cmd, policyname from pg_policies where schemaname = 'public';
```
Look for each table appearing with all of `select`, `insert`, `update`,
`delete` — a table showing only `select` is missing policies for the
other three operations (meaning nobody could write to it — safe, but
probably not intended — or, if RLS is off, it means those operations are
unrestricted).
```bash
grep -r "dangerouslySetInnerHTML" app/ components/
```

### If Missing → Implement
- Write the missing policies per table (usually the same `using`
  condition repeated across `for select`, `for insert`, `for update`,
  `for delete`)
- Generate `invite_code` with something like
  `encode(gen_random_bytes(6), 'base64')` rather than an incrementing ID
- Add a regex check before saving a webhook URL:
  `^https:\/\/discord\.com\/api\/webhooks\/`

**Priority: Critical.**

---

## 8. Rate Limiting

### Current Design
None implemented yet beyond whatever Supabase Auth applies by default to
its own endpoints (login attempts, signups).

### Checklist
- [x] Group invite-code join attempts are rate-limited per user/IP —
      otherwise a short invite code could be brute-forced by repeated
      guesses — added `group_join_attempts` table + a check in
      `join_group_by_code()` (10 attempts / 10 minutes per user)
- [x] Event creation is rate-limited per user (a basic sanity cap, e.g.
      no more than N events created per minute), to prevent accidental or
      malicious spam from one account — added
      `check_event_creation_rate_limit()` trigger (20 events/minute per
      user), covers both personal and group event creation since both
      always set `user_id` to the acting user
- N/A The Discord slash-command Edge Function has some minimal protection
      against being hammered with requests — no such function exists in
      this app (see §1)

### How to Check
- Search the codebase / Postgres functions for any rate-limiting logic —
  most likely none exists yet
- Check Supabase Dashboard > Authentication > Rate Limits for what's
  already covered (this only covers Auth endpoints, not app tables)

### If Missing → Implement
- Simplest approach for a small app: a `join_attempts` table logging
  `(user_id, group_id_attempted, attempted_at)`, checked by the
  join-group function — reject if more than, say, 10 attempts in the
  last 10 minutes
- For event creation, a similar lightweight check inside the insert
  function/trigger, or simply rely on RLS + reasonable UI throttling for
  the MVP and revisit if abuse is ever observed

**Priority: Nice-to-have for now** — real risk only materializes if the
app is exposed to more than a small trusted friend group, but the invite
code brute-force case is worth doing early since it's cheap to add.

---

## 9. Caching & CDN

### Current Design
Vercel's Edge Network automatically serves static assets (JS/CSS/images)
through its CDN with no extra configuration needed.

### Checklist
- [ ] Static assets are confirmed to be served with appropriate
      `Cache-Control` headers (Vercel's default handles this — just
      confirm nothing in the app is overriding it) — **Vercel default,
      nothing in the codebase overrides it; confirm in the deployed
      Network tab if you want certainty**
- [x] No caching is applied to per-user data (dashboard queries) that
      would risk showing one user's events to another — confirmed, no
      caching layer added anywhere; every page fetches fresh via the
      Supabase client. Previously relied only on `cookies()` usage
      incidentally opting each page out of static rendering - now made
      explicit with `export const dynamic = "force-dynamic"` on
      `app/page.tsx`, `app/groups/page.tsx`, `app/groups/[groupId]/page.tsx`,
      and `app/settings/page.tsx`, so this stays true even if a future
      refactor removes the `cookies()` call

### How to Check
- Inspect response headers in the browser's Network tab for a static
  asset vs. a Supabase data request

### If Missing → Implement
- Nothing to build here for this app's current scale — this section is
  intentionally low-effort. Revisit only if the app grows to have
  genuinely public, shared, cacheable data (it doesn't today).

**Priority: Nice-to-have / mostly N/A** for this app's current shape.

---

## 10. Load Balancing & Scaling

### Current Design
Handled automatically by the platforms chosen: Vercel scales serverless
functions automatically per-request; Supabase manages Postgres with a
connection pooler (PgBouncer) available.

### Checklist
- N/A Serverless/Edge Functions connect to Postgres through Supabase's
      **connection pooler** (port 6543, transaction mode), not the direct
      connection (port 5432) — confirmed this doesn't apply: nothing in
      this codebase opens a raw Postgres connection anywhere (grepped for
      `postgres://`, `:5432`, `:6543` - no matches). Both the frontend
      (`@supabase/ssr`) and the Edge Function (`supabase-js`) talk to
      Supabase over HTTPS/PostgREST, not a direct driver connection, so
      the pooler-port concern doesn't arise
- [ ] Awareness of the current Supabase plan's connection and resource
      limits relative to expected usage — **Supabase dashboard/billing
      info, can't be checked from the codebase; worth a quick look**

### How to Check
- Check the connection string used by the Edge Functions / any
  server-side Supabase client — does it use the pooler port (6543)?
- Supabase Dashboard > Project Settings > Database > Connection Pooling

### If Missing → Implement
- Switch the connection string used server-side to the pooler endpoint

**Priority: Important** for the Edge Functions specifically; not an
issue at all for the frontend, which uses the Supabase client library
(not raw Postgres connections) and doesn't hit this problem.

---

## 11. Error Tracking & Logs

### Current Design
None implemented yet. Supabase does provide basic Edge Function logs in
its dashboard, but nothing is actively monitored or alerted on.

### Checklist
- [x] Runtime errors in the Next.js frontend are captured somewhere
      (e.g. Sentry's free tier), not just silently failing in a user's
      browser with nothing visible to the developer — `@sentry/nextjs`
      wired up (`instrumentation.ts`, `instrumentation-client.ts`,
      `next.config.ts`); dormant until you create a free Sentry account
      and set `NEXT_PUBLIC_SENTRY_DSN` (docs/SETUP.md §4b — an account is
      something only you can create, not automatable)
- [x] The scheduled Edge Function logs clearly on both success and
      failure (not just on failure) so it's possible to confirm it ran,
      not just infer it from the absence of a complaint — added
      `console.log`/`console.error` at each step in
      `supabase/functions/daily-digest/index.ts`
- [x] If the scheduled job fails (e.g. can't reach Discord, a query
      errors out), there's at least a minimal alert — reusing the
      existing Discord webhook mechanism to post a failure notice to a
      dedicated "app health" channel/webhook is a lightweight option that
      fits this stack well — added, opt-in via `HEALTH_WEBHOOK_URL`
      (docs/SETUP.md)

### How to Check
- `grep -r "Sentry" package.json` or similar
- Read the scheduled job's code for `console.log`/`console.error` calls
  and check Supabase's Function Logs dashboard for actual output

### If Missing → Implement
- Add Sentry (or a comparable free-tier error tracker) to the Next.js app
- Wrap the scheduled job's three steps in try/catch blocks that log
  clearly labeled success/failure per step
- Add a small "if anything threw, POST a failure message to this fixed
  webhook" catch-all at the end of the job

**Priority: Important** — without this, a silently broken daily job
(e.g. Discord digests quietly stop sending) could go unnoticed for weeks.

---

## 12. Availability & Recovery

### Current Design
Relies entirely on Supabase's managed Postgres backups.

### Checklist
- [ ] Confirm what backup/retention policy applies on the current
      Supabase plan (free tier has limited backup retention compared to
      paid tiers with point-in-time recovery) — know this number, don't
      assume it — **Supabase dashboard setting (Database > Backups),
      can't be checked from the codebase; confirm yourself**
- [x] A manual backup habit (e.g. a periodic `pg_dump` export saved
      somewhere) exists as a supplement, given free-tier limitations —
      added `.github/workflows/backup.yml` (weekly `pg_dump`, uploaded as
      a 90-day GitHub Actions artifact; also runnable on demand). Needs a
      one-time `SUPABASE_DB_URL` repo secret — see `docs/SETUP.md` §4c
- [ ] The restore process has actually been tested at least once, even
      informally — "we have backups" that have never been restored from
      is an untested assumption, not a guarantee — **exact restore-test
      commands are in `docs/SETUP.md` §4c; run them yourself once a
      backup artifact exists (needs your own machine/Docker, not
      automatable from here)**

### How to Check
- Supabase Dashboard > Database > Backups — see what's actually offered
  on the current plan

### If Missing → Implement
- Set a recurring personal reminder (or, fittingly, a Discord-webhook-
  based monthly reminder!) to run a manual `pg_dump` export
- Do one test restore into a throwaway local Postgres instance to confirm
  the export is actually usable, not just that it was created

**Priority: Nice-to-have for now, given this app's data isn't
mission-critical** — but cheap enough to set up once that there's little
reason to skip it entirely.

---

## Summary Priority Table

| # | Section                        | Priority        |
|---|----------------------------------|------------------|
| 1 | APIs & Backend Logic            | Critical         |
| 2 | Database & Storage               | Important        |
| 3 | Auth & Permissions                | Critical         |
| 4 | Hosting & Deployment              | Critical         |
| 5 | Cloud & Compute                   | Important        |
| 6 | CI/CD & Version Control           | Important        |
| 7 | Security & RLS                    | Critical         |
| 8 | Rate Limiting                     | Nice-to-have*    |
| 9 | Caching & CDN                     | Nice-to-have/N/A |
| 10| Load Balancing & Scaling          | Important        |
| 11| Error Tracking & Logs             | Important        |
| 12| Availability & Recovery           | Nice-to-have     |

\* Except invite-code brute-force protection specifically, which is
cheap and worth doing alongside the Critical items.

**Suggested order of attack:** do all four Critical sections first (1, 3,
4, 7) — they're either "the app doesn't work without this" or "the app is
insecure without this." Then the Important sections. Nice-to-have items
are safe to revisit later, once real usage (beyond Boss and friends)
starts to matter.
