import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// A small, faithful copy of the parts of the real schema the MCP functions touch: the tables, the
// row level security policies and the event-creation rate limit trigger, the Supabase roles, and
// Supabase's default privileges (new tables and functions are granted to anon and authenticated,
// which is exactly why the migrations must revoke what they do not want to expose). The real
// migrations under supabase/migrations/*_mcp_*.sql are then applied UNCHANGED on top.

export const ALICE = "00000000-0000-0000-0000-00000000000a";
export const BOB = "00000000-0000-0000-0000-00000000000b";
export const GROUP = "10000000-0000-0000-0000-000000000001";

const BASE_SCHEMA = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;

  create table public.groups (id uuid primary key default gen_random_uuid(), name text not null);
  create table public.group_members (
    group_id uuid not null references public.groups(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    primary key (group_id, user_id));

  create function public.is_group_member(p_group_id uuid) returns boolean language sql security definer
    set search_path = public stable as $$
    select exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid()) $$;

  create table public.events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    deadline timestamptz not null,
    description text,
    created_at timestamptz not null default now(),
    is_recurring boolean not null default false,
    recurrence_day_of_week smallint check (recurrence_day_of_week between 0 and 6),
    group_id uuid references public.groups (id) on delete cascade
  );
  create index events_user_id_deadline_idx on public.events (user_id, deadline);
  alter table public.events
    add constraint events_name_length check (char_length(name) <= 200),
    add constraint events_description_length check (description is null or char_length(description) <= 2000);

  alter table public.events enable row level security;
  create policy "view own or group events" on public.events for select
    using (group_id is null and user_id = auth.uid() or group_id is not null and public.is_group_member(group_id));
  create policy "insert own events" on public.events for insert with check (user_id = auth.uid());
  create policy "update own events" on public.events for update using (user_id = auth.uid());
  create policy "delete own events" on public.events for delete using (user_id = auth.uid());

  -- supabase/migrations/20260823000000_event_creation_rate_limit.sql, verbatim in behaviour
  create function public.check_event_creation_rate_limit() returns trigger language plpgsql as $$
  begin
    if (select count(*) from public.events where user_id = new.user_id and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'Too many events created recently - please wait a moment and try again';
    end if;
    return new;
  end; $$;
  create trigger enforce_event_creation_rate_limit before insert on public.events
    for each row execute function public.check_event_creation_rate_limit();

  grant usage on schema public, auth to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on function auth.uid(), public.is_group_member(uuid) to anon, authenticated;
  -- Supabase grants everything created later to these roles by default.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

/** Every MCP migration, oldest first (`<timestamp>_mcp_<slice>.sql`), so later slices join the tests automatically. */
export function mcpMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /_mcp_.*\.sql$/.test(file))
    .sort();
}

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BASE_SCHEMA);
  for (const id of [ALICE, BOB]) await db.query("insert into auth.users values ($1)", [id]);
  await db.query("insert into public.groups (id, name) values ($1, 'Class')", [GROUP]);
  await db.query("insert into public.group_members values ($1, $2)", [GROUP, ALICE]);
  for (const file of mcpMigrationFiles()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

type Row = Record<string, unknown>;

/** Runs a statement the way PostgREST does for a signed-in user: role authenticated plus JWT claims. */
export async function asUser<T extends Row = Row>(db: PGlite, sub: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; set request.jwt.claims = '{"sub":"${sub}"}'`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role; reset request.jwt.claims");
  }
}

/** Runs a statement as a signed-out caller: role anon, no claims. */
export async function asAnon<T extends Row = Row>(db: PGlite, sql: string, params: unknown[] = []) {
  await db.exec(`set role anon; set request.jwt.claims = ''`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role; reset request.jwt.claims");
  }
}

/** Creates a token for a user through the real function and returns the plain text (shown once in the app). */
export async function makeToken(db: PGlite, sub: string, name = "test token", expiresAt: string | null = null) {
  const [row] = await asUser<{ id: string; token: string; token_prefix: string }>(
    db,
    sub,
    "select * from public.create_api_token($1, $2)",
    [name, expiresAt],
  );
  return row;
}
