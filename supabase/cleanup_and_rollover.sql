-- Run once in the Supabase SQL editor, after enabling the pg_cron extension
-- (Database > Extensions). Schedules a daily job that must run server-side,
-- not client-side, since it has to happen even when no one has the app open
-- (docs/ARCHITECTURE.md "Scheduled Cleanup & Recurrence Rollover").

create extension if not exists pg_cron;

create or replace function public.cleanup_and_roll_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Hard-delete non-recurring events 24h past their deadline. Irreversible.
  delete from public.events
  where is_recurring = false
    and deadline < now() - interval '1 day';

  -- 2. Roll recurring events forward. Adding whole weeks always preserves the
  --    original weekday, so this stays in sync with recurrence_day_of_week
  --    without needing to inspect it. The multiplier is looped in a single
  --    expression (not a fixed +7 days) so an event that's been overdue for
  --    several weeks - e.g. the user was away - still lands on the correct
  --    future occurrence instead of one that's still in the past.
  update public.events
  set deadline = deadline
    + (ceil(extract(epoch from (now() - deadline)) / (7 * 86400))::int * interval '7 days')
  where is_recurring = true
    and deadline < now();
end;
$$;

select cron.schedule(
  'countdown-cleanup-and-rollover',
  '0 3 * * *', -- daily at 03:00 UTC
  $$select public.cleanup_and_roll_events();$$
);
