# Todo: Fix navigation lag (see tasks/plan.md)

## Task 1: Production-mode baseline measurement  [XS, no code]
**Description:** Run a production build and record per-route latency so fixes are judged against real numbers.
**Acceptance criteria:**
- [ ] Warm and cold response times recorded for `/`, `/groups`, `/groups/[id]`, `/settings` (RSC fetch + full load)
- [ ] Time of a bare Supabase `/auth/v1/health` ping recorded
**Verification:**
- [ ] `npm run build && npm run start` succeeds; numbers saved in tasks/plan.md or a notes file
**Dependencies:** None
**Files likely touched:** none (notes only)

## Task 2: Check Supabase JWT signing keys  [XS, no code]
**Description:** Confirm whether the project issues asymmetric (JWKS-verifiable) JWTs, which `getClaims()` needs for local verification.
**Acceptance criteria:**
- [ ] Decision recorded: proceed with `getClaims()`, enable asymmetric keys first, or skip T3
**Verification:**
- [ ] The project's `/auth/v1/.well-known/jwks.json` returns a non-empty key set
**Dependencies:** None
**Files likely touched:** none

## Task 3: Local JWT verification in proxy  [S]
**Description:** In `proxy.ts`, replace `supabase.auth.getUser()` with `getClaims()`; set `x-user-id` from `claims.sub`; keep refresh-cookie handling and the existing catch/redirect behavior.
**Acceptance criteria:**
- [ ] Signed-in navigation no longer makes a per-request Auth network call
- [ ] Signed-out, expired-token (refresh), and corrupted-cookie cases still redirect/behave as before
- [ ] `/login` and `/signup` bounce, and `/auth/callback`, unchanged
**Verification:**
- [ ] `npm run lint` and `npm run build` pass
- [ ] Manual: login, logout, clear cookies, corrupt cookie, long-idle session
- [ ] Re-measured route latency drops vs T1 baseline
**Dependencies:** T1, T2
**Files likely touched:** `proxy.ts`

## Checkpoint: after T1-T3
- [ ] lint/build pass, auth flows verified, human review of numbers

## Task 4: Per-route loading skeletons  [M]
**Description:** Add `loading.tsx` for `app/groups`, `app/groups/[groupId]`, `app/settings` with skeletons matching each page's layout (reuse `SkeletonRow`).
**Acceptance criteria:**
- [ ] Clicking a nav tab shows a route-appropriate skeleton immediately
- [ ] No visible layout jump when real content arrives
**Verification:**
- [ ] build passes; manual check with network throttling; follow `.claude/skills/DESIGN.md`
**Dependencies:** None (can run in parallel with T3)
**Files likely touched:** `app/groups/loading.tsx`, `app/groups/[groupId]/loading.tsx`, `app/settings/loading.tsx`

## Task 5: Drop redundant force-dynamic  [XS]
**Description:** Remove `export const dynamic = "force-dynamic"` only where reading `headers()` already makes the page dynamic and it is safe. No `staleTimes` (a stale window was rejected by the user).
**Acceptance criteria:**
- [ ] Pages remain dynamic and never serve one user's data to another
- [ ] After create/edit/delete (events, groups, profile) the UI shows fresh data
**Verification:**
- [ ] lint + build pass; manual mutation checks on every page
**Dependencies:** T4
**Files likely touched:** `app/*/page.tsx` (export lines only)

## Checkpoint: after T4-T5
- [ ] Perceived-speed check with human; no stale-data regressions

## Task 6: Single-query groups list  [M]
**Description:** Replace the listForUser -> member rows -> profiles chain with one embedded select or RPC; keep `GroupDTO`/`preview_avatars` identical. Respect repository rules (explicit user filter, `DatabaseError`).
**Acceptance criteria:**
- [ ] `/groups` makes 1 Supabase request for its data
- [ ] Output (names, counts, preview avatars) identical to before
**Verification:**
- [ ] `npx tsc --noEmit`, lint, build; compare before/after in browser network tab
**Dependencies:** T1 (baseline)
**Files likely touched:** `modules/groups/groups.repository.ts`, `groups.service.ts`, `types/group.ts`, maybe `supabase/migrations/*` (if RPC)

## Task 7: Group detail: fetch members once  [S]
**Description:** `getGroup` and `listGroupMembers` re-query the same members/profiles; derive `preview_avatars` from the single member fetch.
**Acceptance criteria:**
- [ ] Detail page issues each member/profile query once
- [ ] Page output unchanged
**Verification:**
- [ ] tsc/lint/build; network tab comparison
**Dependencies:** T6
**Files likely touched:** `modules/groups/groups.service.ts`, `app/groups/[groupId]/page.tsx`

## Checkpoint: after T6-T7
- [ ] Data parity verified; final latency re-measure vs T1

## Task 8: Profile client shell (optional)  [M]
**Description:** Chrome trace of hydration and the 1s `useCountdown` tick; decide whether to move Nav to a shared layout (note the `onAddEvent` prop) and lazy-load modals.
**Acceptance criteria:**
- [ ] Trace evidence shows whether it matters; follow-up tasks created only if it does
**Dependencies:** T3-T7
**Files likely touched:** TBD after profiling
