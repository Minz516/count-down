# Architecture — Milestone 2: Group Countdown

## Scope
This builds directly on `ARCHITECTURE-milestone-1.md`. Only the new/changed
pieces are described here — the tech stack, `useCountdown` hook, color
coding thresholds, and cleanup/rollover job logic from Milestone 1 are
unchanged and reused as-is.

## Folder Structure Additions
```
app/
  groups/page.tsx           -> list of groups + create/join
  groups/[groupId]/page.tsx -> one group's dashboard
types/
  group.ts
```

## Schema Changes

**events table — add one column:**
| column     | type | notes                                                    |
|------------|------|-----------------------------------------------------------|
| group_id   | uuid | nullable, references groups(id). null = personal event, set = group event |

**table: groups**
| column       | type        | notes                                          |
|--------------|-------------|--------------------------------------------------|
| id           | uuid        | primary key, default gen_random_uuid()          |
| name         | text        | not null                                        |
| invite_code  | text        | unique, short random string used to join        |
| created_by   | uuid        | references auth.users(id)                       |
| created_at   | timestamptz | default now()                                   |

**table: group_members**
| column     | type        | notes                                          |
|------------|-------------|--------------------------------------------------|
| group_id   | uuid        | references groups(id), not null                 |
| user_id    | uuid        | references auth.users(id), not null             |
| joined_at  | timestamptz | default now()                                   |

Primary key: `(group_id, user_id)`. No `role` column — all members have
equal permissions per the PRD.

**table: group_settings**
| column               | type    | notes                                          |
|----------------------|---------|--------------------------------------------------|
| group_id             | uuid    | primary key, references groups(id)              |
| discord_webhook_url  | text    | nullable — the group's own Discord Webhook URL  |
| digest_enabled       | boolean | default true                                    |

## Enforcing the 10-Member Cap
Enforce this at the database level, not just in application code, so it
can't be bypassed:
```sql
create or replace function check_group_member_cap()
returns trigger as $$
begin
  if (select count(*) from group_members where group_id = new.group_id) >= 10 then
    raise exception 'Group has reached the 10-member limit';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_group_member_cap
before insert on group_members
for each row execute function check_group_member_cap();
```
The frontend should catch this error and show a friendly message
("Nhóm đã đủ 10 thành viên") rather than a raw Postgres error.

## Row Level Security (RLS) Changes

**events** — replace the Milestone 1 policy with one that covers both
personal and group ownership:
```sql
using (
  user_id = auth.uid()
  or group_id in (
    select group_id from group_members where user_id = auth.uid()
  )
)
```
Apply this to select/insert/update/delete — any group member can fully
manage any event in a group they belong to.

**groups / group_members** — a user can only see a group's row if they
have a matching `group_members` entry. Joining a group happens through a
Postgres function (not a raw insert from the client) that:
1. Looks up the group by `invite_code`
2. Checks the 10-member cap (the trigger above also guards this)
3. Inserts the `group_members` row for `auth.uid()`

This avoids exposing `group_id` values or letting the RLS policy be the
only gate on joining.

**group_settings** — readable/writable only by members of that group:
```sql
using (
  group_id in (
    select group_id from group_members where user_id = auth.uid()
  )
)
```

## Sorting & Priority Logic (Group Dashboard)
Same rules as the personal dashboard in Milestone 1, just filtered by
`group_id = <the selected group>` instead of `user_id = auth.uid() and
group_id is null`. The Hero Card, Timeline, color coding, and Recurring
section components are reused unchanged — only the query differs.

## Scheduled Daily Job — Extend Milestone 1's Function
Add a second digest step to the same Edge Function from Milestone 1:
- For every row in `group_settings` where `discord_webhook_url` is set
  and `digest_enabled = true`, fetch that group's events
  (`group_id = <that group>`) with `deadline` between now and now + 7
  days, format as a plain-text Discord message, `POST` to the group's
  `discord_webhook_url`
- Send all digests (personal + group) with `Promise.all` rather than a
  sequential loop, to avoid the function timing out as the number of
  users/groups grows
