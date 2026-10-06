# Todo: Claude Code to Countdown event bridge (see tasks/plan.md and SPEC.md)

Branch convention: one branch per slice from `main` (`feat/mcp-spike`, `feat/mcp-slice-a`, `feat/mcp-update`, `feat/mcp-list`, `feat/mcp-delete`, `feat/mcp-token-polish`, `docs/mcp-vault`), merged in order. Every task meets the Definition of Done in `tasks/plan.md`. Each task touches about 5 files or fewer.

---
## Phase 0

### T0: Spike, `mcp-handler` hello tool  [S]  (branch `feat/mcp-spike`)  - code done, owner checks pending
**Description:** Add the approved libraries, a route `app/api/mcp/route.ts` with one read-only `ping` tool, and an exact-path early return for `/api/mcp` in `proxy.ts` placed before any session work (not in `AUTH_ROUTES`, which would bounce signed-in users). Read the `Authorization` header; 401 without it. No database.
**Acceptance criteria:**
- [ ] **Owner:** `claude mcp add --transport http ...` connects and `/mcp` shows it connected (see the T0 handoff for the exact command)
- [x] `tools/list` shows `ping`; calling it returns a result (tested in-process and over real HTTP on a production build)
- [x] Missing or wrong header gives 401 before any database code (no database exists in the spike)
- [x] Only the exact path `/api/mcp` skips the sign-in redirect; `/api/mcp/x`, `/`, `/groups` still redirect when signed out
- [ ] Same behaviour on a Vercel **preview**, reached with the Protection Bypass header (production stays untouched); the bypass secret is not committed and is revoked afterwards
**Verification:**
- [x] `npx playwright test tests/mcp-spike.spec.ts` (12 tests: proxy rule, 401s, tools/list, tools/call)
- [x] `npm run build`, lint, type-check, bundle budget, full suite (32 tests)
- [ ] Manual: connect from Claude Code locally and on Vercel
**Dependencies:** none
**Files:** `app/api/mcp/route.ts`, `proxy.ts`, `package.json`, `package-lock.json`, `tests/mcp-spike.spec.ts`
**Scope:** Small. If checks 1 to 3 fail within half a day, switch to the official SDK glue and record why in `SPEC-mcp-server.md`.

## Checkpoint 0: Spike go/no-go
- [ ] Library decision confirmed or fallback recorded
- [ ] Review with owner before proceeding

---
## Phase 1: Slice A, Claude Code creates a real event end to end  (branch `feat/mcp-slice-a`)

### T1: Schema and token functions  [M]
**Description:** Migration 1 (`<ts>_mcp_tokens.sql`): `events.external_id` with length check and partial unique index `(user_id, external_id)`; tables `api_tokens` (hash `bytea` unique, prefix, name, created, last used, expiry, revoked) and `api_token_usage`; RLS with column-level grants so `token_hash` is never selectable; `create_api_token`, `revoke_api_token`, internal `api_token_user` (hash lookup, revoked and expiry check, 60 calls per minute, `last_used_at` once a minute). Token is `cdt_` plus 64 hex from two `gen_random_uuid()` values, hashed with `sha256`.
**Acceptance criteria:**
- [ ] Additive only: no `drop` or `alter policy` on existing objects
- [ ] The plain token exists only in the create response
- [ ] Revoked, expired and unknown tokens fail with the same `Invalid token`
- [ ] Maximum 10 active tokens per user
**Verification:** SQL tests of T3 (criteria 3, 7, 8, token limit); `git diff` review of the migration.
**Dependencies:** T0 decision only (no code dependency)
**Files:** `supabase/migrations/<ts>_mcp_tokens.sql`, `types/event.ts`
**Scope:** Medium.

### T2: `mcp_create_event`  [M]
**Description:** Migration 2 (`<ts>_mcp_create_event.sql`): create or update-by-`external_id`, personal events only, same validation as the app (name 200, description 2000, weekly-repeat rule), owner always from the token.
**Acceptance criteria:**
- [ ] Same `external_id` twice returns `updated`, one row
- [ ] Group events are never touched or returned
- [ ] Another user's events are untouchable
**Verification:** SQL tests (criteria 1, 2, 4, 5, 9).
**Dependencies:** T1
**Files:** `supabase/migrations/<ts>_mcp_create_event.sql`
**Scope:** Small to medium.

