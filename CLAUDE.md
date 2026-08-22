# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Implemented: Next.js App Router + TypeScript + Tailwind v4, Supabase Auth + Postgres.
Auth, events CRUD, the Hero Card, the unified Timeline, the recurring section, the per-event
todo checklist, the Settings page (Discord webhook + digest), and Group Countdown (shared
groups with an invite code, a group dashboard reusing the personal one's UI, and a group's
own Discord digest) are all built. The daily Discord digest's Edge Function
(`supabase/functions/daily-digest/`) is written but not yet deployed/scheduled - that's a
manual step, same as the SQL files below. The docs below are still the source of truth for
product/behavioral decisions - code comments point back to them rather than restating
rationale.

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

Database setup is not part of `npm run` anything - run `supabase/schema.sql` (tables + RLS
policies for `events`, `todos`, `user_settings`, `groups`, `group_members`,
`group_settings`, plus the `create_group`/`join_group_by_code` functions and the member-cap
trigger) directly in the Supabase SQL editor. `supabase/cleanup_and_rollover.sql` defines the
`cleanup_and_roll_events()` function (no longer self-schedules via `pg_cron` - see the
file's own comment); deploy and schedule `supabase/functions/daily-digest/` (a Supabase Edge
Function, `supabase functions deploy daily-digest` - no secret to set up, `SUPABASE_SERVICE_ROLE_KEY`
is auto-injected, see the Architecture bullet below) to run it daily and send both personal
and group Discord digests.

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
  calls `supabase.auth.*`. Repository → service → interface, one direction, per module -
  though `auth/` has no service file since it's a passthrough with no business logic beyond
  what Supabase Auth already does; `auth.interface.ts` re-exports `authRepository` directly.
  See `docs/ARCHITECTURE_MONOLITH.md` for the full mapping (what was adopted from
  `docs/ARCHITECTURE_DESIGN.md` vs. deliberately skipped, e.g. no REST/WebSocket layer -
  there's no separate backend process to put one in front of). **Adding a new entity means
  a new `modules/<name>/` module, not a Supabase call inlined into a component.**
  `modules/todos/` and `modules/settings/` follow the same repository → service →
  interface shape for the `todos` and `user_settings` tables. `modules/groups/` follows it
  too, for `groups`/`group_members` (`groups.repository.ts`/`.service.ts`) and
  `group_settings` (`group-settings.repository.ts`/`.service.ts`), both re-exported from one
  `groups.interface.ts`.
- **`events` has two ownership scopes, not two modules:** a group event is still just a row
  in `events` with `group_id` set (personal: `group_id is null`). Rather than forking the
  entity, `events.repository.ts`/`events.service.ts` grew group-scoped siblings
  (`listByGroupAndRecurrence`/`insertGroupEvent`/`updateGroupEvent`/`removeGroupEvent`,
  `getGroupDashboardData`/`createGroupEvent`/`updateGroupEvent`/`deleteGroupEvent`) alongside
  the original personal-scoped functions - both reuse the same `assertValidInput`. The
  personal functions gained a `.is("group_id", null)` guard so a user who *authored* a group
  event doesn't see it leak into their personal dashboard/digest just because its `user_id`
  still matches them. Group update/delete filter by `group_id`, **not** `user_id` - any
  member has equal permission to edit/delete any event in the group (docs/PRD.md).
- **The daily digest Edge Function is a deliberate exception to the anon-key-only rule**
  above: `supabase/functions/daily-digest/index.ts` runs with no signed-in user (it acts
  across every user's data), so it uses the Supabase **service-role key** instead of the
  anon key, bypassing RLS by design. `SUPABASE_SERVICE_ROLE_KEY` (along with `SUPABASE_URL`)
  is a reserved name Supabase auto-injects into every Edge Function's environment - there's
  nothing to configure, and `supabase secrets set` actively refuses to let you set it
  yourself. It's the one place in the codebase that uses this key - everything under
  `lib/supabase/` and `modules/` stays anon-key-only, and this key must never end up in
  `.env.local`/`NEXT_PUBLIC_*` or anywhere sent to the browser.
- **Data model:** single `events` table (`user_id`, `name`, `deadline`, `description`,
  `is_recurring`, `recurrence_day_of_week`, `group_id`), RLS-scoped to `user_id = auth.uid()
  or group_id in (select group_id from group_members where user_id = auth.uid())`. Mirrored
  in `types/event.ts` as `EventRecord` (a DB row) vs. `EventInput` (what the form collects) -
  this doubles as the `events` module's model, kept at the conventional `types/` location
  since presentational components also need it without importing from `modules/events/`.
  `EventInput` deliberately excludes `group_id` - it's supplied by the caller context (which
  page/handler is saving), not collected by `EventForm`, which is reused unchanged for both
  personal and group events.
- **Groups can only be created/joined through `security definer` Postgres functions**
  (`create_group`/`join_group_by_code` in `supabase/schema.sql`), never a raw client insert -
  `groups` and `group_members` have **no** client-facing insert policy at all. This is
  deliberate: it's what makes the 10-member cap (a `before insert on group_members` trigger)
  and "join only via a known invite code" actually enforced, not just UI-level conventions a
  direct API call could route around.
- **Every "is the current user a member of this group?" RLS check goes through
  `public.is_group_member(group_id)`** (also `security definer`), not an inline
  `group_id in (select group_id from group_members where user_id = auth.uid())` subquery -
  that inline form on `group_members`' own policy makes Postgres raise "infinite recursion
  detected in policy for relation group_members" (the subquery re-triggers the same policy on
  its own scan of the table). The function's internal query bypasses RLS instead of
  re-entering it, breaking the cycle. Used consistently across `groups`/`group_members`/
  `group_settings`/`events`' policies - don't reintroduce the inline subquery form anywhere.
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
- **Past events are split out of the Timeline client-side, not server-side:** `events.service.ts`
  still returns one combined past+today+future `timeline` array - `DashboardClient.tsx` filters
  it in render (`getEventStatus(event.deadline).status !== "past"`) into `activeEvents` (goes to
  `Timeline`) and `pastEvents` (goes to `PastEventsSection`, rendered below Recurring). This is a
  presentational split only, since status is presentational per the bullet below - don't move the
  filter into the service/repository or add a third DB query for it.
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
- **`TodoChecklist` manages its own state instead of `router.refresh()`-ing** (unlike every
  event mutation in `DashboardClient.tsx`): it's seeded once from the `initialTodos` prop
  (itself built server-side in `app/page.tsx` via `todosInterface.listAllForUser()` +
  `groupByEvent()` - one query total, not one per event card) and every add/toggle/delete
  updates local state directly. This is deliberate, not an inconsistency to fix - todos don't
  affect sort order, urgency, or anything else on the page (docs/PRD.md), so a full-page
  refresh would only cost a flash and lost expand/collapse state for no benefit.
