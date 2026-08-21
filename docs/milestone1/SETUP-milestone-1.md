# Setup Guide — Milestone 1: Personal Countdown + Todo Checklist

## Prerequisites
- Node.js 18+
- A Supabase account (https://supabase.com) — free tier is enough

## 1. Create the Supabase Project
1. Create a new project in the Supabase dashboard
2. Open the SQL Editor and run the schema from `ARCHITECTURE-milestone-1.md`
   (the `events`, `todos`, and `user_settings` tables + their RLS policies)
3. In Authentication > Providers, make sure the Email provider is enabled

## 2. Set Up the Scheduled Daily Job
Use a Supabase Edge Function with a cron schedule (Database > Edge
Functions > Scheduled Functions in the dashboard) implementing the three
steps described in `ARCHITECTURE-milestone-1.md` ("Scheduled Daily Job").

## 3. How to Get a Discord Webhook URL
1. In Discord, go to the target channel's Settings > Integrations >
   Webhooks > New Webhook
2. Copy the Webhook URL
3. Paste it into the app's Settings page

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
2. Events CRUD (create, read, update, delete), including
   `is_recurring` / `recurrence_day_of_week`
3. Personal Dashboard page: fetch events, sort by deadline
4. `useCountdown` hook + Hero Countdown Card
5. Timeline component with urgency color coding
6. Recurring Events section
7. Todo Checklist: `todos` table CRUD + expandable per-event UI
8. Settings page: Discord Webhook URL input, enable toggle, test-message
   button
9. Supabase Edge Function (scheduled): hard-delete + recurrence rollover +
   Discord digest send
10. Polish: empty states, loading states, responsive styling

## Next Step
Once this milestone is working end-to-end, continue with
`PRD-milestone-2.md` / `ARCHITECTURE-milestone-2.md` /
`UI_SPEC-milestone-2.md` / `SETUP-milestone-2.md` to add Group Countdown.
