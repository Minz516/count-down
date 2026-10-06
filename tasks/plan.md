# Implementation Plan: Claude Code to Countdown event bridge (MCP)

Spec: `SPEC.md` plus `SPEC-event-api.md`, `SPEC-token-ui.md`, `SPEC-mcp-server.md`, `SPEC-vault-integration.md`. Task list: `tasks/todo.md`. Status: DRAFT for review, nothing built yet.

Revision 2: re-planned with the `agent-skills:planning-and-task-breakdown` rules. Changes from revision 1: tasks are now **vertical slices** (one complete path at a time) instead of layers; every slice ships its own small migration; token revoke moves into the first slice; code facts found while reading the codebase were folded into the tasks and the spec (see "Findings from reading the code").

## Overview
A hosted MCP server inside this Next.js app (`https://chronocount.vercel.app/api/mcp`) that lets Claude Code create, update, list and delete the owner's personal events using a revocable per-user token. The vault stays the source of truth; each pushed event carries a stable `external_id` (`countdown_id` in the note) so repeats update instead of duplicating.

## Architecture decisions
- **No service-role key.** The route calls token-checked `security definer` functions with the public anon key (same "controlled write path" as `create_group`). Row level security stays the real boundary.
- **Token** = `cdt_` plus 64 hex characters built from two `gen_random_uuid()` values (about 244 random bits, built into Postgres, no `pgcrypto` needed), stored as `sha256`, shown once, revocable, optional expiry (default none), max 10 active, 60 calls per minute per token.
- **Plain Supabase client for the route.** `lib/supabase/server.ts` reads cookies, so the MCP route uses a session-less client from `@supabase/supabase-js` (new `lib/supabase/anon.ts`).
- **Library:** `mcp-handler` 2.x on `@modelcontextprotocol/server` v2 and `zod` v4, proven by a spike first. Fallback: official SDK with hand-written route glue.
- **Time zone:** weekly events need a time-zone-aware "next occurrence". The existing `nextDeadlineForDayOfWeek` uses the runtime's local zone (UTC on Vercel), so the MCP path gets its own zone-aware helper.
- **One migration per slice**, each additive and safe to run on its own, so the owner can review and run them one at a time.
- **One file per tool** (`lib/mcp/tools/<tool>.ts`) plus a small registry, so slices B, C and D do not collide.
- **Tests run in the existing Playwright runner** (`npx playwright test`), including SQL tests on PGlite, so CI needs no new job.
- **Modules** `modules/apitokens/` and `modules/mcpevents/` follow the interface/service/repository layering; the route never calls `supabase.rpc` directly.

## Findings from reading the code
| Finding | Consequence |
|---|---|
| `nextDeadlineForDayOfWeek` (`lib/dateFormat.ts`) uses `Date` local time | New zone-aware helper in `lib/mcp/time.ts` (T4); spec corrected |
| `lib/supabase/server.ts` needs `cookies()` | New `lib/supabase/anon.ts` (T5) |
| `proxy.ts` treats `AUTH_ROUTES` as "bounce signed-in users", so `/api/mcp` cannot be added there | Separate exact-path early return before any session work (T0) |
| Schema uses no `pgcrypto` or `digest()` | Token built from built-ins (`gen_random_uuid`, `sha256`); no extension dependency |
| CI already runs `playwright test` (all files) on Node 20 | SQL and unit tests join it; Node 20 satisfies `mcp-handler` |
| `zod`, `mcp-handler`, `@modelcontextprotocol/server`, `@electric-sql/pglite` not installed | Install in T0 (approved three) and T3 (PGlite needs approval) |
| `app/api/` has no routes now | `app/api/mcp/route.ts` is the only API route |

## Dependency graph
```
T0 spike (library works on Vercel + Claude Code)                 <- riskiest, no database
   |
Slice A: "Claude Code creates a real event end to end"
   T1 schema + token functions -> T2 mcp_create_event -> T3 SQL tests
   T4 time helper    T5 anon client + mcpevents(create)    T6 create_event tool + token redaction
   T7 apitokens module -> T8 Settings: create, list, revoke
   --- checkpoint A (owner runs migration, makes a real token, creates a real event) ---
Slice B update   (T9 migration + SQL tests -> T10 tool)
Slice C list     (T11 migration + SQL tests -> T12 tool)      <- B, C, D independent after A
Slice D delete   (T13 migration + SQL tests -> T14 tool)
   --- checkpoint B (all four tools work with real Claude Code) ---
Slice E token UI polish (T15 expiry + empty state + strings, T16 accessibility + mobile)
Slice F vault integration (T17 guide + snippet, T18 manual scenarios, T19 docs + wrap-up)
```

