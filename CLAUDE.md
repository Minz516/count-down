# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Countdown: a Next.js (App Router) + Supabase app for tracking deadlines with a live countdown, plus shared "Group Countdown" boards, Discord digest notifications, and in-app alerts. No custom backend server — the frontend talks to Supabase directly via `@supabase/ssr`, both from Server Components (`lib/supabase/server.ts`) and Client Components (`lib/supabase/client.ts`). Auth/session refresh and route protection happen in `proxy.ts` (Next's middleware entry point), which redirects signed-out users to `/login` and bounces signed-in users away from `/login`/`/signup`.

## Commands

```bash
npm run dev          # dev server (Turbopack)
npm run build         # production build — also runs the TypeScript check
npm run start         # start production server
npm run lint           # ESLint (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit       # type-check only, faster than a full build
```

There is no test suite/framework configured in this repo. CI (`.github/workflows/ci.yml`) runs `npm run lint` then `npm run build` on every push/PR to `main`, using placeholder Supabase env vars (build doesn't hit Supabase at build time — routes reading `cookies()` render dynamically at request time).

Database changes: run `supabase/schema.sql` in the Supabase SQL editor first (tables, RLS policies, RPC functions, the signup trigger, the `avatars` Storage bucket), then `supabase/cleanup_and_rollover.sql`, then anything under `supabase/migrations/` in timestamp order that isn't already folded into `schema.sql`.

## Architecture: the module layer

Business logic lives in `modules/<domain>/`, one directory per domain (`auth`, `events`, `groups`, `notifications`, `profiles`, `settings`, `todos`), each split into three files with a strict one-way dependency chain:

```
*.interface.ts  →  *.service.ts  →  *.repository.ts
```

- **`*.repository.ts`** — the only place that runs Supabase queries (`.from(...)`, `.rpc(...)`, `supabase.auth.*`) for that domain. Every method takes a `SupabaseClient` plus the acting user's/group's id as explicit params and filters on it explicitly in the query — even though RLS also enforces it. This project authenticates with the anon key + user session (never a service-role key) from the client, so RLS is a real, independently-enforced boundary; the explicit filter is defense-in-depth and keeps the scoping visible in code. Supabase errors are caught and re-thrown as `DatabaseError` (never left as raw PostgREST errors).
- **`*.service.ts`** — business logic and validation (e.g. `assertValidInput` in `events.service.ts` mirrors DB check constraints so a bad input fails with a friendly `ValidationError` before hitting Postgres). Translates known Postgres RPC exceptions (e.g. rate-limit errors) into typed errors. Calls the repository; never queries Supabase directly.
- **`*.interface.ts`** — the module's only public export. Pages and components import **only** from here — never from a module's `.service.ts` or `.repository.ts` directly, and never call `supabase.from(...)` outside the `modules/` tree.

Errors are a small typed hierarchy in `modules/shared/errors.ts` (`AppError` → `ValidationError`, `NotAuthenticatedError`, `DatabaseError`), each carrying a `.code` and a display-ready `.message`. Callers (component catch blocks, `error.tsx` boundaries) read `.message` directly and can branch on `.code`.

Group-scoped domains (events, todos, etc.) typically expose parallel personal/group methods (e.g. `eventsService.createEvent` vs `createGroupEvent`) rather than a single method with an optional group param — follow that pattern when extending a domain that has group support. Group event queries filter by `group_id` only (any member can manage any event in their group); personal queries filter by `user_id` **and** `.is("group_id", null)` so a group event the caller happens to have authored doesn't leak into their personal timeline.

Some writes only have an RPC path (e.g. `create_group`, `join_group_by_code`, `get_email_for_username`) because the underlying table has no client-facing insert policy — repositories call `supabase.rpc(...)` for those instead of `.insert()`.

## Data flow: server components fetch, client components mutate

- Pages under `app/` are Server Components. They create a server-side Supabase client (`lib/supabase/server.ts`, cookie-based), call `*Interface` methods to fetch initial data, and pass it as props into a `"use client"` component (e.g. `app/page.tsx` → `components/DashboardClient.tsx`). Pages that render one user's private data set `export const dynamic = "force-dynamic"` explicitly so they're never statically cached/served across users.
- Protected pages read the acting user id from the `x-user-id` request header — `(await headers()).get("x-user-id")` — **not** by calling `supabase.auth.getUser()` again. `proxy.ts` sets that header after it has already JWT-verified the user, so trusting it avoids a second Supabase Auth round-trip per navigation (`docs/FIX_NAVIGATION_LATENCY.md`). Pages still `redirect("/login")` when it's missing (defense in depth), and it's not an auth boundary — RLS is. Follow this pattern in any new protected page.
- Client components create their own Supabase client (`lib/supabase/client.ts`) per mutation and call the same `*Interface` methods directly (no server actions / API route layer for CRUD) — e.g. `DashboardClient.tsx` calls `eventsInterface.createEvent(supabase, user.id, input)` on submit, then updates local state / re-fetches.
- `types/*.ts` holds the shared record/input types (`EventRecord`, `EventInput`, etc.) used by both the module layer and components. `lib/` holds framework-agnostic helpers used across components: `useCountdown.ts` (the live 1s tick behind the hero countdown), `dateFormat.ts`, `passwordStrength.ts`.

## Other things to know

- `supabase/functions/daily-digest/` is a Supabase Edge Function (Deno), deployed and scheduled separately (`supabase functions deploy daily-digest`) — not part of the Next.js build. It sends the Discord digest, rolls recurring events forward, cleans up expired events, and generates in-app notifications.
- Sentry (`@sentry/nextjs`) is wired up (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`) but dormant until a DSN env var is set — don't assume it's active in dev/CI.
- Path alias `@/*` maps to the repo root (see `tsconfig.json`).
- Styling is Tailwind CSS v4 via the PostCSS plugin (`@tailwindcss/postcss`) — there is no `tailwind.config`; theme tokens and global styles live in `app/globals.css`.
- `.claude/skills/DESIGN.md`, `TASTE.md`, `THEME.md` capture this project's frontend visual-design conventions (palette, type, motion) — check them before making UI/styling changes.
- `docs/` holds the design record: `ARCHITECTURE_DESIGN.md` (the section-numbered spec that code comments cite as "§x.y"), `PRD.md`, `UI_SPEC.md`, `PRODUCTION_READINESS_CHECKLIST.md`, `FIX_NAVIGATION_LATENCY.md`, `SETUP.md`. Consult the relevant one before a non-trivial change; inline comments frequently point at a specific section.
- `app/sentry-example-page/` and `app/api/sentry-example-api/` are leftover Sentry-wizard scaffolding, not real features — safe to ignore or delete.