### T3: SQL tests on PGlite  [M]
**Description:** `tests/sql/mcp-event-api.spec.ts` loads a minimal copy of the app's tables and policies into PGlite, runs migrations 1 and 2 unchanged, and asserts the criteria for T1 and T2 (extended by later slices). Add `@electric-sql/pglite` as a dev dependency (needs approval).
**Acceptance criteria:**
- [ ] Every T1 and T2 criterion is asserted
- [ ] Breaking a function on purpose makes a test fail (proves the tests bite)
**Verification:** `npx playwright test tests/sql` passes locally and in CI.
**Dependencies:** T1, T2
**Files:** `tests/sql/mcp-event-api.spec.ts`, `tests/sql/fixtures.ts`, `package.json`, `package-lock.json`
**Scope:** Medium.

## Checkpoint A1: Database
- [ ] All SQL tests pass; CI green
- [ ] **Owner reviews and runs migrations 1 and 2 in the Supabase SQL editor**; existing app pages still load
- [ ] Review with owner before proceeding

### T4: Zone-aware time helper  [S]
**Description:** `lib/mcp/time.ts`: local date, optional time (default 23:59) and IANA zone (default Asia/Ho_Chi_Minh) to a UTC instant via `Intl`; zone-aware "next occurrence of weekday at time" for weekly events (not the runtime-local `nextDeadlineForDayOfWeek`); reject invalid dates and zones; return local and UTC.
**Acceptance criteria:**
- [ ] 23:59 Ho Chi Minh is 16:59 UTC
- [ ] 31 February and unknown zones rejected with the field named
- [ ] A weekly event at 03:00 Ho Chi Minh Tuesday has the correct weekday even though it is Monday in UTC
- [ ] A DST zone converts correctly
**Verification:** `npx playwright test tests/mcp-time.spec.ts`
**Dependencies:** none
**Files:** `lib/mcp/time.ts`, `tests/mcp-time.spec.ts`
**Scope:** Small.

### T5: Anon client and `modules/mcpevents` (create)  [M]
**Description:** `lib/supabase/anon.ts` (session-less client from `@supabase/supabase-js`, no cookies); `modules/mcpevents` interface, service, repository, dto for `mcp_create_event`; service maps database errors to the safe messages (`Invalid token`, rate limit, invalid input) and never includes the token.
**Acceptance criteria:**
- [ ] No token text in any error message
- [ ] Error mapping covered
**Verification:** `npx playwright test tests/mcpevents.spec.ts` (fake client, same pattern as `tests/groups-rpc.spec.ts`)
**Dependencies:** T2
**Files:** `lib/supabase/anon.ts`, `modules/mcpevents/*` (4), `tests/mcpevents.spec.ts`
**Scope:** Medium.

### T6: `create_event` tool, route wiring, redaction  [M]
**Description:** `lib/mcp/tools/create-event.ts` (zod schema, handler using T4 and T5, result with local and UTC times), tool registry, route builds the handler per request with the token in a closure; add the `cdt_` pattern to `lib/sentryOptions.ts` scrubbing; server `instructions` text.
**Acceptance criteria:**
- [ ] Date-only input stores 23:59 Asia/Ho_Chi_Minh
- [ ] Same `external_id` returns `updated`
- [ ] Invalid fields are named in errors; past dates allowed with a note
- [ ] A `cdt_` token never appears in logs, errors or Sentry payloads
**Verification:** `npx playwright test tests/mcp-tools-create.spec.ts tests/sentry-scrub.spec.ts` (in-process MCP client, fake token RPC)
**Dependencies:** T0, T4, T5
**Files:** `lib/mcp/tools/create-event.ts`, `lib/mcp/registry.ts`, `app/api/mcp/route.ts`, `lib/sentryOptions.ts`, `tests/mcp-tools-create.spec.ts`
**Scope:** Medium.