## Human actions (only the owner can do these)
| When | Action |
|---|---|
| Before T0 check 5 | Create a Protection Bypass for Automation secret in Vercel (Settings, Deployment Protection); keep it private; revoke it after the spike. Standard Protection was confirmed: previews are protected, the production domain is public. Also approve the PGlite dev dependency (needed by T3) |
| Checkpoint A | Run migrations `1` and `2` in the Supabase SQL editor; create a real token in Settings; register it with `claude mcp add` |
| Checkpoint B | Run migrations for update, list and delete as each slice lands |
| Slice F | Run the nine manual scenarios with real Claude Code |
| Every slice | Open and merge each PR (the repo's rules need the owner) |

## Task list

### Phase 0: Prove the riskiest assumption
- [ ] **T0** Spike: `mcp-handler` hello tool at `/api/mcp`, exact-path proxy exemption, connect Claude Code (S)

### Checkpoint 0: Spike go/no-go
- [ ] Five spike checks pass, or the fallback is chosen and recorded in `SPEC-mcp-server.md`

### Phase 1: Slice A, Claude Code creates a real event end to end
- [ ] **T1** Schema and token functions (migration 1) (M)
- [ ] **T2** `mcp_create_event` with `external_id` upsert (migration 2) (M)
- [ ] **T3** SQL tests on PGlite for T1 and T2 (M)

### Checkpoint A1: Database
- [ ] SQL tests pass; owner reviews migrations 1 and 2 and runs them in Supabase; app pages still load

- [ ] **T4** Zone-aware time helper (S)
- [ ] **T5** Anon client and `modules/mcpevents` (create) (M)
- [ ] **T6** `create_event` tool, route wiring, `cdt_` redaction (M)
- [ ] **T7** `modules/apitokens` (create, list, revoke) (M)
- [ ] **T8** Settings section: create (shown once), list, revoke (M)

### Checkpoint A: First real event
- [ ] Full CI green; owner creates a token, registers it, tells Claude Code about an event and sees it on the site; repeating it updates, revoking the token blocks the next call

### Phase 2: Slices B, C, D (independent after A)
- [ ] **T9** Update: migration and SQL tests (M)
- [ ] **T10** `update_event` tool and contract tests (M)
- [ ] **T11** List: migration and SQL tests (S)
- [ ] **T12** `list_events` tool and contract tests (S)
- [ ] **T13** Delete: migration and SQL tests (S)
- [ ] **T14** `delete_event` tool with the `confirm` rule and contract tests (S)

### Checkpoint B: Four tools
- [ ] Full CI green; all four tools exercised with real Claude Code

### Phase 3: Slice E, token screen polish
- [ ] **T15** Optional expiry, empty state, complete EN and VI strings (S)
- [ ] **T16** Accessibility and mobile pass (S)

### Phase 4: Slice F, vault integration
- [ ] **T17** Setup guide and vault instruction snippet (S)
- [ ] **T18** Nine manual scenarios with the owner (M)
- [ ] **T19** `CLAUDE.md` update, spec status, cleanup (S)

### Checkpoint: Done
- [ ] All nine success criteria of `SPEC.md` met; all PRs merged; Definition of Done met for every task

## Parallelization
- After Checkpoint A, slices B, C and D are independent (one migration file and one tool file each). Slice E can run alongside them.
- Strictly sequential: T0 first; T1 then T2 then T3 (same schema); migrations run in timestamp order; each migration run before any real-database test of its tool.
- Contract to fix before parallel work: the `mcp_*` function signatures in `SPEC-event-api.md` and the tool registry shape from T6.

## Definition of Done (every task)
`npm run lint`, `npx tsc --noEmit`, the task's own tests, `npm run build`, `npm run check:bundle`, new text in English and Vietnamese, no token or secret in logs, and one focused commit on the slice's branch.

## Dependency approvals
Already approved: `mcp-handler@^2`, `@modelcontextprotocol/server@^2`, `zod@^4.2`. **Needs approval before T3:** `@electric-sql/pglite` (dev dependency).

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| `mcp-handler` 2.x (new, thin auth docs) fails the spike | High | Spike first, time-boxed; fallback recorded in the spec |
| Vercel Deployment Protection blocks preview URLs | Med | Confirmed on: previews protected, production public. Deployed spike check uses a preview with the bypass header; the secret is never committed and is revoked afterwards |
| A `security definer` function leaks another user's data | High | Owner always from the token; SQL tests for isolation and group events |
| Token leaks via logs or Sentry | High | Never logged; `cdt_` scrubbed (T6); test asserts it |
| A migration breaks the live app | High | Additive only; one small file per slice; rollback `drop` lines included; run only after review |
| Weekly event lands on the wrong weekday (server is UTC) | Med | Zone-aware helper with tests, including late-evening Vietnam times |
| Misheard date creates a wrong or duplicate event | Med | `external_id` upsert; Claude states the absolute date; delete needs `confirm: true` |
| `proxy.ts` exemption widens access | Med | Exact path only; test every other route still redirects |
| Weekly-rollover job and DST zones drift an hour | Low | Existing behaviour of the rollover; Vietnam has no DST; documented |

## Open questions
None blocking. Decisions are recorded in `SPEC.md`.
