# Spec: Countdown event bridge for Claude Code (MCP)

Status: DRAFT for review. Nothing here is built yet. Module specs: `SPEC-event-api.md`, `SPEC-token-ui.md`, `SPEC-mcp-server.md`, `SPEC-vault-integration.md`.

## Objective

When the owner tells Claude Code (terminal) that an event happens on a date, Claude should record it in the Countdown website as well as in the Obsidian vault, so it shows up in the timeline and countdown.

- **User:** one person (the site owner). Not a multi-user feature and not a public API.
- **How:** a hosted MCP server inside this Next.js app (`/api/mcp`) that Claude Code calls with a personal access token. Tools: create, update, list, delete events.
- **Source of truth:** the Obsidian vault. The website receives a one-way push. Each pushed event carries a stable `external_id` from the vault so repeating or correcting an event updates it instead of duplicating it.
- **Why not simply give Claude database access:** the app's security model is row level security with the public anon key. A per-user token plus database functions that act only for that token's owner keeps that model (no service-role key anywhere).

### Decisions made in the interview
| Topic | Decision |
|---|---|
| Target site | The Countdown app (this repo, Supabase) |
| Auth | Dedicated per-user token, stored hashed. No service-role key, no password in config |
| Hosting | Hosted inside this Next.js app, route `/api/mcp` |
| Clients | Claude Code in the terminal only (this computer and others). Claude phone app and claude.ai are OUT of scope, so no OAuth |
| Actions | Create, update/reschedule, list/search, delete/cancel |
| Vault relation | One-way push, vault is master, `external_id` prevents duplicates |
| Date-only input | Time 23:59, time zone Asia/Ho_Chi_Minh unless the user says otherwise |
| Safety | Create and update freely and report back; deletes always wait for the user's yes |

### Assumptions
1. Only personal events (`group_id` is null) are in scope. Group events are not touched. **Confirmed by the owner.**
2. Interface language does not matter here: event names are stored exactly as Claude passes them. The owner phrases the prompt so Claude extracts the event name. **Confirmed by the owner.**
3. The existing weekly-repeat model is enough (`is_recurring` plus `recurrence_day_of_week`); no new recurrence types. **Confirmed by the owner.**
4. Claude Code can call a remote MCP server over HTTP with a bearer token header. **Verified against the current Claude Code docs (code.claude.com/docs/en/mcp):** `claude mcp add --transport http <name> <url> --header "Authorization: Bearer <token>"`; the JSON `type` field also accepts `streamable-http` as an alias for `http`.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `event-api` | Database layer: hashed token table, `external_id` on events, functions that create/update/list/delete personal events for a token's owner, per-token rate limit | none |
| `token-ui` | Settings section to create (shown once), list and revoke tokens | `event-api` |
| `mcp-server` | `/api/mcp` route: token check, four tools, date/time handling, error mapping | `event-api` |
| `vault-integration` | Instructions that make Claude Code call the tools at the right moments, with stable ids and the safety rules | `mcp-server` |

Build order: `event-api` -> `token-ui` and `mcp-server` (parallel) -> `vault-integration`

## Tech stack
Existing: Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres + RLS), Tailwind v4, Playwright for tests.
New (each needs approval before install):
- `@modelcontextprotocol/sdk` for the MCP protocol (Streamable HTTP, stateless). Alternative to evaluate: Vercel's `mcp-handler` adapter. Decide in `mcp-server` after reading the current docs.
- `zod` (already a dependency of the MCP SDK) for tool input schemas.

## Commands
```
Dev:        npm run dev
Build:      npm run build
Type-check: npx tsc --noEmit
Lint:       npm run lint
Unit tests: npx playwright test tests/<file>.spec.ts
All checks: npm run lint && npm run check:contrast && npm run build && npm run check:bundle && npm run test:a11y
Claude Code (user side; syntax verified in the docs):
  claude mcp add --transport http --scope user countdown https://<site-domain>/api/mcp --header "Authorization: Bearer <token>"
  claude mcp list        # shows configured servers
  /mcp                   # inside Claude Code: connection status
  claude mcp remove countdown
```

## Project structure (new files only)
```
supabase/migrations/<ts>_mcp_event_tokens.sql   tokens table, events.external_id, mcp_* functions
modules/apitokens/                              interface/service/repository/dto (same layering as other modules)
app/api/mcp/route.ts                            MCP endpoint (POST), token auth, no cookies
lib/mcp/                                        tool definitions, date/time conversion, error mapping
components/ApiTokensSection.tsx                 Settings UI (create, list, revoke)
lib/i18n/messages.ts                            new EN + VI strings for the token UI
tests/mcp-*.spec.ts                             unit/contract tests (fake client pattern, as tests/groups-rpc.spec.ts)
docs/CLAUDE_CODE_EVENTS.md                      setup guide and the vault instruction snippet
```