### T7: `modules/apitokens`  [M]
**Description:** interface, service, repository, dto: list safe columns, `create_api_token`, `revoke_api_token`; friendly error for the limit of 10.
**Acceptance criteria:**
- [ ] `token_hash` is never selected
- [ ] Limit error is human-readable
**Verification:** `npx playwright test tests/apitokens.spec.ts` (fake client)
**Dependencies:** T1
**Files:** `modules/apitokens/*` (4), `types/apitoken.ts`, `tests/apitokens.spec.ts`
**Scope:** Medium.

### T8: Settings section, create, list, revoke  [M]
**Description:** `components/ApiTokensSection.tsx` and `components/ApiTokenCreateDialog.tsx` on `/settings`: list (name, prefix, created, last used, status), create dialog (name; token shown once with copy button and the ready `claude mcp add` command for `https://chronocount.vercel.app/api/mcp`, cleared on close), revoke through `ConfirmDialog`. EN and VI strings.
**Acceptance criteria:**
- [ ] The token is absent from the DOM after the dialog closes
- [ ] Revoke asks first and the row shows revoked
- [ ] Every new string exists in `en` and `vi`
**Verification:** `npx tsc --noEmit` (typed messages), `npm run build`, manual signed-in checklist.
**Dependencies:** T7
**Files:** `components/ApiTokensSection.tsx`, `components/ApiTokenCreateDialog.tsx`, `app/settings/page.tsx`, `lib/i18n/messages.ts`
**Scope:** Medium.

## Checkpoint A: First real event
- [ ] Full CI green (lint, contrast, build, bundle, all tests)
- [ ] **Owner creates a token, registers it with Claude Code, tells it about an event, sees it on the site**
- [ ] Repeating the sentence updates the same event; revoking the token blocks the next call
- [ ] Review with owner before proceeding

---
## Phase 2: Slices B, C, D (independent after A)

### T9: Update, migration and SQL tests  [M]  (branch `feat/mcp-update`)
**Description:** Migration `<ts>_mcp_update_event.sql`: `mcp_update_event(p_token, p_id, p_external_id, p_patch)`, partial update with a whitelist of patch keys; extend the SQL tests.
**Acceptance criteria:**
- [ ] Targets by id or `external_id`; not found is a clear error
- [ ] Only whitelisted keys change; limits and weekly-repeat rule enforced
- [ ] Cannot touch other users' or group events
**Verification:** `npx playwright test tests/sql`
**Dependencies:** Checkpoint A
**Files:** migration, `tests/sql/mcp-event-api.spec.ts`
**Scope:** Medium.

### T10: `update_event` tool  [M]
**Description:** `lib/mcp/tools/update-event.ts`, `mcpevents` update call, contract tests.
**Acceptance criteria:**
- [ ] Moving the date changes only the deadline
- [ ] Unknown event returns "Event not found"
**Verification:** `npx playwright test tests/mcp-tools-update.spec.ts`
**Dependencies:** T9
**Files:** `lib/mcp/tools/update-event.ts`, `lib/mcp/registry.ts`, `modules/mcpevents/*`, `tests/mcp-tools-update.spec.ts`
**Scope:** Medium.

### T11: List, migration and SQL tests  [S]  (branch `feat/mcp-list`)
**Description:** Migration `<ts>_mcp_list_events.sql`: default upcoming, limit 50, cap 200, optional range and text query.
**Acceptance criteria:**
- [ ] Never returns other users' or group events
- [ ] Cap and defaults honoured
**Verification:** `npx playwright test tests/sql`
**Dependencies:** Checkpoint A
**Files:** migration, `tests/sql/mcp-event-api.spec.ts`
**Scope:** Small.

### T12: `list_events` tool  [S]
**Description:** `lib/mcp/tools/list-events.ts` (read-only annotation), contract tests.
**Acceptance criteria:**
- [ ] Results include local and UTC times and the `external_id`
**Verification:** `npx playwright test tests/mcp-tools-list.spec.ts`
**Dependencies:** T11
**Files:** `lib/mcp/tools/list-events.ts`, `lib/mcp/registry.ts`, `modules/mcpevents/*`, `tests/mcp-tools-list.spec.ts`
**Scope:** Small.

