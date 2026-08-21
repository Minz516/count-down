-- Run once in the Supabase SQL editor. See docs/ARCHITECTURE.md for the schema rationale.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  deadline timestamptz not null,
  description text,
  created_at timestamptz not null default now(),
  is_recurring boolean not null default false,
  recurrence_day_of_week smallint check (recurrence_day_of_week between 0 and 6)
);

create index if not exists events_user_id_deadline_idx on public.events (user_id, deadline);

alter table public.events enable row level security;

-- Each user may only ever see/create/edit/delete their own events (docs/PRD.md hard requirement).
create policy "Users can view their own events" on public.events
  for select using (auth.uid() = user_id);

create policy "Users can insert their own events" on public.events
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own events" on public.events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own events" on public.events
  for delete using (auth.uid() = user_id);
