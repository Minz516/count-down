-- One round trip for "a group with its members and their profiles".
--
-- Today /groups and /groups/[id] make two sequential Supabase calls: (1) groups + group_members
-- (embedded select), then (2) profiles for those members. From a typical machine each call is
-- ~190 ms, so the page waits ~380 ms on data alone. These two functions return the same data in
-- a single call.
--
-- Safe to run at any time: it only ADDS two read-only functions, changes no table, and the app
-- keeps working without them (modules/groups falls back to the two-call path until they exist).
--
-- Both functions are `security invoker` (the default, stated explicitly): they run as the caller,
-- so every existing row level security policy still applies exactly as it does for the separate
-- queries today:
--   groups          -> "Members can view their groups"            (is_group_member)
--   group_members   -> "Members can view fellow members"          (is_group_member)
--   profiles        -> "Users can view fellow group members' profiles"
-- A group you are not a member of is simply absent, which is indistinguishable from "does not
-- exist" (same behaviour as groups.repository.ts getById).

-- One group, all of its members (oldest-joined first), each with username and avatar_url.
-- Returns NULL when the group does not exist or the caller is not a member.
create or replace function public.get_group_with_members(p_group_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'group', to_jsonb(g) || jsonb_build_object(
      'member_count', (select count(*) from public.group_members gm where gm.group_id = g.id)
    ),
    'members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', gm.user_id,
            'joined_at', gm.joined_at,
            'username', p.username,
            'avatar_url', p.avatar_url
          )
          order by gm.joined_at
        )
        from public.group_members gm
        left join public.profiles p on p.id = gm.user_id
        where gm.group_id = g.id
      ),
      '[]'::jsonb
    )
  )
  from public.groups g
  where g.id = p_group_id;
$$;

-- Every group the caller belongs to (oldest first), each with its full member_count and only the
-- first p_preview_limit members (oldest-joined first) for the avatar facepile on the Groups list.
create or replace function public.list_groups_with_members(p_preview_limit int default 4)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'group', to_jsonb(g) || jsonb_build_object(
          'member_count', (select count(*) from public.group_members gm where gm.group_id = g.id)
        ),
        'members', (
          select coalesce(jsonb_agg(m.member order by m.joined_at), '[]'::jsonb)
          from (
            select
              jsonb_build_object(
                'user_id', gm.user_id,
                'joined_at', gm.joined_at,
                'username', p.username,
                'avatar_url', p.avatar_url
              ) as member,
              gm.joined_at
            from public.group_members gm
            left join public.profiles p on p.id = gm.user_id
            where gm.group_id = g.id
            order by gm.joined_at
            limit p_preview_limit
          ) m
        )
      )
      order by g.created_at
    ),
    '[]'::jsonb
  )
  from public.groups g;
$$;

-- Signed-in users only. Supabase grants new functions to anon by default; with row level security
-- anon would get nothing back, but there is no reason for it to be able to call these at all.
revoke execute on function public.get_group_with_members(uuid) from public, anon;
revoke execute on function public.list_groups_with_members(int) from public, anon;
grant execute on function public.get_group_with_members(uuid) to authenticated;
grant execute on function public.list_groups_with_members(int) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Check after running (SQL editor runs as postgres, so these two see EVERY row, not just yours;
-- use the app or the snippet below to see per-user results):
--
--   select public.list_groups_with_members();
--   select public.get_group_with_members('<a group id>');
--
-- Per-user check, impersonating a signed-in user for one transaction:
--
--   begin;
--   set local role authenticated;
--   set local "request.jwt.claims" = '{"sub": "<your user id>"}';
--   select public.list_groups_with_members();
--   rollback;
--
-- Expected shape (list):  [{"group": {"id": "...", "name": "...", "invite_code": "...",
--   "created_by": "...", "created_at": "...", "member_count": 1},
--   "members": [{"user_id": "...", "joined_at": "...", "username": "...", "avatar_url": null}]}]
--
-- To undo:
--   drop function if exists public.get_group_with_members(uuid);
--   drop function if exists public.list_groups_with_members(int);
-- ---------------------------------------------------------------------------------------------
