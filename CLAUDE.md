# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Implemented: Next.js App Router + TypeScript + Tailwind v4, Supabase Auth + Postgres.
Auth, events CRUD, the Hero Card, the unified Timeline, the recurring section, the per-event
todo checklist, the Settings page (Discord webhook + digest), Group Countdown (shared
groups with an invite code, a group dashboard reusing the personal one's UI, and a group's
own Discord digest), username-based auth (username + confirm-password at signup, sign in by
username or email), profile editing (username + avatar upload, a group member roster,
and avatar previews on the Groups list), per-member todo checklists on group events, and an
in-app notification bell (event passed / due today-tomorrow), and a production-readiness
pass (`docs/PRODUCTION_READINESS_CHECKLIST.md`: length caps + extra indexes, invite-code
join rate limiting, an optional shared-secret gate + health-webhook alerting on the daily
Edge Function, `@sentry/nextjs` wired but dormant until a DSN is set, and a GitHub Actions
CI workflow) are all built. The daily Discord digest's Edge Function
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
`group_settings`, `profiles` (including its `avatar_url` column and cross-member visibility
policy), `notifications`, plus the `create_group`/`join_group_by_code`/`get_email_for_username`
functions, the `handle_new_user` signup trigger, the member-cap trigger, and the `avatars`
Storage bucket + its 4 policies) directly in the Supabase SQL editor. `supabase/cleanup_and_rollover.sql` defines the
`cleanup_and_roll_events()` function (no longer self-schedules via `pg_cron` - see the
file's own comment); deploy and schedule `supabase/functions/daily-digest/` (a Supabase Edge
Function, `supabase functions deploy daily-digest` - no secret to set up, `SUPABASE_SERVICE_ROLE_KEY`
is auto-injected, see the Architecture bullet below) to run it daily and send both personal
and group Discord digests, and to generate in-app notifications. `supabase/migrations/`
holds schema changes made after the initial build as standalone timestamped files (currently
just one: length caps, extra indexes, and invite-code rate limiting) - `schema.sql` has also
been updated in place with the same changes, so a brand-new project still only needs to run
that one file; add new migration files here going forward instead of only editing
`schema.sql` (see `docs/PRODUCTION_READINESS_CHECKLIST.md` §6). `.github/workflows/ci.yml`
runs lint + build on every push/PR to `main`.

## Architecture

- **Stack:** Next.js (App Router) + TypeScript + Tailwind v4, talking directly to Supabase
  (Postgres + Auth) via `@supabase/ssr` - no custom backend server. `lib/supabase/client.ts`
  for Client Components, `lib/supabase/server.ts` for the one Server Component that needs it
  (`app/page.tsx`), `proxy.ts` (Next 16's `middleware.ts` replacement - see its file-
  convention note below) refreshes the session cookie and redirects based on auth state.
  Root `instrumentation.ts` (server/edge) and `instrumentation-client.ts` (browser) wire up
  `@sentry/nextjs` (`next.config.ts` wraps the config with `withSentryConfig` for source
  map upload) but both are no-ops until `NEXT_PUBLIC_SENTRY_DSN` is set
  (`.env.local.example`) - getting a DSN means creating a Sentry account, a step for the
  human running this, not something to automate.
