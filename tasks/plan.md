# Implementation Plan: Fix navigation lag

## Overview
Navigation between pages feels slow. A performance audit (dev server, localhost:3001) measured a ~540ms warm
per-request floor on every route regardless of page queries. The floor is the remote `supabase.auth.getUser()`
in `proxy.ts` (runs on every page request and every RSC/soft-nav fetch). Secondary causes: serial query chains in
the groups module, no per-route loading skeletons (every page is `force-dynamic`), and `Nav` remounting per page.
Tasks are ordered by measured impact. Tasks tracked in `tasks/todo.md`.

## Architecture Decisions
- Measure first (T1): the audit ran on `next dev`; baseline must come from `npm run build && npm run start` so we
  fix real costs, not Turbopack compile overhead.
- Proxy auth: switch to `supabase.auth.getClaims()` (local JWT verify via cached JWKS). Requires asymmetric JWT
  signing keys enabled in the Supabase project; if the project still uses the legacy HS256 secret, `getClaims()`
  falls back to a network call and gains nothing. Check this before coding (T2). `x-user-id` comes from claims `sub`.
- Keep RLS as the real boundary (unchanged) - the proxy header is already documented as non-authoritative.
- Group queries stay inside `groups.repository.ts` (one embedded select/RPC); DTO shape (`GroupDTO.preview_avatars`)
  must not change so components are untouched.
- Preserve the existing try/catch in proxy.ts (corrupt-cookie handling from commit 0b0f33b).

## Task List

### Phase 0: Baseline
- [ ] T1: Production-mode baseline measurement
- [ ] T2: Check Supabase JWT signing-key setup (decision gate for T3)

### Checkpoint: Baseline
- [ ] Numbers recorded; decision made on T3 approach

### Phase 1: Biggest win
- [ ] T3: Replace `getUser()` in proxy with local claims verification

### Checkpoint: Proxy
- [ ] lint + build pass; login, logout, expired-session, bad-cookie flows still work; per-route latency re-measured

### Phase 2: Perceived speed
- [ ] T4: Per-route `loading.tsx` skeletons (groups, groups/[groupId], settings)
- [ ] T5: Drop redundant `force-dynamic` where safe (no `staleTimes` - a stale window was rejected)

### Checkpoint: Perceived speed
- [ ] Tab switching shows skeleton instantly; no stale data after mutations

### Phase 3: Data fetching
- [ ] T6: Collapse groups list query chain (`listForUser` -> members -> profiles) into one query
- [ ] T7: Group detail page: stop fetching members twice

### Checkpoint: Data
- [ ] /groups and /groups/[id] return identical data to before; `npx tsc --noEmit` clean

### Phase 4: Optional / needs profiling
- [ ] T8: Profile hydration + 1s tick re-renders (Chrome trace) and decide on Nav shared layout / lazy modals

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Project uses legacy JWT secret, so `getClaims()` still hits network | High | T2 gate; enable asymmetric keys in Supabase dashboard or skip T3 and co-locate regions |
| Local verification skips revocation checks (session revoked elsewhere stays valid until JWT expiry) | Med | Acceptable: RLS + short JWT expiry; token refresh path still calls Auth |
| `staleTimes` serves stale lists after mutations | Med | Clients already update local state / refresh; verify per mutation; keep value small (e.g. 30s) |
| Nav takes an `onAddEvent` prop, so a shared layout is not a simple move | Med | Isolated into T8, only if profiling shows it matters |
| Changing groups queries breaks `preview_avatars` | Med | Keep GroupDTO unchanged; compare output before/after |
| Dev-mode numbers mislead | Low | T1 baseline in production mode |

## Open Questions
- Does the Supabase project have asymmetric JWT signing keys enabled? (T2)
- Which Supabase region vs. where will the app be deployed? Is the 500ms mostly network distance from this dev machine?
- Is a group ID available for measuring `/groups/[groupId]` (not yet measured)?
- Is a ~30s stale window on tab switches acceptable product-wise?
