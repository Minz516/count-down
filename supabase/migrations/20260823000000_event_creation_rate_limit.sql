-- Production readiness pass, continued (docs/PRODUCTION_READINESS_CHECKLIST.md §8): a
-- basic sanity cap on event creation per user, to prevent accidental or malicious spam
-- from one account. Run this once in the SQL Editor; schema.sql has also been updated in
-- place so a brand-new project setup gets this from one file.
--
-- Fires on every insert into `events` regardless of whether it came through the personal
-- or group-scoped path - both always set `user_id` to the acting user (see
-- events.repository.ts's insert()/insertGroupEvent()), so one trigger covers both. No
-- SECURITY DEFINER needed: the SELECT inside only reads rows the inserting user is already
-- allowed to see under the existing RLS policy (`user_id = auth.uid()`), so it runs fine
-- under the caller's own privileges.
create or replace function public.check_event_creation_rate_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.events
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'Too many events created recently - please wait a moment and try again';
  end if;
  return new;
end;
$$;

create trigger enforce_event_creation_rate_limit
before insert on public.events
for each row execute function public.check_event_creation_rate_limit();