- **Modular Monolith, adapted (`modules/`):** all Supabase access is behind
  `modules/events/` and `modules/auth/`, each exposing a narrow `*.interface.ts` - that's
  the only file in a module pages/components may import. `events.repository.ts` is the only
  file that calls `supabase.from("events")`; `auth.repository.ts` is the only file that
  calls `supabase.auth.*`/`supabase.rpc("get_email_for_username", ...)`. Repository →
  service → interface, one direction, per module - `auth/` now has a real `auth.service.ts`
  (username/confirm-password validation, username-or-email sign-in resolution - see the
  bullet below), no longer a passthrough; `auth.interface.ts` re-exports `authService`.
  See `docs/ARCHITECTURE_MONOLITH.md` for the full mapping (what was adopted from
  `docs/ARCHITECTURE_DESIGN.md` vs. deliberately skipped, e.g. no REST/WebSocket layer -
  there's no separate backend process to put one in front of). **Adding a new entity means
  a new `modules/<name>/` module, not a Supabase call inlined into a component.**
  `modules/todos/` and `modules/settings/` follow the same repository → service →
  interface shape for the `todos` and `user_settings` tables. `modules/groups/` follows it
  too, for `groups`/`group_members` (`groups.repository.ts`/`.service.ts`) and
  `group_settings` (`group-settings.repository.ts`/`.service.ts`), both re-exported from one
  `groups.interface.ts`. `modules/profiles/` is the only place that touches
  `supabase.from("profiles")` **or** `supabase.storage.from("avatars")` - both are this
  module's data sources, not just the table. `modules/notifications/` follows the shape too,
  for `notifications` - a passthrough module like `auth/` used to be: no client-side business
  rules of its own, since rows are only ever created server-side (see the Edge Function
  bullet below), never inserted by the client at all.
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
- **`daily-digest`'s own invocation is gated by an optional `DIGEST_CRON_SECRET`**, checked
  against an `x-cron-secret` request header before anything else runs - Supabase's default
  per-function JWT verification accepts the public anon key as a valid caller, so without
  this, anyone holding it (i.e. anyone) could trigger the job on demand. The check is
  skipped if the secret is unset, so this doesn't break an existing deployment that hasn't
  configured it (`docs/SETUP.md`). Success and failure are both logged (not just failure),
  and an optional `HEALTH_WEBHOOK_URL` (a Discord webhook dedicated to app health, distinct
  from any user's/group's own digest webhook) gets a one-line alert if cleanup, a digest
  send, or notification generation throws.
- **In-app notifications are generated server-side, once a day, by that same Edge Function**
  - not in real time, since this app has no real-time infrastructure anywhere by design
  (`docs/ARCHITECTURE_DESIGN.md`). `generateNotifications()` runs after cleanup and
  concurrently with the Discord digest sends, independent of whether a user has a webhook
  configured. Dedup is the `notifications` table's own `unique(user_id, event_id, type)`
  constraint - the function `upsert`s with `ignoreDuplicates: true` against it rather than
  querying for existing rows first; don't reintroduce a manual existence check here. A group
  event notifies **every** `group_members` row for that group, not just `event.user_id` (the
  creator) - same "everyone's concern" rule as equal edit permissions and the group Discord
  digest. "Today"/"tomorrow" are calendar-day boundaries computed in ICT (UTC+7, matching the
  cron's own 06:00 ICT schedule), not a rolling window like the digest's own 7-day lookahead.
- **A read notification auto-deletes 1 day after being read, not 1 day after being
  created** - `notifications.read_at` (set by `markAsRead`/`markAllAsRead` in
  `notifications.repository.ts` alongside `is_read`) is the clock, not `created_at`; an
  unread notification is kept indefinitely regardless of age. The delete itself is a third
  step in `cleanup_and_roll_events()` (`supabase/cleanup_and_rollover.sql`) - the same daily
  job as event cleanup/rollover, not a separate one.
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
  direct API call could route around. `join_group_by_code()` also rate-limits itself via
  `group_join_attempts(user_id, attempted_at)` - 10+ calls from one user in the trailing 10
  minutes raise before the invite code is even checked, defending the 8-character
  `invite_code` against brute-forcing (`docs/PRODUCTION_READINESS_CHECKLIST.md` §8). No
  client-facing policies on that table either - same controlled-write-path reasoning.
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
- **`SettingsForm.tsx`/`GroupSettingsModal.tsx`'s webhook field starts empty even when one is
  already saved** - the saved URL is shown via the input's `placeholder`, not pre-filled as
  its `value`, so it isn't sitting in plain text for anyone who opens the page/modal
  (especially relevant for a group's shared settings). Consequence: a blank field on submit
  means "unchanged," **not** "clear it" - `effectiveWebhookUrl` (`trimmedInput ||
  savedWebhookUrl`) is what actually gets saved/tested, and clearing the webhook needs the
  explicit "Remove webhook" link. If you touch this form again, keep that distinction - don't
  "simplify" it back to submitting the raw input value directly.
- **The Group Dashboard reuses Timeline/EventListItem/RecurringEventCard/PastEventCard
  unchanged**, including their `showChecklist` prop (default `true`) - `GroupDashboardClient.tsx`
  no longer overrides it to `false` now that group event cards are expandable too (Milestone
  3). Don't add group-specific copies of these components; extend the shared ones with
  another prop if a future milestone needs group cards to diverge from personal ones again.
- **A group event's `TodoChecklist` is still per-member, not shared** - `todos.user_id`
  scoping is unchanged from Milestone 1 (`event.group_id` being set doesn't change which
  rows a member's queries touch or return), so two members expanding the same group event
  each see and manage their own independent list. `TodoChecklist.tsx` checks
  `event.group_id !== null` to swap its header label to "Bạn" (instead of "Checklist") and
  add a one-line "Đây là checklist của riêng bạn" reminder in the expanded body - purely
  presentational, so nothing else needs to change if this labeling is ever revisited.
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
- **Username is a separate `public.profiles` table, not a column on `auth.users`** (which
  can't be extended): populated automatically by a `handle_new_user()` trigger reading
  `raw_user_meta_data->>'username'` set at signup - never a client insert (`profiles` has no
  insert policy). "Sign in with username or email" resolves a username to its email via the
  `get_email_for_username()` function (`security definer`, granted to `anon` since it must
  run *before* the caller is authenticated) before ever calling `signInWithPassword`, which
  Supabase only ever accepts an email for. Pre-existing accounts (created before this
  feature) have no `profiles` row and simply keep signing in by email - no migration needed.
- **Password hashing is entirely Supabase Auth's job, not this app's** - `supabase.auth.signUp`/
  `signInWithPassword` send the raw password over HTTPS to Supabase's own auth server, which
  bcrypt-hashes it server-side before ever storing anything; this codebase never sees, stores,
  or compares a password hash itself (there is no password column anywhere in
  `supabase/schema.sql` - `auth.users` is entirely Supabase-managed). **Never** pre-hash a
  password client-side or in `modules/auth/` before handing it to Supabase's client - that
  would hash an already-opaque value against Supabase's own hash-and-compare logic and break
  login, not add security.
- **Password strength rules live in `lib/passwordStrength.ts`**, shared by
  `AuthForm.tsx`'s live checklist (ticks off while typing) and `auth.service.ts`'s `signUp`
  (the actual gate, re-checked server-side-of-the-client the same way `assertValidInput`
  re-checks event input) - one rule set, not two that could drift apart. Both password
  fields in `AuthForm.tsx` have a show/hide toggle (`PasswordField`'s local `visible` state).
- **`UserMenu.tsx` is the one shared logout control** for both `Nav.tsx` and `GroupNav.tsx` -
  clicking the account icon opens a small menu (click-outside/Escape to close) rather than
  signing out immediately on the first click; don't reintroduce a direct
  `authInterface.signOut` call in either nav, extend this component instead. It's also
  self-sufficient rather than prop-driven: it fetches the current user's profile itself on
  mount (rendering `<Avatar>` as its own trigger button) and owns `EditProfileModal` - that's
  *why* both navs can keep rendering `<UserMenu />` with zero props even though it now shows
  per-user data. `components/NotificationBell.tsx` (replacing the old decorative `<Bell>`
  button in both navs) follows the exact same self-sufficient shape - fetches its own
  notifications on mount, no props.
- **`components/Avatar.tsx` is the one avatar renderer** (falls back to
  `/default-avatar.png` when `src` is null) - used by `UserMenu`, the group member roster in
  `GroupSettingsModal.tsx`, and the facepile on `GroupsListClient.tsx`'s cards. Don't
  hand-roll another `<Image>`-with-fallback for a person's picture anywhere else.
- **A group's avatar data (member roster, card facepile) is composed in `groups.service.ts`,
  not `groups.repository.ts`**: `groups.repository.ts` only ever touches the `groups`/
  `group_members` tables (per the "one repository, one table" rule), so joining that against
  `profiles` - a different module - happens in the service via
  `profilesInterface.getProfilesByIds()`. There's deliberately no foreign key from
  `group_members.user_id` to `profiles.id` for this (it's still keyed off `auth.users`) -
  that FK would break for any member who joined before `profiles` existed. A member with no
  profile row renders with `username: null`/no avatar instead of crashing - keep that
  fallback if you touch this path.
- **Avatar images are served from Supabase Storage, not `public/`** - `next/image` requires
  remote hostnames to be explicitly allow-listed, so `next.config.ts` derives the Supabase
  project's own hostname from `NEXT_PUBLIC_SUPABASE_URL` and adds it to `images.remotePatterns`
  (scoped to `/storage/v1/object/public/**`). If avatar images ever 400 in production with an
  "Invalid src prop... hostname not configured" error, check this config first.
- **`proxy.ts`'s middleware matcher excludes any path with a file extension** (`.*\\..*`), not
  just `_next/static`/`_next/image`/`favicon.ico` by name - a request for any static asset
  under `public/` (the logo, `default-avatar.png`, anything added later) must never get
  redirected to `/login` just because the visitor isn't signed in. If a new public asset
  seems to fail to load, this matcher is the first thing to check, not the asset itself.
- **`app/globals.css`'s `@theme inline` block defines a bare `--radius` (0.5rem/8px)
  alongside `--radius-sm/md/lg/xl`** - without it, Tailwind's bare `rounded` utility (used on
  nearly every button/input/icon-button in the app) silently falls back to Tailwind's own
  stock 0.25rem instead of this project's documented 8px base radius (`.claude/skills/THEME.md`'s
  `rounded.DEFAULT`). If radii ever look inconsistent again, check this token first before
  touching individual component classes.

## `proxy.ts`, not `middleware.ts`

Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` (same
mechanics, exported function is named `proxy` instead of `middleware`). This repo already
uses the new convention - don't reintroduce `middleware.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