### T13: Delete, migration and SQL tests  [S]  (branch `feat/mcp-delete`)
**Description:** Migration `<ts>_mcp_delete_event.sql`: raises unless `p_confirm` is true.
**Acceptance criteria:**
- [ ] Without `confirm` nothing is deleted
- [ ] Cannot delete other users' or group events
**Verification:** `npx playwright test tests/sql`
**Dependencies:** Checkpoint A
**Files:** migration, `tests/sql/mcp-event-api.spec.ts`
**Scope:** Small.

### T14: `delete_event` tool  [S]
**Description:** `lib/mcp/tools/delete-event.ts` with `confirm` required, destructive annotation, contract tests.
**Acceptance criteria:**
- [ ] `confirm: false` or missing is refused by both the tool and the database
- [ ] Result states what was deleted
**Verification:** `npx playwright test tests/mcp-tools-delete.spec.ts`
**Dependencies:** T13
**Files:** `lib/mcp/tools/delete-event.ts`, `lib/mcp/registry.ts`, `modules/mcpevents/*`, `tests/mcp-tools-delete.spec.ts`
**Scope:** Small.

## Checkpoint B: Four tools
- [ ] Full CI green
- [ ] **Owner runs the update, list and delete migrations**; all four tools exercised with real Claude Code
- [ ] Review with owner before proceeding

---
## Phase 3: Slice E, token screen polish  (branch `feat/mcp-token-polish`)

### T15: Expiry, empty state, strings  [S]
**Description:** Optional expiry when creating a token (default none, shown in the list), empty-state copy, complete EN and VI strings.
**Acceptance criteria:**
- [ ] Expired tokens show as expired and are refused by the server
- [ ] Empty state explains what a token is in one sentence
**Verification:** SQL test for expiry; `npx tsc --noEmit`; manual check.
**Dependencies:** Checkpoint A
**Files:** `components/ApiTokenCreateDialog.tsx`, `components/ApiTokensSection.tsx`, `lib/i18n/messages.ts`, `tests/sql/mcp-event-api.spec.ts`
**Scope:** Small.

### T16: Accessibility and mobile pass  [S]
**Description:** axe in light and dark, English and Vietnamese where reachable; 390 px layout; 44 px touch targets.
**Acceptance criteria:**
- [ ] No axe violations; no horizontal overflow at 390 px
**Verification:** extend `tests/a11y.spec.ts` if reachable, otherwise a documented manual run in the PR.
**Dependencies:** T15
**Files:** `tests/a11y.spec.ts`, PR notes
**Scope:** Small.

---
## Phase 4: Slice F, vault integration  (branch `docs/mcp-vault`)

### T17: Setup guide and instruction snippet  [S]
**Description:** `docs/CLAUDE_CODE_EVENTS.md`: create token, `claude mcp add --transport http --scope user countdown https://chronocount.vercel.app/api/mcp --header "Authorization: Bearer <token>"`, `claude mcp list`, rotate and revoke; paste-ready vault instructions from `SPEC-vault-integration.md`.
**Acceptance criteria:**
- [ ] A new machine can be set up from the guide alone
- [ ] Snippet covers date, time, id, order, delete and failure rules
**Verification:** owner follows the guide on a clean shell.
**Dependencies:** Checkpoint B
**Files:** `docs/CLAUDE_CODE_EVENTS.md`
**Scope:** Small.

### T18: Nine manual scenarios  [M]  (with the owner)
**Description:** Run the scenarios of `SPEC-vault-integration.md` with real Claude Code; record pass or fail and wording fixes.
**Acceptance criteria:**
- [ ] All nine pass, or issues are fixed and re-run
**Verification:** results table in the PR description.
**Dependencies:** T17
**Files:** the guide (small fixes)
**Scope:** Medium.

### T19: Wrap-up  [S]
**Description:** Update `CLAUDE.md` (MCP route, token conventions, `lib/supabase/anon.ts`, one migration per slice), mark the spec status, delete spike leftovers.
**Acceptance criteria:**
- [ ] `CLAUDE.md` describes the new conventions; no stale spike code remains
**Verification:** `npm run lint`, `npx tsc --noEmit`, `npm run build`.
**Dependencies:** T18
**Files:** `CLAUDE.md`, `SPEC.md`
**Scope:** Small.

## Checkpoint: Done
- [ ] All nine success criteria of `SPEC.md` met
- [ ] All PRs merged; Definition of Done met for every task
