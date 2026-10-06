# Spec: `mcp-server` (the `/api/mcp` endpoint)

Part of `SPEC.md`. Depends on: `event-api`. Used by: Claude Code (and `vault-integration`).

## Objective
A remote MCP server, hosted inside this Next.js app, that exposes four tools to Claude Code. It authenticates with a personal access token, translates friendly input (a date, an optional time, a zone) into database calls, and returns short results Claude can relay to the owner.

## Transport and auth
- Route `app/api/mcp/route.ts`, `export const dynamic = "force-dynamic"`, Node runtime. MCP Streamable HTTP in **stateless** mode (each request independent; no server session). `GET` returns 405.
- Auth: `Authorization: Bearer cdt_...`. Missing or malformed header returns HTTP 401 before any database call. The token is passed straight to the `mcp_*` functions, which do the real verification. No cookies, no Supabase user session.
- `proxy.ts` must let `/api/mcp` through without the sign-in redirect and without cookie refresh (explicit path check, covered by a test). This is the only change to the proxy.
- Uses the public anon key only (`lib/supabase` helpers); never the service-role key.
- Request body size capped (for example 64 KB); no CORS headers (not meant for browsers).
- Library choice (official SDK transport in a route handler vs Vercel's `mcp-handler`) is decided at the start of this module after checking current documentation.

## Tools
Server `instructions` tell Claude the rules: resolve relative dates to absolute ones first, default time 23:59 Asia/Ho_Chi_Minh, always pass a stable `external_id` when one exists, never delete without asking the user.

| Tool | Input | Behaviour | Annotations |
|---|---|---|---|
| `create_event` | `name`, `date` (YYYY-MM-DD), `time?` (HH:mm), `timezone?` (IANA, default Asia/Ho_Chi_Minh), `description?`, `external_id?`, `repeats_weekly?` + `day_of_week?` | Creates the event, or updates it if `external_id` already exists. Date-only input becomes 23:59. For weekly repeats the deadline is the next occurrence, using the app's existing helper. Returns action, id, local and UTC deadline | idempotent |
| `update_event` | `id` or `external_id`, plus any of `name`, `date`, `time`, `timezone`, `description`, `repeats_weekly`, `day_of_week` | Partial update. Errors clearly if the event is not found | idempotent |
| `list_events` | `from?`, `to?`, `query?`, `limit?` | Upcoming personal events by default (limit 50, cap 200). Returns id, external_id, name, local deadline, description, repeat info | read-only |
| `delete_event` | `id` or `external_id`, `confirm` (boolean) | Refuses unless `confirm` is true. Returns what was deleted | destructive |

Validation uses zod schemas; limits match the app (name 200, description 2000). Past dates are allowed (the app allows saving past deadlines) but the result notes it.

## Time handling
Local date + time + IANA zone convert to a UTC `timestamptz` using `Intl.DateTimeFormat` (no new date library). Invalid dates (for example 31 February) and unknown zones are rejected with a message naming the field. Output always includes both the local time and the UTC instant so the owner can see what was stored.

## Errors and logging
Map failures to short, safe messages: `Invalid token`, `Rate limit reached, try again in a minute`, `Event not found`, `Invalid input: <field>`. Unexpected errors return a generic message and are captured by Sentry. The token is never logged or included in an error; add the `cdt_` pattern to `lib/sentryOptions.ts` scrubbing and test it.

## Boundaries
- Always: validate input before calling the database; return the stored times back to the user; keep responses small; test every tool at the protocol level.
- Ask first: new dependencies (MCP SDK, zod), adding tools, loosening the rate limit, supporting group events.
- Never: accept a user id from the caller, echo tokens, run without the `confirm` rule for delete, add browser CORS access.

## Acceptance criteria and verification
| # | Criterion | Verified by |
|---|---|---|
| 1 | `initialize` and `tools/list` succeed with a valid token and list exactly four tools | contract test (MCP client in-process) |
| 2 | Each tool works with a valid token and fails with 401 or `Invalid token` otherwise | contract test with a fake database client |
| 3 | `create_event` with only a date stores 23:59 Asia/Ho_Chi_Minh (16:59 UTC) | unit test |
| 4 | Same `external_id` twice returns `updated` the second time | unit + SQL test |
| 5 | `delete_event` without `confirm: true` deletes nothing | unit + SQL test |
| 6 | Invalid dates, zones and over-long fields are rejected with named fields | unit tests |
| 7 | `/api/mcp` is reachable without a session, and every other route still redirects signed-out users to `/login` | proxy test |
| 8 | Tokens never appear in logs, errors or Sentry payloads | scrub test |
| 9 | Real Claude Code can add the server, list tools, and create an event visible on the site | manual end-to-end |

Files likely touched: `app/api/mcp/route.ts`, `lib/mcp/*`, `proxy.ts`, `lib/sentryOptions.ts`, `package.json` (approved dependencies), `modules/events/*` (reuse of the weekly-deadline helper), `tests/mcp-*.spec.ts`, `docs/CLAUDE_CODE_EVENTS.md`.
