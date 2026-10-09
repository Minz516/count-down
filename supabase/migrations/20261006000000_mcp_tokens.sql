-- MCP event bridge, slice A, migration 1 of 2: personal access tokens.
-- Safe to run at any time: it only ADDS objects (one nullable column, two
-- tables, four functions) and changes no existing table data, policy or function.
--
-- A token lets Claude Code act for ONE user without a Supabase session. The Next.js route holds no
-- secret of its own: it forwards the token to the token-checked functions below (this migration and
-- the next one), which run as the database owner but always derive the acting user from the token.
-- The service-role key is never used. Row level security on `events` is untouched.

-- ---------------------------------------------------------------------------------------------
-- 1. events.external_id: the stable id from the owner's vault, so repeating an event updates it.
-- ---------------------------------------------------------------------------------------------
alter table public.events add column if not exists external_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_external_id_length' and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_external_id_length
      check (external_id is null or char_length(external_id) between 1 and 200);
  end if;
end $$;

create unique index if not exists events_user_external_id_key
  on public.events (user_id, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------------------------
-- 2. Tokens. Only a SHA-256 hash is stored; the plain text exists in one function result.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash bytea not null unique,
  token_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_tokens_user_id_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;

-- Owners may read their own rows. Writes happen only through the functions below (no write policy).
create policy "Users can view their own tokens" on public.api_tokens
  for select using (auth.uid() = user_id);

-- Supabase grants new tables to anon and authenticated by default. Take that away, then give signed-in
-- users read access to every column EXCEPT token_hash, so even their own hash is never selectable.
revoke all on public.api_tokens from public, anon, authenticated;
grant select (id, user_id, name, token_prefix, created_at, last_used_at, expires_at, revoked_at)
  on public.api_tokens to authenticated;

-- Per-token call counter, one row per token per minute. Touched only by api_token_user().
create table if not exists public.api_token_usage (
  token_id uuid not null references public.api_tokens (id) on delete cascade,
  minute_bucket timestamptz not null,
  calls integer not null default 0,
  primary key (token_id, minute_bucket)
);

alter table public.api_token_usage enable row level security;
revoke all on public.api_token_usage from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------------------------------

-- Create a token for the signed-in user. Returns the plain token ONCE. 'cdt_' plus 64 hex characters
-- from two random UUIDs (about 244 random bits, Postgres built-ins, no extension needed).
create or replace function public.create_api_token(p_name text, p_expires_at timestamptz default null)
returns table (id uuid, token text, token_prefix text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_token text;
  v_id uuid;
  v_created timestamptz;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'Invalid input: name';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Invalid input: expiry';
  end if;
  if (
    select count(*) from public.api_tokens t
    where t.user_id = v_user and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())
  ) >= 10 then
    raise exception 'Token limit reached';
  end if;

  v_token := 'cdt_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.api_tokens (user_id, name, token_hash, token_prefix, expires_at)
  values (v_user, v_name, sha256(convert_to(v_token, 'UTF8')), left(v_token, 8), p_expires_at)
  returning api_tokens.id, api_tokens.created_at into v_id, v_created;

  return query select v_id, v_token, left(v_token, 8), v_created;
end;
$$;

-- Revoke one of the signed-in user's own tokens. Repeating it is harmless.
create or replace function public.revoke_api_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.api_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = p_token_id and user_id = auth.uid();

  if not found then
    raise exception 'Token not found';
  end if;
end;
$$;

-- INTERNAL: resolve a token to its owner, or fail. Called only by the other security definer functions
-- (execute is revoked from every app role below). Unknown, empty, revoked and expired tokens all raise the
-- same 'Invalid token', so a caller learns nothing about which case it hit. Allows 60 successful calls per
-- token per minute.
create or replace function public.api_token_user(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid;
  v_calls integer;
  v_bucket timestamptz := date_trunc('minute', now());
begin
  if p_token is null or p_token = '' then
    raise exception 'Invalid token';
  end if;

  select t.id, t.user_id into v_id, v_user
  from public.api_tokens t
  where t.token_hash = sha256(convert_to(p_token, 'UTF8'))
    and t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now());

  if v_id is null then
    raise exception 'Invalid token';
  end if;

  insert into public.api_token_usage as u (token_id, minute_bucket, calls)
  values (v_id, v_bucket, 1)
  on conflict (token_id, minute_bucket) do update set calls = u.calls + 1
  returning u.calls into v_calls;

  if v_calls > 60 then
    raise exception 'Rate limit reached';
  end if;

  delete from public.api_token_usage where token_id = v_id and minute_bucket < v_bucket - interval '1 hour';

  update public.api_tokens set last_used_at = now()
  where id = v_id and (last_used_at is null or last_used_at < now() - interval '1 minute');

  return v_user;
end;
$$;

-- Supabase also grants new functions to anon and authenticated by default; state exactly who may call what.
revoke execute on function public.create_api_token(text, timestamptz) from public, anon;
grant execute on function public.create_api_token(text, timestamptz) to authenticated;

revoke execute on function public.revoke_api_token(uuid) from public, anon;
grant execute on function public.revoke_api_token(uuid) to authenticated;

revoke execute on function public.api_token_user(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- To undo (the events column is left in place; it is nullable and harmless):
--   drop function if exists public.api_token_user(text);
--   drop function if exists public.revoke_api_token(uuid);
--   drop function if exists public.create_api_token(text, timestamptz);
--   drop table if exists public.api_token_usage;
--   drop table if exists public.api_tokens;
--   drop index if exists public.events_user_external_id_key;
-- ---------------------------------------------------------------------------------------------
