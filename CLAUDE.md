# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Implemented: Next.js App Router + TypeScript + Tailwind v4, Supabase Auth + Postgres.
Auth, events CRUD, the Hero Card, the unified Timeline, and the recurring section are all
built. The docs below are still the source of truth for product/behavioral decisions - code
comments point back to them rather than restating rationale.

- `docs/PRD.md` — product requirements, MVP feature list, and explicit assumptions
- `docs/ARCHITECTURE.md` — tech stack, folder structure, DB schema, sorting/cleanup logic
- `docs/UI_SPEC.md` — screen-by-screen UI behavior
- `docs/PLAN.md` — the phased build plan this implementation followed
- `docs/ARCHITECTURE_DESIGN.md` — the project-agnostic Modular Monolith pattern doc
- `docs/ARCHITECTURE_MONOLITH.md` — how that pattern is adapted here (what was adopted,
  what was deliberately skipped, and why) - read this before adding a new module
- `.claude/skills/THEME.md` — brand tokens (colors, type, spacing, radii), source for `app/globals.css`
- `.claude/skills/DESIGN.md` — implementation-ready design system (component-by-component)
- `.claude/skills/TASTE.md` — durable frontend taste preferences for any future UI work
- `references/*.png` — reference mockups (dashboard, add-event modal, login/signup, color/type system)

**Resolved design item:** the reference login mockup used a rainbow-gradient wordmark, but
the implementation uses the brand's single accent color throughout instead (see `DESIGN.md` §2).

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build - also runs the TypeScript check
npm run lint     # ESLint (flat config, includes React Compiler-readiness rules)
npx tsc --noEmit # type-check only, faster than a full build
```

There is no test suite configured. Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (copy `.env.local.example`) - without it, `proxy.ts`
throws on every request since it needs a Supabase client to check the session.

Database setup is not part of `npm run` anything - run `supabase/schema.sql` (table + RLS
policies) and `supabase/cleanup_and_rollover.sql` (daily `pg_cron` job, requires enabling
the `pg_cron` extension first) directly in the Supabase SQL editor.

## Architecture

- **Stack:** Next.js (App Router) + TypeScript + Tailwind v4, talking directly to Supabase
  (Postgres + Auth) via `@supabase/ssr` - no custom backend server. `lib/supabase/client.ts`
  for Client Components, `lib/supabase/server.ts` for the one Server Component that needs it
  (`app/page.tsx`), `proxy.ts` (Next 16's `middleware.ts` replacement - see its file-
  convention note below) refreshes the session cookie and redirects based on auth state.
- **Modular Monolith, adapted (`modules/`):** all Supabase access is behind
  `modules/events/` and `modules/auth/`, each exposing a narrow `*.interface.ts` - that's
  the only file in a module pages/components may import. `events.repository.ts` is the only
  file that calls `supabase.from("events")`; `auth.repository.ts` is the only file that
  calls `supabase.auth.*`. Repository → service → interface, one direction, per module. See
  `docs/ARCHITECTURE_MONOLITH.md` for the full mapping (what was adopted from
  `docs/ARCHITECTURE_DESIGN.md` vs. deliberately skipped, e.g. no REST/WebSocket layer -
  there's no separate backend process to put one in front of). **Adding a new entity means
  a new `modules/<name>/` module, not a Supabase call inlined into a component.**
- **Data model:** single `events` table (`user_id`, `name`, `deadline`, `description`,
  `is_recurring`, `recurrence_day_of_week`), RLS-scoped to `user_id = auth.uid()`. Mirrored
  in `types/event.ts` as `EventRecord` (a DB row) vs. `EventInput` (what the form collects) -
  this doubles as the `events` module's model, kept at the conventional `types/` location
  since presentational components also need it without importing from `modules/events/`.
- **Two event lifecycles that must not be conflated:**
  - Non-recurring events are hard-deleted 24h after `deadline` passes (grace period).
  - Recurring events (weekly) never delete - `supabase/cleanup_and_rollover.sql`'s daily job
    rolls `deadline` forward in whole-week increments (a single SQL expression using
    `ceil(...)`, not a loop) until it's back in the future.
  - `modules/events/events.recurrence.ts`'s `nextOccurrence()` mirrors that same math
    client-side, so the UI shows the correct next date even in the ~24h window before the
    cron job has actually run.
- **List composition is two independent queries, done once, in `events.service.ts`**'s
  `getDashboardData()`: the Timeline (`is_recurring = false`, one continuous
  past+today+future list, sorted ascending) and the Recurring section
  (`is_recurring = true`) never mix. The nearest non-past Timeline item is derived there too
  and passed down as `initialNearestEvent` - `app/page.tsx` calls this once and hands all
  three to `DashboardClient` as props; don't re-derive `nearestEvent` client-side.
- **Two different countdown update strategies:** only `HeroCountdownCard` uses the
  live-ticking `useCountdown` hook. Timeline/recurring rows call `getEventStatus()` /
  `daysUntil()` (from `modules/events/events.interface.ts`) once per render instead - don't
  attach `useCountdown` to list items.
- **`useCountdown` starts `null` on purpose** (`lib/useCountdown.ts`): `HeroCountdownCard` is
  server-rendered, so reading `Date.now()` during the first render would differ between the
  server's render time and the client's hydration time and break hydration. It starts null
  identically on both, then begins ticking client-side after mount (deferred via `setTimeout`
  rather than called synchronously in the effect body, which is flagged by the project's
  ESLint `react-hooks` purity/set-state-in-effect rules).
- **Urgency status** (`modules/events/events.status.ts`: past/today/soon/later) is computed
  client-side from `deadline` vs. `now` and is presentational only - it never affects sort
  order or the delete/rollover logic, which run purely off the raw `deadline` timestamp.
- **Errors are typed and thrown, not returned** (`modules/shared/errors.ts`: `AppError` and
  subclasses `ValidationError` / `NotAuthenticatedError` / `DatabaseError`). Services/
  repositories throw; `EventForm`/`AuthForm`'s existing catch blocks and `app/error.tsx`
  (a Next.js error boundary) are where messages surface - don't add a new ad-hoc error shape.
- **Every modal instance is given an explicit `key`** (`DashboardClient.tsx`, e.g.
  `key={`edit-${modal.event.id}`}`) - all three modal branches (add/edit/delete) render the
  same component types as siblings inside one `AnimatePresence`, and without a key React (and
  AnimatePresence's own child-tracking) can reuse a previous instance's internal form state
  instead of mounting fresh.
- **Vietnamese status/recurrence labels** ("Đã qua", "còn X ngày", "Lặp lại - ... hàng tuần")
  require the `vietnamese` font subset - `app/layout.tsx` loads all three fonts with
  `subsets: ["latin", "vietnamese"]` explicitly.

## `proxy.ts`, not `middleware.ts`

Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` (same
mechanics, exported function is named `proxy` instead of `middleware`). This repo already
uses the new convention - don't reintroduce `middleware.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
