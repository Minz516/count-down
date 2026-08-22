-- OAuth sign-in (Google/Facebook/Discord/GitHub) support: these providers don't collect a
-- username the way AuthForm.tsx's signup form does, so handle_new_user() needs to derive one
-- automatically for that path while leaving the existing username/password path untouched.
-- Run this once in the SQL Editor; schema.sql has also been updated in place.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_base text;
  v_suffix int := 0;
begin
  v_username := new.raw_user_meta_data ->> 'username';

  if v_username is not null then
    -- Our own signup form (AuthForm.tsx) always sets this - a real, user-chosen
    -- username. A collision here is a genuine conflict, not something to paper over.
    begin
      insert into public.profiles (id, username) values (new.id, v_username);
    exception when unique_violation then
      raise exception 'Username already taken';
    end;
    return new;
  end if;

  -- OAuth path: no username was collected, so derive one. Sanitize *each* candidate
  -- before coalescing (not after) - split_part()/->> can return '' rather than null,
  -- which coalesce() would not skip, silently short-circuiting the fallback chain to an
  -- empty string.
  v_base := coalesce(
    nullif(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'user_name'), '[^a-z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'preferred_username'), '[^a-z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(lower(new.raw_user_meta_data ->> 'name'), '[^a-z0-9_]', '', 'g'), ''),
    'user'
  );

  v_username := v_base;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, v_username);
      exit;
    exception when unique_violation then
      -- Auto-generated collision is expected/harmless - retry with a numeric suffix,
      -- same loop-and-retry shape as create_group()'s invite_code collision handling.
      v_suffix := v_suffix + 1;
      if v_suffix > 1000 then
        raise exception 'Could not generate a unique username';
      end if;
      v_username := v_base || v_suffix::text;
    end;
  end loop;

  return new;
end;
$$;