- **The Group Dashboard reuses Timeline/EventListItem/RecurringEventCard/PastEventCard
  unchanged**, via an optional `showChecklist` prop (default `true`) threaded down to each -
  `GroupDashboardClient.tsx` is the only caller that passes `false`, since group event cards
  aren't expandable yet (Milestone 3 territory - per-member checklists on shared events
  aren't designed yet). Don't add group-specific copies of these components; extend the
  shared ones with another prop the way this one was added.
- **`Nav.tsx` is shared between the Personal Dashboard and the Groups list**
  (`references/dashboard-nav-bar.png`), not two separate headers - a **Personal**/**Group**
  tab pair (active tab derived from `usePathname()`), plus an optional `onAddEvent` prop
  that's omitted (hiding the Add Event button) on the Groups list, where it doesn't apply. A
  specific group's own dashboard (`/groups/[groupId]`) still uses the separate `GroupNav`
  instead - it's a drill-down view, not a top-level tab, so it isn't part of this pair.
- **All user-facing dates/times go through `lib/dateFormat.ts`**: dd/mm/yyyy dates
  (`formatEventDate`), 24-hour hh:mm times with no seconds (`formatEventTime`) - the
  TimeField form input never collects seconds, so displaying a literal ":00" everywhere
  would be noise, not information. `formatTimelineDate` composes both plus the Vietnamese
  weekday abbreviation. Don't call `toLocaleDateString`/`toLocaleString` ad hoc elsewhere for
  a user-facing display - add to/reuse this file instead, so formatting stays consistent app-wide.
- **Vietnamese status/recurrence labels** ("Đã qua", "còn X ngày", "Lặp lại - ... hàng tuần")
  require the `vietnamese` font subset - `app/layout.tsx` loads all three fonts with
  `subsets: ["latin", "vietnamese"]` explicitly.
- **Deadline date/time entry is two custom segmented-input components, not `<input type="date">`**:
  `DateField.tsx` (dd/mm/yyyy, backed by `CalendarPopup.tsx` for click-to-pick) and
  `TimeField.tsx`, both used from `EventForm`. Each digit group auto-advances focus on
  completion and validates on blur - when editing either, read the live DOM value
  (`event.target.value`) on blur rather than the closed-over state, since an auto-advance
  `.focus()` call fires the next field's blur synchronously, one keystroke ahead of when React
  commits that keystroke's state (see the comment in `DateField.tsx` and `docs/DESIGN.md` §8.5).

## `proxy.ts`, not `middleware.ts`

Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` (same
mechanics, exported function is named `proxy` instead of `middleware`). This repo already
uses the new convention - don't reintroduce `middleware.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
