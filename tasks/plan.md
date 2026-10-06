# Implementation Plan: Claude Code to Countdown event bridge (MCP)

Spec: `SPEC.md` plus `SPEC-event-api.md`, `SPEC-token-ui.md`, `SPEC-mcp-server.md`, `SPEC-vault-integration.md`. Task list: `tasks/todo.md`. Status: DRAFT for review, nothing built yet.

## Overview
A hosted MCP server inside this Next.js app (`https://chronocount.vercel.app/api/mcp`) that lets Claude Code create, update, list and delete the owner's personal events using a revocable per-user token. The vault stays the source of truth; each pushed event carries a stable `external_id` (`countdown_id` in the note) so repeats update instead of duplicating.

## Architecture decisions
- **No service-role key.** The route calls token-checked `security definer` functions with the public anon key, the same "controlled write path" pattern as `create_group`. Row level security stays the real boundary.
- **Token** = `cdt_` plus 256 random bits, stored as SHA-256, shown once, revocable, optional expiry (default none), max 10 active, 60 calls per minute per token.
- **Library:** `mcp-handler` 2.x on `@modelcontextprotocol/server` v2 and `zod` v4, proven by a spike before anything depends on it. Fallback: official SDK with hand-written route glue.
- **Migration is additive and safe to run early.** Same approach as the group-members functions: add objects only, never change existing policies.
- **One branch and one PR per module**, merged in dependency order. Each module leaves `main` working and passing CI.
- **New module `modules/apitokens/`** (token management) and **`modules/mcpevents/`** (token-authenticated event calls) follow the interface/service/repository layering. The route never calls `supabase.rpc` directly.

## Dependency graph
```
spike (mcp-handler works on Vercel + Claude Code)      <- riskiest, no DB needed, goes first
event-api  (migration: tokens, external_id, mcp_* functions, SQL tests)
   |-- token-ui   (Settings: create/list/revoke)
   `-- mcp-server (route, time helper, four tools, scrub, contract tests)   <- also needs the spike result
            `-- vault-integration (setup guide, instruction snippet, manual scenarios)
```

## Human actions (things only the owner can do)
| When | Action |
|---|---|
| Before Phase 1 ends | Check Vercel project Settings, Deployment Protection (are previews protected?) |
| Phase 2 checkpoint | Run the reviewed migration in the Supabase SQL editor |
| Phase 3 checkpoint | Create a real token in Settings (it is shown once); register the server with `claude mcp add` |
| Phase 5 | Run the nine manual scenarios with real Claude Code and confirm results |
| Any time | Open and merge each PR (the repo's rules need the owner) |

## Task list

### Phase 0: Prove the riskiest assumption
- [ ] **T0** Spike: `mcp-handler` hello tool at `/api/mcp`, proxy exemption, connect Claude Code (S)

### Checkpoint 0: Spike go/no-go
- [ ] All five spike checks pass (or fallback chosen and recorded in `SPEC-mcp-server.md`)

### Phase 1: `event-api` (database layer)
- [ ] **T1** Schema: `events.external_id`, `api_tokens`, `api_token_usage`, RLS and column grants (S)
- [ ] **T2** Token functions: `create_api_token`, `revoke_api_token`, internal `api_token_user` with rate limit (M)
- [ ] **T3** `mcp_create_event` and `mcp_update_event` (M)
- [ ] **T4** `mcp_list_events` and `mcp_delete_event` (S)
- [ ] **T5** SQL test harness on PGlite covering the ten criteria of `SPEC-event-api.md` (M)

### Checkpoint 1: Database layer
- [ ] All SQL tests pass; owner reviews and runs the migration in Supabase; manual query check; existing app still works (`npm run build`, groups and events pages load)

### Phase 2: Parallel slices
`mcp-server` and `token-ui` can proceed independently once Checkpoint 1 passes.
- [ ] **T6** Time helper `lib/mcp/time.ts` with tests (S)
- [ ] **T7** `modules/mcpevents` (interface, service, repository, dto) with a fake-client test (M)
- [ ] **T8** Tools `create_event` and `update_event` plus contract tests (M)
- [ ] **T9** Tools `list_events` and `delete_event` plus contract tests (M)
- [ ] **T10** Token redaction in Sentry scrub and log-safety tests (S)
- [ ] **T11** `modules/apitokens` (interface, service, repository, dto) with a fake-client test (M)
- [ ] **T12** Settings section: list and empty state, EN + VI strings (M)
- [ ] **T13** Create dialog (show once, copy, command) and revoke with confirm (M)
- [ ] **T14** Accessibility and mobile pass for the token section (S)

### Checkpoint 2: Both slices
- [ ] Lint, build, bundle budget and all tests pass in CI; token created in the UI works against `/api/mcp` end to end (human)

### Phase 3: `vault-integration`
- [ ] **T15** `docs/CLAUDE_CODE_EVENTS.md`: setup guide and the vault instruction snippet (S)
- [ ] **T16** Run the nine manual scenarios with real Claude Code and record the results (M, with the owner)

### Checkpoint 3: Done
- [ ] All nine success criteria of `SPEC.md` met; `CLAUDE.md` updated with the new conventions; all PRs merged

## Parallelization
- Safe in parallel: T6, T7, T10 (mcp-server prep) with T11 to T14 (token-ui), after Checkpoint 1.
- Strictly sequential: T0 before anything depends on the library; T1 to T4 in order (same migration file); migration run before any real-database test.
- Shared contract to fix first: the `mcp_*` function signatures in `SPEC-event-api.md` (both slices call them).

## Dependency approvals needed
Already approved by the owner: `mcp-handler@^2`, `@modelcontextprotocol/server@^2`, `zod@^4.2`.
**Needs approval before T5:** `@electric-sql/pglite` (dev dependency) so the SQL tests can run in CI. If declined, the SQL tests stay a documented manual script and Checkpoint 1 relies on that.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| `mcp-handler` 2.x (new, thin auth docs) fails the spike | High | Spike first, time-boxed; fallback to official SDK glue recorded in the spec |
| Vercel Deployment Protection blocks preview URLs | Med | Check the setting first; use the bypass header or test on production behind our own token |
| A `security definer` function leaks another user's data | High | Owner always derived from the token; SQL tests prove cross-user isolation and group events untouched |
| Token leaks via logs or Sentry | High | Never logged; `cdt_` pattern scrubbed; test asserts redaction |
| Migration breaks the live app | High | Additive only; run only after review; rollback `drop function`/`drop table` lines included |
| Duplicate or wrong events from misheard dates | Med | `external_id` upsert; Claude states the absolute date; delete needs `confirm: true` |
| `proxy.ts` exemption widens access | Med | Exact path match only; test that all other routes still redirect |
| Rate limits conflict (20 events per minute trigger vs 60 calls per minute) | Low | Token limit is coarse; the existing trigger still caps creation; error messages distinguish them |

## Open questions
None blocking. Decisions are recorded in `SPEC.md`.
