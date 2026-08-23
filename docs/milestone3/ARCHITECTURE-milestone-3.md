# Architecture — Milestone 3: Todo Checklist on Group Events

## Scope
This milestone requires **no schema changes and no new RLS policies**.
It's included here mainly to confirm why, and to note the one thing worth
double-checking.

## Why No Schema Changes Are Needed
From Milestone 1, the `todos` table is defined as:
| column      | type        | notes                                          |
|-------------|-------------|--------------------------------------------------|
| id          | uuid        | primary key                                     |
| event_id    | uuid        | references events(id), not null                 |
| user_id     | uuid        | references auth.users(id), not null             |
| content     | text        | not null                                        |
| is_done     | boolean     | default false                                    |
| position    | integer     |                                                  |
| created_at  | timestamptz | default now()                                   |

Because `todos.user_id` scopes every row to the individual who created
it — independent of whether `events.group_id` is null or set — a group
event with 5 members simply ends up with up to 5 separate sets of `todos`
rows sharing the same `event_id`, each filtered to its own `user_id` by
the existing RLS policy:
```sql
using (user_id = auth.uid())
```
No change needed.

## One Thing to Verify
Double-check that the query used to fetch todos for an expanded event
card filters by **both** `event_id` and the current user, e.g.:
```sql
select * from todos where event_id = :eventId and user_id = auth.uid();
```
Relying on RLS alone is correct and safe, but the query should still
explicitly scope by the current user for clarity and to avoid confusion
in the component code — not because RLS would leak data otherwise.

## Frontend
- Reuse the `TodoChecklist.tsx` component from Milestone 1 unchanged
- Reuse the `EventListItem` / group event card components from
  Milestone 2, adding the expand/collapse behavior that personal event
  cards already have
