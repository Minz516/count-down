# Spec: `event-api` (database layer for token-based event access)

Part of `SPEC.md`. Depends on: nothing. Used by: `token-ui`, `mcp-server`.

## Objective
Let a holder of a personal access token create, update, list and delete **their own personal events** without a Supabase user session, while keeping row level security as the real boundary and never using the service-role key. Follows the same "controlled write path" pattern as `create_group`, `join_group_by_code` and `delete_group` in `supabase/schema.sql`.

## Data model (migration `<ts>_mcp_event_tokens.sql`)

**events** (existing table, additive):
- `external_id text` null, `check (char_length(external_id) <= 200)`.
- Partial unique index `events_user_external_id_key on events (user_id, external_id) where external_id is not null`. This is what makes a repeated push an update.

**api_tokens** (new):
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk auth.users on delete cascade | owner |
| name | text, 1-60 chars | label such as "Claude Code laptop" |
| token_hash | bytea unique | SHA-256 of the token; never selectable by clients |
| token_prefix | text | first 8 characters, for display only |
| created_at, last_used_at, expires_at (nullable, default none), revoked_at (nullable) | timestamptz | expiry is optional at creation; no default expiry |

RLS: enabled. Owners may `select` their rows but column-level grants expose only `id, name, token_prefix, created_at, last_used_at, expires_at, revoked_at` (never `token_hash`). No insert/update/delete policy: all writes go through the functions below.

**api_token_usage** (new, rate limit): `(token_id, minute_bucket)` with a call counter; RLS enabled with no policies (functions only).

## Token format
`cdt_` followed by 43 base64url characters (256 random bits from `gen_random_bytes(32)`). 256 bits means a fast hash (SHA-256) is appropriate and brute force is infeasible. Generated inside the database function so the plain text exists only in the one response that creates it.

## Functions (all `security definer`, `set search_path = public, extensions`)
Management (callable by `authenticated` only; act on `auth.uid()`):
- `create_api_token(p_name text, p_expires_at timestamptz default null) -> (id, token, token_prefix, created_at)`. Max 10 active tokens per user.
- `revoke_api_token(p_token_id uuid) -> void`. Own tokens only; idempotent.

Token-authenticated (callable by `anon` and `authenticated`, because the Next.js route has no user session):
- `mcp_create_event(p_token, p_name, p_deadline, p_description, p_external_id, p_is_recurring, p_recurrence_day_of_week) -> jsonb {action: "created"|"updated", event}`. If `p_external_id` matches an existing event of the owner, update it instead.
- `mcp_update_event(p_token, p_id uuid, p_external_id text, p_patch jsonb) -> jsonb`. Targets by id or external_id; patch keys limited to name, deadline, description, is_recurring, recurrence_day_of_week.
- `mcp_list_events(p_token, p_from timestamptz, p_to timestamptz, p_query text, p_limit int) -> jsonb`. Default: upcoming, limit 50, hard cap 200.
- `mcp_delete_event(p_token, p_id uuid, p_external_id text, p_confirm boolean) -> jsonb`. Raises unless `p_confirm` is true.

Internal helper `api_token_user(p_token text) -> uuid`: hashes the input, finds a token that is not revoked and not expired, enforces the per-token limit (60 calls per minute), updates `last_used_at` at most once per minute, returns the owner. `revoke execute ... from public, anon, authenticated` (only the definer functions call it). Any failure (unknown, revoked, expired) raises the same message, `Invalid token`, so an attacker learns nothing.

Every `mcp_*` function: only rows with `group_id is null` and `user_id = <owner>`; validates name (1-200), description (<= 2000), recurrence rules identical to the app; relies on the existing events insert trigger for the 20-per-minute creation cap.

## Boundaries
- Always: hash tokens, ignore `p_user_id`-style inputs (owner always comes from the token), mirror the app's validation, keep error text generic for auth failures.
- Ask first: changing existing RLS policies, adding columns beyond `external_id`, granting anything to `anon` other than the four `mcp_*` functions.
- Never: store or return a token after creation, write a function that accepts a user id from the caller, use the service-role key.

## Acceptance criteria and verification
| # | Criterion | Verified by |
|---|---|---|
| 1 | A valid token creates an event for its owner only | PGlite SQL test |
| 2 | Same `external_id` twice results in one event, `action: "updated"` second time | SQL test |
| 3 | Revoked, expired, unknown, empty tokens all fail with `Invalid token` | SQL test |
| 4 | Token A cannot read, update or delete user B's events, by id or external_id | SQL test |
| 5 | Group events are invisible and untouchable through `mcp_*` | SQL test |
| 6 | `mcp_delete_event` without `p_confirm = true` raises and deletes nothing | SQL test |
| 7 | `token_hash` is not selectable by `authenticated`; plain token is not recoverable after creation | SQL test (column privileges) |
| 8 | 61st call within a minute is refused | SQL test |
| 9 | Name/description limits and weekly-repeat rule match the app | SQL test |
| 10 | Existing queries and RLS for events are unchanged | existing app flows plus SQL test comparing policies |

Files likely touched: `supabase/migrations/<ts>_mcp_event_tokens.sql`, `supabase/schema.sql` (fold in later), `types/event.ts` (add `external_id`), `tests/` (SQL verification script runs in CI if PGlite is added as a dev dependency, otherwise documented as a manual step).
