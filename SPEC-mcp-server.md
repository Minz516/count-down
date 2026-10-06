# Spec: `mcp-server` (the `/api/mcp` endpoint)

Part of `SPEC.md`. Depends on: `event-api`. Used by: Claude Code (and `vault-integration`).

## Objective
A remote MCP server, hosted inside this Next.js app, that exposes four tools to Claude Code. It authenticates with a personal access token, translates friendly input (a date, an optional time, a zone) into database calls, and returns short results Claude can relay to the owner.

## Transport and auth
- Route `app/api/mcp/route.ts`, `export const dynamic = "force-dynamic"`, Node runtime. MCP Streamable HTTP in **stateless** mode (each request independent; no server session). `GET` returns 405.
- Auth: `Authorization: Bearer cdt_...`. Missing or malformed header returns HTTP 401 before any database call. The token is passed straight to the `mcp_*` functions, which do the real verification. No cookies, no Supabase user session.
- `proxy.ts` must let `/api/mcp` through without the sign-in redirect and without cookie refresh (explicit path check, covered by a test). This is the only change to the proxy.
- Uses the public anon key only, through a new session-less client in `lib/supabase/anon.ts` (the existing `lib/supabase/server.ts` reads cookies and is not suitable); never the service-role key.
- `proxy.ts`: an exact-path early return for `/api/mcp` placed before any session work. It must not be added to `AUTH_ROUTES`, which bounces signed-in users away.
- Request body size capped (for example 64 KB); no CORS headers (not meant for browsers).
- **Library: `mcp-handler` 2.x**, built on `@modelcontextprotocol/server` v2 and `zod` v4 (Node 20+). It turns tool definitions into a Web-standard `(Request) => Response` handler, is stateless by design, and answers GET and DELETE with 405. The route reads the `Authorization` header itself and builds the handler per request with the token in a closure, so the library's own OAuth-style `withMcpAuth` is not required. Newer clients get the 2026-07-28 protocol revision and older clients are served by the library's fallback.

### Library comparison (recorded for the decision, as of the owner's review)
| Option | Fits inside Next.js? | Notes |
|---|---|---|
| `mcp-handler` 2.x (chosen) | Yes, built for route handlers | Least code; stateless; README is thin on auth details |
| Official SDK v2 + Node adapter | Partly (Node request/response, not Next's) | Most authoritative; more glue to write and test |
| Official SDK v2 + Hono | Yes, adds a second framework | Extra moving part |
| xmcp | Yes, via its Next.js adapter | Own conventions and build setup; auth details unverified |
| FastMCP | No (needs its own long-running server) | Rejected |
| Hand-written JSON messages | Yes | Most work and compatibility risk; rejected |
Older generation (`@modelcontextprotocol/sdk` v1, `mcp-handler` 1.x) gets security fixes for at least six months after v2 but is not a good base for new work.

### Spike first (task 1 of this module, time-boxed to half a day)
Build a "hello" server with one read-only tool at `/api/mcp`, deploy it to a Vercel preview, and prove all of:
1. `claude mcp add --transport http --scope user ...` connects and `/mcp` shows the server connected.
2. `tools/list` shows the tool and calling it returns a result.
3. A missing or wrong `Authorization` header gets HTTP 401 without reaching the database.
4. The route is reachable through `proxy.ts` only because of the explicit exemption; other routes still redirect to `/login`.
5. It behaves the same on the deployed preview as locally (cold start, function duration). **Check first:** Vercel Deployment Protection can put a sign-in wall in front of preview URLs, which would make Claude Code fail to connect for reasons unrelated to our code. Look at the project's Settings, Deployment Protection. If previews are protected, either use Vercel's protection-bypass header in the `--header` flags for the spike, or run the spike against a production deployment of the harmless read-only hello tool (it is still behind our own token). The production domain `chronocount.vercel.app` is the public address.
**Go:** all five pass, then continue with the real tools. **No-go:** any of 1 to 3 cannot be made to work within the time box, then switch to the official SDK v2 with hand-written route glue, record why in this file, and re-run the spike.

## Tools
Server `instructions` tell Claude the rules: resolve relative dates to absolute ones first, default time 23:59 Asia/Ho_Chi_Minh, always pass a stable `external_id` when one exists, never delete without asking the user.

| Tool | Input | Behaviour | Annotations |
|---|---|---|---|
| `create_event` | `name`, `date` (YYYY-MM-DD), `time?` (HH:mm), `timezone?` (IANA, default Asia/Ho_Chi_Minh), `description?`, `external_id?`, `repeats_weekly?` + `day_of_week?` | Creates the event, or updates it if `external_id` already exists. Date-only input becomes 23:59. For weekly repeats the deadline is the next occurrence of that weekday at that time **in the given time zone**, computed by a zone-aware helper in `lib/mcp/time.ts`. The app's existing `nextDeadlineForDayOfWeek` uses the runtime's local zone, which on Vercel is UTC, so it would pick the wrong weekday for late-night Vietnam times. Returns action, id, local and UTC deadline | idempotent |
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