## Code style
Follow the module layer in `CLAUDE.md` (interface -> service -> repository; repositories throw `DatabaseError`). One real example of the house style for a repository call that must not leak secrets:

```ts
async createEventForToken(supabase: SupabaseClient, token: string, input: McpEventInput): Promise<McpEventResult> {
  const { data, error } = await supabase.rpc("mcp_create_event", { p_token: token, ...toRpcArgs(input) });
  if (error) throw new DatabaseError(error.message); // never include the token in a message or log
  return data as McpEventResult;
}
```
Conventions: hyphen, never em-dash, in all text; no hardcoded UI strings (EN + VI in `messages.ts`); every input has a name and label; modals use `useDialog`.

## Testing strategy
| Level | What | How |
|---|---|---|
| SQL | Token hashing, revoked/expired tokens, ownership, `external_id` upsert, rate limit, RLS unchanged | Run the migration on an in-memory Postgres (PGlite) with the app's RLS policies, as was done for `group_with_members` |
| Unit | Date/time conversion (23:59 default, Asia/Ho_Chi_Minh, DST zones), tool input validation, error mapping | Playwright test runner, fake Supabase client |
| Contract | MCP protocol: initialize, list tools, call each tool, reject bad/missing token | MCP SDK client against the route handler in-process |
| UI | Token section accessible (axe), create shows token once, revoke asks to confirm | Existing a11y suite plus new cases (signed-in screens need a real project: manual checklist) |
| End to end | Say an event in Claude Code, see it on the site; repeat it, no duplicate; cancel it, Claude asks first | Manual checklist in `SPEC-vault-integration.md` |
CI keeps running lint, contrast, build, bundle budget and the Playwright tests; new tests join `npm run test:a11y`'s runner.

## Boundaries
- **Always:** act only for the token's owner; store only the token hash; show a token once; validate every input against the same limits as the app (name 200, description 2000); return clear errors that never include secrets; keep EN + VI strings together; run the full check list before a PR; work on a new branch per module.
- **Ask first:** adding dependencies; any new table or column; changing `proxy.ts` or the auth model; changing existing RLS policies; touching group events; raising the rate limit; writing to the vault from the server.
- **Never:** use or add the Supabase service-role key; log or return tokens (plain text) after creation; put a token in a URL or query string; commit a token or `.env` file; let a token act on another user's data; delete without the explicit `confirm` flag; skip tests to get green.

## Success criteria
1. Telling Claude Code "my passport appointment is 20 November" produces one event on the site for that date at 23:59 (Asia/Ho_Chi_Minh), without further prompting, within 5 seconds.
2. Saying it again, or correcting the date, updates the same event (no duplicate), because the `external_id` matches.
3. "Cancel it" makes Claude ask for confirmation; only after "yes" is the event deleted. The server also refuses a delete without `confirm: true`.
4. A revoked, expired or random token is rejected with the same generic error, and nothing changes in the database.
5. A token can never read or change another user's events, proven by SQL tests.
6. Creating more than the rate limit in a minute is refused with a clear message.
7. No token or webhook URL appears in logs, Sentry events, or API responses (checked by tests).
8. All new text exists in English and Vietnamese; new UI passes the axe check in both themes.
9. `npm run lint`, `build`, `check:bundle`, and all tests pass in CI.

## Open questions
1. **Library check (still open):** whether the MCP SDK's Streamable HTTP transport works in a Next.js route handler as-is or needs Vercel's `mcp-handler`. Resolve at the start of `mcp-server` by reading the current docs. (The Claude Code side of this question is answered: see assumption 4.)
1b. **Where the token lives on the owner's machine:** `--scope user` stores the header in `~/.claude.json`, outside any repo (good: it cannot be committed). Using `.mcp.json` with `${COUNTDOWN_TOKEN}` would also work but must never be placed in a synced or committed folder such as the vault. Proposal: user scope, documented in the setup guide.
2. **Token expiry:** never expire by default, or default to 1 year with a visible expiry? (Proposal: optional expiry, default none, shown in the list.)
3. **Existing events:** should the first push back-fill events already on the site that match vault notes, or only handle new ones? (Proposal: new only.)
4. **Vault id field name:** where in the vault note to keep the stable id (proposal: a `countdown_id` frontmatter property).
5. **Domain:** the production URL the token will be used against (needed for the setup guide).
