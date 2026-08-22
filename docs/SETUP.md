# Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (https://supabase.com) — free tier is enough

## 1. Create the Supabase Project
1. Create a new project in the Supabase dashboard
2. Open the SQL Editor and run `supabase/schema.sql` (the `events`, `todos`,
   `user_settings`, `groups`, `group_members`, and `group_settings` tables +
   RLS policies, plus the `create_group`/`join_group_by_code` functions and
   the member-cap trigger) and `supabase/cleanup_and_rollover.sql` (the
   `cleanup_and_roll_events()` function - see `ARCHITECTURE.md`)
3. In Authentication > Providers, make sure the Email provider is enabled

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

## 5. Install & Run
```bash
npx create-next-app@latest countdown --typescript --tailwind --app
cd countdown
npm install @supabase/supabase-js
npm run dev
```

## 6. Deployment
1. Push the project to GitHub
2. Import the repo into Vercel
3. Add the same environment variables in the Vercel project settings
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
