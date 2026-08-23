# Fix: Duplicate Supabase Auth Network Call on Every Navigation

## Problem
Every navigation between pages (`/`, `/groups`, `/groups/[groupId]`,
`/settings`) feels slow. Root cause, confirmed by reading the code:

1. `proxy.ts` (middleware) calls `supabase.auth.getUser()` on every request.
   This is a **real network round-trip** to Supabase's Auth server (not a
   local cookie read) — that's what `getUser()` is for, as opposed to the
   cheaper-but-less-trustworthy `getSession()`.
2. Every one of the four protected `page.tsx` files calls
   `authInterface.getCurrentUser(supabase)` independently, which internally
   calls `supabase.auth.getUser()` **again**.

So every single navigation pays for **two** full round-trips to Supabase's
Auth server just to confirm identity, before any actual data query even
starts. This is a well-documented Next.js + Supabase performance pitfall —
not something specific to this codebase's design, but the standard
`@supabase/ssr` middleware pattern combined with a defense-in-depth check
in each page.

## Fix
Middleware already does the one authoritative `getUser()` check. Instead
of each page repeating it, have middleware forward the already-validated
user's id to the page via a request header, and have each page trust that
header instead of calling `getUser()` again.

### 1. `proxy.ts` — forward the validated user id as a header
After the existing `supabase.auth.getUser()` call succeeds, set a header
on the *request* (not just the response) so it's visible to the
downstream Server Component render:

```ts
const requestHeaders = new Headers(request.headers);
if (user) {
  requestHeaders.set("x-user-id", user.id);
}
response = NextResponse.next({ request: { headers: requestHeaders } });
```

This needs to happen for the "signed in, allowed through" path — merge it
into the existing `NextResponse.next({ request })` construction already in
the file rather than adding a second one.

**Why this is safe to trust:** middleware runs before the request ever
reaches the page, and constructs the header itself from the JWT it just
verified — a client cannot inject its own `x-user-id` header and have it
survive, since middleware overwrites the header set with its own. This
header is purely a performance optimization for the sign-in-redirect UX
check; it is not a new authorization boundary. All actual data access is
still enforced by Postgres RLS regardless of this header (see
`docs/PRODUCTION_READINESS_CHECKLIST.md` §3/§7) — if this header were ever
somehow wrong, RLS would still block any unauthorized data access.

### 2. Each page — read the header instead of re-calling getUser()
In `app/page.tsx`, `app/groups/page.tsx`,
`app/groups/[groupId]/page.tsx`, and `app/settings/page.tsx`, replace:

```ts
const user = await authInterface.getCurrentUser(supabase);
if (!user) {
  redirect("/login");
}
```

with:

```ts
import { headers } from "next/headers";
// ...
const userId = (await headers()).get("x-user-id");
if (!userId) {
  redirect("/login");
}
```

Then use `userId` wherever `user.id` was previously used (e.g.
`todosInterface.listAllForUser(supabase, userId)`,
`settingsInterface.getSettings(supabase, userId)`). **Before removing the
`user` object entirely, check each of these four files for any use of a
`User` field other than `.id`** (e.g. `.email`) — none were spotted during
this review, but confirm before deleting the `authInterface.getCurrentUser`
call so nothing silently loses data it needs.

### 3. Files touched
- `proxy.ts`
- `app/page.tsx`
- `app/groups/page.tsx`
- `app/groups/[groupId]/page.tsx`
- `app/settings/page.tsx`

### 4. Expected result
Cuts the Supabase Auth network round-trips per navigation from 2 down to
1 — removing roughly half of the pure auth-check latency on every route
change. The actual data queries (events/todos/groups) after the auth
check are unaffected by this change and will still take their own time.

### 5. How to verify the fix worked
- Navigate between Personal / Group / Settings repeatedly — should feel
  noticeably snappier than before.
- Sign out (or manually clear the Supabase cookies in DevTools) and
  confirm you're still correctly redirected to `/login` on every
  protected route — this confirms the header-based check didn't
  accidentally weaken the auth guard.
- Sign in and confirm all four pages still load their correct,
  user-scoped data (no regression in what each page shows).
