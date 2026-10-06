# Todo: Claude Code to Countdown event bridge (see tasks/plan.md and SPEC.md)

Branch convention: one branch per module, `feat/mcp-<module>` from `main`, merged in dependency order. Every task ends with `npm run lint`, `npx tsc --noEmit` and its own verification; no task touches more than about 5 files.

---
## Phase 0: Prove the riskiest assumption

### T0: Spike, `mcp-handler` hello tool  [S]  (branch `feat/mcp-spike`)
**Description:** Add `mcp-handler`, `@modelcontextprotocol/server`, `zod` (approved), a route `app/api/mcp/route.ts` with one read-only `ping` tool, and the exact-path exemption in `proxy.ts`. Read the Authorization header, return 401 without it. No database.
**Acceptance:**
- [ ] `claude mcp add --transport http --scope user ...` connects and `/mcp` shows connected
- [ ] `tools/list` shows `ping`; calling it returns a result
- [ ] Missing or wrong `Authorization` header gives 401 and runs no database code
- [ ] Only `/api/mcp` skips the sign-in redirect; every other route still redirects signed-out users to `/login`
- [ ] Same behaviour on the Vercel deployment (check Deployment Protection first)
**Verification:** manual connection test from Claude Code; a Playwright test for the proxy rule and the 401; `npm run build`.
**Dependencies:** none
**Files:** `app/api/mcp/route.ts`, `proxy.ts`, `package.json`, `package-lock.json`, `tests/mcp-spike.spec.ts`
**Note:** if checks 1 to 3 cannot pass within half a day, switch to the official SDK glue and record why in `SPEC-mcp-server.md`.

### Checkpoint 0: go or no-go
- [ ] Library decision confirmed or fallback recorded; owner reviewed

---
## Phase 1: `event-api` (branch `feat/mcp-event-api`)

### T1: Schema  [S]
**Description:** Migration `supabase/migrations/<ts>_mcp_event_tokens.sql` part A: `events.external_id` (length check), partial unique index `(user_id, external_id)`, tables `api_tokens` and `api_token_usage`, RLS, column-level grants so `token_hash` is never selectable.
**Acceptance:** [ ] additive only; [ ] `token_hash` not selectable by `authenticated`; [ ] existing events RLS unchanged
**Verification:** SQL check on PGlite (T5) plus `git diff` shows no `drop` or `alter policy` on existing objects
**Dependencies:** none  **Files:** the migration, `types/event.ts`

### T2: Token functions  [M]
**Description:** `create_api_token`, `revoke_api_token`, internal `api_token_user` (hash lookup, revoked/expired check, 60 calls per minute, `last_used_at` at most once a minute). Same generic `Invalid token` for every failure.
**Acceptance:** [ ] token plain text exists only in the create response; [ ] max 10 active tokens; [ ] revoked, expired and unknown tokens fail identically; [ ] 61st call in a minute refused
**Verification:** SQL tests criteria 3, 7, 8
**Dependencies:** T1  **Files:** the migration

### T3: `mcp_create_event` and `mcp_update_event`  [M]
**Description:** Create (upsert on `external_id`) and partial update by id or external_id, personal events only, same validation as the app.
**Acceptance:** [ ] same `external_id` twice gives `updated`; [ ] group events invisible; [ ] other users' events untouchable; [ ] name/description limits and weekly-repeat rule enforced
**Verification:** SQL tests criteria 1, 2, 4, 5, 9
**Dependencies:** T2  **Files:** the migration

### T4: `mcp_list_events` and `mcp_delete_event`  [S]
**Description:** List (default upcoming, limit 50, cap 200, optional range and text query) and delete requiring `p_confirm = true`.
**Acceptance:** [ ] delete without confirm raises and removes nothing; [ ] list never returns other users' or group events
**Verification:** SQL tests criteria 4, 5, 6
**Dependencies:** T2  **Files:** the migration

### T5: SQL test harness  [M]
**Description:** A script that loads a minimal copy of the app's tables and policies into PGlite, runs the migration unchanged, and asserts the ten acceptance criteria of `SPEC-event-api.md`. Wire into CI if `@electric-sql/pglite` (dev) is approved.
**Acceptance:** [ ] all ten criteria asserted; [ ] a deliberately broken function makes a test fail (proves the tests bite)
**Verification:** `node tests/sql/mcp-event-api.test.mjs` (or the Playwright runner) passes locally and in CI
**Dependencies:** T1 to T4  **Files:** `tests/sql/*`, `package.json`, `package-lock.json`

### Checkpoint 1: Database layer
- [ ] All SQL tests pass; owner reviews and **runs the migration in Supabase**; manual check query returns expected shapes; app pages still load; PR for `feat/mcp-event-api` merged

---
## Phase 2: parallel slices

### T6: Time helper  [S]  (branch `feat/mcp-server`)
**Description:** `lib/mcp/time.ts`: local date, optional time (default 23:59) and IANA zone (default Asia/Ho_Chi_Minh) to a UTC instant using `Intl`; reject invalid dates and zones; output both local and UTC.
**Acceptance:** [ ] 23:59 Ho Chi Minh is 16:59 UTC; [ ] 31 February rejected; [ ] unknown zone rejected; [ ] a DST zone converts correctly
**Verification:** `npx playwright test tests/mcp-time.spec.ts`
**Dependencies:** none  **Files:** `lib/mcp/time.ts`, `tests/mcp-time.spec.ts`

