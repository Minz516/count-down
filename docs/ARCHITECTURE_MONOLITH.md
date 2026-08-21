# Modular Monolith — how it's applied in this project

This documents how `docs/ARCHITECTURE_DESIGN.md` (a project-agnostic pattern extracted
from a different codebase - a client/server app with a separate backend process and
WebSocket real-time) was **adapted**, not copied literally, into this app. Read that file
first for the full reasoning; this file only records the mapping and the deliberate
deviations, per that doc's own §7 checklist ("write down the rules... reference this
pattern doc from it, don't over-build patterns the project's scale doesn't need").

## What was adopted

This app has effectively **one bounded context** (`events`, with `auth` as a thin
passthrough over Supabase Auth) - below the doc's own "skip full module boundaries under
4-5 real bounded contexts" threshold (§1). Even so, the module-boundary *discipline* was
worth adopting now, because the payoff is cheap here and expensive to retrofit later
(§7.4): a clear seam for the next entity (categories, reminders, whatever comes next) to
slot into without a rewrite.

- **Module boundary rules (§2.1):** `modules/events/` and `modules/auth/` each expose a
  narrow `*.interface.ts` - that file, and nothing else in the module, is what pages and
  components import. `modules/events/events.repository.ts` is the *only* file in the
  codebase that calls `supabase.from("events")`; `modules/auth/auth.repository.ts` is the
  only file that calls `supabase.auth.*`.
- **N-Tier flow within a module (§2.3):** `repository` (all data access) → `service`
  (validation + business rules, e.g. deriving the Hero Card's `nearestEvent` from the
  Timeline) → `interface` (public contract). Components never call Supabase directly.
- **Every repository method takes the acting user's id and scopes its query on it**
  (§2.3) - see the deviation on *why* this is real defense-in-depth here, not
  theater, below.
- **A typed error hierarchy** (`modules/shared/errors.ts`) - `AppError` and its
  subclasses (`ValidationError`, `NotAuthenticatedError`, `DatabaseError`) are thrown from
  services/repositories and read by the UI's existing catch blocks (`EventForm`,
  `AuthForm`) and by `app/error.tsx`, a Next.js error boundary added for exactly this
  ("failure as a first-class state", §6).
- **A model-less/passthrough module is a legitimate shape** (§2.1) - `auth` has no
  `.service.ts` because it has no business rules of its own to add on top of what
  Supabase Auth already enforces.

## What was deliberately skipped, and why

- **No separate backend process, no REST layer, no controllers/routes/DTOs.** This app's
  own `docs/ARCHITECTURE.md` already decided the Next.js app talks to Supabase directly -
  that decision predates this pattern adoption and still holds. `modules/*/interface.ts`
  functions are plain TypeScript functions called in-process (from a Server Component or
  a Client Component's event handler), not HTTP endpoints. There is no network hop to add
  a controller/route layer in front of.
- **No WebSocket, no event bus, no orchestrator/pipeline pattern (§3, §4).** Nothing in
  this app is a multi-stage async job or a live/collaborative feature - the countdown
  ticks client-side off `setInterval`, nothing is pushed from a server. Adding socket
  infrastructure for a feature that doesn't need it would be exactly the "ceremony" the
  pattern doc's own §1 says to skip.
- **No response envelope / pagination shape (§2.4).** Those are HTTP JSON conventions.
  Without a network boundary, the equivalent seam is "services throw typed errors,
  callers catch them" - which is what's implemented. There are no list endpoints large
  enough to need pagination.
- **No package-based frontend componentization (§5.3)** (`index.jsx` + hook + service per
  component folder). Components here already call the `events`/`auth` interfaces
  directly instead of routing through per-component service files - one fewer layer,
  proportionate to a component tree this size. Revisit this specifically (not the whole
  pattern) if a component's data-fetching logic grows complex enough to want its own
  hook file.

## One real deviation from §2.3's stated reasoning

The pattern doc frames per-request user-id scoping as necessary because *"if the backend
holds an elevated/service-role database credential, database-level row security does not
protect you."* This project's Supabase client always uses the **anon key plus the user's
own session** (see `lib/supabase/client.ts` / `lib/supabase/server.ts`) - never a
service-role key - so Row Level Security (`supabase/schema.sql`) *is* a real, independently
enforced boundary here, not just theater behind an already-trusted backend. The explicit
`.eq("user_id", userId)` filters in `events.repository.ts` are kept anyway, as genuine
defense-in-depth (correctness even if a policy is ever misconfigured) and because they
document the scoping in code, not only in a database policy - but unlike the pattern doc's
assumed scenario, they are not the *only* thing standing between a request and another
user's data.

## Where things live now

```
modules/
├── shared/
│   └── errors.ts              # AppError + typed subclasses
├── events/
│   ├── events.repository.ts   # all `events` table access
│   ├── events.service.ts      # validation, getDashboardData (timeline/recurring/nearest)
│   ├── events.status.ts       # urgency status derivation (moved from lib/eventStatus.ts)
│   ├── events.recurrence.ts   # next-occurrence math (moved from lib/recurrence.ts)
│   └── events.interface.ts    # <- the only import path for the above, from outside the module
└── auth/
    ├── auth.repository.ts     # all `supabase.auth.*` calls
    └── auth.interface.ts      # <- the only import path for the above
```

`types/event.ts` remains the model for the `events` module - kept at the conventional
Next.js `types/` location rather than duplicated as `events.model.ts`, since it's also
consumed by presentational components that have no need to import from `modules/events/`.

## Adding the next module

1. One new directory under `modules/<name>/`, following the `events` module's shape
   (`*.repository.ts` → `*.service.ts` → `*.interface.ts`; skip `.service.ts` if the module
   truly has no business rules beyond passthrough).
2. The repository is the only file touching that entity's Supabase table.
3. Pages/components import only from `*.interface.ts`.
4. If the new feature is genuinely multi-stage/async or needs live server push, that's the
   trigger to revisit §3/§4 of `docs/ARCHITECTURE_DESIGN.md` for real - not before.
