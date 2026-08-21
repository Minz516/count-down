# Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (https://supabase.com) — free tier is enough

## 1. Create the Supabase Project
1. Create a new project in the Supabase dashboard
2. Open the SQL Editor and run the schema from `ARCHITECTURE.md`
   (the `events` table + RLS policies)
3. In Authentication > Providers, make sure the Email provider is enabled

## 2. Set Up the Scheduled Cleanup Job
This app needs a daily server-side job (not something the browser can do)
to hard-delete expired events and roll recurring events forward. Options:
- Easiest: enable the `pg_cron` extension in Supabase (Database >
  Extensions), then schedule the two SQL statements from
  `ARCHITECTURE.md` ("Scheduled Cleanup & Recurrence Rollover") to run
  once daily
- Alternative: write a Supabase Edge Function and schedule it via
  Supabase's built-in Scheduled Functions

## 3. Environment Variables
Create `.env.local` in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 4. Install & Run
```bash
npx create-next-app@latest countdown --typescript --tailwind --app
cd countdown
npm install @supabase/supabase-js
npm run dev
```

## 5. Deployment
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
7. `pg_cron` (or Edge Function) job for hard-delete + recurrence rollover
8. Polish: empty states, loading states, responsive styling