### T7: `modules/mcpevents`  [M]
**Description:** interface, service, repository and dto for the four `mcp_*` calls (repository throws `DatabaseError`; service maps database errors to the safe messages in the spec).
**Acceptance:** [ ] token never appears in an error message; [ ] errors map to `Invalid token`, rate limit, not found, invalid input
**Verification:** fake-client tests like `tests/groups-rpc.spec.ts`
**Dependencies:** Checkpoint 1  **Files:** `modules/mcpevents/*` (4), `tests/mcpevents.spec.ts`

### T8: Tools `create_event` and `update_event`  [M]
**Description:** zod schemas, handlers, weekly-repeat deadline via the existing helper, server `instructions` text.
**Acceptance:** [ ] date-only input stores 23:59; [ ] same `external_id` returns `updated`; [ ] invalid fields named in errors; [ ] past dates allowed with a note
**Verification:** contract tests with an in-process MCP client and a fake token RPC
**Dependencies:** T0, T6, T7  **Files:** `lib/mcp/tools.ts`, `app/api/mcp/route.ts`, `tests/mcp-tools-write.spec.ts`

### T9: Tools `list_events` and `delete_event`  [M]
**Description:** list with defaults and caps; delete requiring `confirm: true`, destructive and read-only annotations.
**Acceptance:** [ ] delete without confirm deletes nothing; [ ] list returns both local and UTC times
**Verification:** contract tests
**Dependencies:** T8  **Files:** `lib/mcp/tools.ts`, `tests/mcp-tools-read-delete.spec.ts`

### T10: Token redaction  [S]
**Description:** add the `cdt_` pattern to `lib/sentryOptions.ts` scrubbing; assert tokens never reach logs, errors or Sentry payloads.
**Acceptance:** [ ] scrub test redacts `cdt_...` in nested events; [ ] route logs contain no token
**Verification:** extend `tests/sentry-scrub.spec.ts`
**Dependencies:** T8  **Files:** `lib/sentryOptions.ts`, `tests/sentry-scrub.spec.ts`

### T11: `modules/apitokens`  [M]  (branch `feat/mcp-token-ui`)
**Description:** interface, service, repository, dto: list safe columns, call `create_api_token` and `revoke_api_token`, map errors (limit of 10).
**Acceptance:** [ ] `token_hash` never selected; [ ] limit error is friendly
**Verification:** fake-client tests
**Dependencies:** Checkpoint 1  **Files:** `modules/apitokens/*` (4), `types/apitoken.ts`, `tests/apitokens.spec.ts`

### T12: Settings section, list and empty state  [M]
**Description:** `components/ApiTokensSection.tsx` on `/settings`, list columns per spec, empty-state text, EN + VI strings.
**Acceptance:** [ ] shows name, prefix, created, last used, status; [ ] revoked rows kept; [ ] strings in `en` and `vi` (type-check)
**Verification:** build, lint, manual signed-in check
**Dependencies:** T11  **Files:** `components/ApiTokensSection.tsx`, `app/settings/page.tsx`, `lib/i18n/messages.ts`

### T13: Create dialog and revoke  [M]
**Description:** create dialog with `useDialog`, token shown once with a copy button and the ready command (`https://chronocount.vercel.app/api/mcp`), cleared on close; revoke through `ConfirmDialog`.
**Acceptance:** [ ] token absent from the DOM after close; [ ] revoke asks first; [ ] 11th token shows a readable error
**Verification:** manual signed-in checklist plus component-level test where feasible
**Dependencies:** T12  **Files:** `components/ApiTokensSection.tsx`, `components/ApiTokenCreateDialog.tsx`, `lib/i18n/messages.ts`

### T14: Accessibility and mobile pass  [S]
**Description:** axe in light and dark, EN and VI where reachable; 390 px layout; 44 px targets.
**Acceptance:** [ ] no axe violations; [ ] no horizontal overflow
**Verification:** extend the axe test or a documented manual run
**Dependencies:** T13  **Files:** `tests/a11y.spec.ts` (if reachable), notes in the PR

### Checkpoint 2: Both slices
- [ ] CI green (lint, contrast, build, bundle, all tests); **owner creates a real token in Settings and registers it with Claude Code**; `list_events` returns real events; PRs for `feat/mcp-server` and `feat/mcp-token-ui` merged

---
## Phase 3: `vault-integration`

### T15: Setup guide and instruction snippet  [S]  (branch `docs/mcp-vault-integration`)
**Description:** `docs/CLAUDE_CODE_EVENTS.md`: create token, `claude mcp add --transport http --scope user countdown https://chronocount.vercel.app/api/mcp --header ...`, verify with `claude mcp list`, rotate and revoke; the paste-ready vault instruction snippet from `SPEC-vault-integration.md`.
**Acceptance:** [ ] a new machine can be set up from the guide alone; [ ] snippet contains the date, time, id, order, delete and failure rules
**Verification:** owner follows the guide on a clean shell
**Dependencies:** Checkpoint 2  **Files:** `docs/CLAUDE_CODE_EVENTS.md`

### T16: Manual scenarios  [M]  (with the owner)
**Description:** run the nine scenarios of `SPEC-vault-integration.md` with real Claude Code, record pass or fail and any wording fixes.
**Acceptance:** [ ] all nine pass (or issues filed and fixed)
**Verification:** results table in the PR description
**Dependencies:** T15  **Files:** the guide (small fixes)

### Checkpoint 3: Done
- [ ] All nine success criteria of `SPEC.md` met; `CLAUDE.md` updated with the MCP and token conventions; all branches merged; spec files kept in the repo as the record
