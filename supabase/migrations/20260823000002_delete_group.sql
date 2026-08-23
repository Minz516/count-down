-- Deletion is creator-only. security definer, same "controlled write path" pattern
-- as create_group()/join_group_by_code() - groups has no client-facing delete policy
-- on purpose. Cascades (group_members, events, group_settings, and transitively
-- todos/notifications) clean up everything else automatically - no manual deletes
-- needed here.
create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  select created_by into v_created_by from public.groups where id = p_group_id;

  -- Deliberately one generic exception for "doesn't exist", "creator's account
  -- was since deleted (created_by went null via on delete set null)", and "caller
  -- isn't the creator" - same "indistinguishable on purpose" reasoning as
  -- groups.repository.ts's getById (don't let this become a group-existence oracle
  -- for non-members, since security definer bypasses the groups SELECT policy).
  if v_created_by is null or v_created_by <> auth.uid() then
    raise exception 'Only the group creator can delete this group';
  end if;

  delete from public.groups where id = p_group_id;
end;
$$;
