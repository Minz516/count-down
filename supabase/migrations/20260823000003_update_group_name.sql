-- Renaming is creator-only, same "controlled write path" + ownership-check shape as
-- delete_group() - groups has no client-facing update policy on purpose. Length is
-- enforced by the existing groups_name_length check constraint (mirrored client-side
-- in modules/groups/groups.service.ts, same as create_group() relies on it too).
create or replace function public.update_group_name(p_group_id uuid, p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_group public.groups;
begin
  select created_by into v_created_by from public.groups where id = p_group_id;

  -- Same "one generic exception" reasoning as delete_group() - see its comment.
  if v_created_by is null or v_created_by <> auth.uid() then
    raise exception 'Only the group creator can rename this group';
  end if;

  update public.groups set name = p_name where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$$;
