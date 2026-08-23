# ARCHITECTURE_DESIGN.md

This file documents the **architecture pattern** used in this repository (NCT Meeting
Summarizer) in a project-agnostic way, so that a future Claude Code session can implement
the same pattern from scratch in a *different* project. It describes the shape, the rules,
and the reasoning — not this project's domain (meetings/transcripts/summaries). Where an
example is needed, it is marked as an example, not a requirement.

Source of truth for how this pattern actually plays out in this repo:
`docs/system.doc/ARCHITECTURE.md`. That file is authoritative for this project; this file
is the extracted, reusable pattern.

---

## 1. Overall style

Four decisions, orthogonal to each other, that combine into one architecture:

1. **Client–Server split.** Frontend and backend are separate codebases, separate
   dependency trees, separate build/deploy pipelines. They are coupled *only* through a
   network contract (REST + WebSocket), never through shared source or a monorepo import.
2. **Modular Monolith on the backend.** One deployable process, internally partitioned into
   bounded-context **modules** that each own their own data and business rules. Not
   microservices (no network hop between modules, no independent deployment per module) —
   the isolation is at the source-code/import level, enforced by convention and review, not
   by infrastructure.
3. **N-Tier (layered) architecture on both sides**, but at different granularity:
   - Backend: layered *within each module* (route → controller → service → repository → model).
   - Frontend: layered *within each component package* (page → component → hook/service →
     store/util).
4. **Dual protocol.** REST for request/response and CRUD. WebSocket for continuous,
   stateful, bidirectional interaction (progress streams, live/real-time features). Pick
   REST vs WebSocket per *interaction shape*, not per feature area — a feature can use both.

Pick this architecture when: you have one team, one deploy target per app, a domain that
splits naturally into a handful of bounded contexts, and at least one feature that needs
push-based real-time updates (progress bars, live collaboration, streaming results). Skip
it — plain layered monolith, no module boundaries — if the domain is small enough that
"module boundary" would just be ceremony (roughly: fewer than 4-5 real bounded contexts).

```
┌──────────────────────────────┐       REST /api/*        ┌───────────────────────────────┐
│  frontend  (SPA)              │ ◄──────────────────────► │  backend (long-running process)│
│  static build on CDN host    │                          │  HTTP + WebSocket, one process│
│                              │ ◄──── WebSocket /rt ────► │                               │
└──────────────────────────────┘                          └───────────┬───────────────────┘
                                                                       │
                                                                       ▼
                                                        ┌────────────────────┬────────────┐
                                                        │  Database          │  External   │
                                                        │  (managed)         │  API(s)     │
                                                        └────────────────────┴────────────┘
```

If large binary payloads are involved (media, files), have the client upload/download
**directly** to object storage via a short-lived signed URL — bytes never transit the API
process. This is what keeps the backend process free to do CPU/IO-bound work instead of
proxying bytes.

---

## 2. Backend — Modular Monolith

### 2.1 Module boundary rules

- A module may **not** import another module's internal service, repository, or model file.
- Cross-module communication happens only through:
  1. the module's public **interface** (`*.interface.js` — an explicit, narrow exported
     contract — e.g. `getXForOwner`, `assertOwnership`, `markFailed`; never "export the
     whole service"), or
  2. a decoupled **event bus** (publish/subscribe), for fire-and-forget side effects where
     the publisher must not know who (if anyone) is listening.
- A module may own **no persistent model at all**, existing purely as an
  **orchestrator** (drives a multi-step process across other modules' interfaces) or an
  **aggregator** (composes a read-only view from other modules' interfaces). This is a
  legitimate module shape, not a workaround — use it for any cross-cutting pipeline or
  composed "detail view" endpoint instead of letting one "real" module reach into another.

Rule of thumb for drawing module boundaries: one owning module per persistent entity/table,
grouped by the business capability that creates and mutates it — not by technical layer,
not by page.

### 2.2 Directory layout

```
backend/
├── src/
│   ├── index.js                     # single entry: bootstraps HTTP + WebSocket together
│   ├── app.js                       # app assembly, middleware chain, route mounting
│   │
│   ├── config/                      # global config layer — outside module/tier structure
│   │   ├── database.js
│   │   ├── <external-service>.js    # one file per external SDK client (storage, AI, etc.)
│   │   └── socket.js                # WebSocket server + namespace registration
│   │
│   ├── middleware/                  # shared middleware layer
│   │   ├── authenticate.js          # verifies auth token → req.user
│   │   ├── authorize.js             # role/permission checks
│   │   ├── validate.js              # runs a module's validator schema
│   │   └── errorHandler.js          # centralized; the ONLY place that formats a failure envelope
│   │
│   ├── shared/                      # shared utilities layer
│   │   ├── eventBus.js
│   │   ├── response.js              # success()/failure() envelope + paginate()
│   │   ├── errors.js                # typed error hierarchy with machine codes
│   │   ├── dto.js                   # the project-wide serialization transform
│   │   └── constants.js
│   │
│   └── modules/
│       └── <one directory per bounded-context module>/
└── package.json
```

### 2.3 Internal N-Tier flow

Within each module, dependencies flow strictly one way:

```
Route / Socket Handler → Controller → Service → Repository / Interface → Model
```

A full module package (example fields are illustrative, not prescriptive):

```
<module>/
├── <module>.model.js         # schema definition / table mapping
├── <module>.repository.js    # ALL data access for this module
├── <module>.service.js       # business rules, state transitions, event publishing
├── <module>.controller.js    # HTTP-shaped: reads req, calls service, returns envelope
├── <module>.routes.js        # path → middleware chain → controller
├── <module>.validator.js     # inbound boundary: request schema validation
├── <module>.dto.js           # outbound boundary: response shaping, strips internal fields
├── <module>.interface.js     # the public contract other modules may call
└── <module>.socket.js        # optional: this module's real-time handlers
```

Non-negotiable rules:
- Routes and socket handlers never touch models directly.
- Services never bypass the repository.
- Validators run **before** controller logic runs — controllers assume already-valid input.
- DTOs run **before** data leaves the service layer — nothing raw from a repository reaches
  a controller-consumable surface, let alone a client.
- **Every repository method takes the acting user's id and scopes its query on it.** If the
  backend holds an elevated/service-role database credential, database-level row security
  (if any) does *not* protect you — the repository layer is the actual authorization
  boundary. Treat any row-security feature of the database as defence-in-depth, not the
  primary control.
- Only `errorHandler.js` (or equivalent) formats a failure response. Controllers/services
  throw typed errors; they never call `res.status(...).json(...)` for an error case
  themselves. This keeps every failure response shaped identically without every module
  having to remember to do it.

### 2.4 Cross-cutting conventions

**Response envelope** — exactly two shapes, project-wide, produced nowhere else but the two
seams described above (service success path / central error handler):

```jsonc
// success
{ "success": true, "data": { }, "meta": { } }

// failure — produced only by the central error handler
{ "success": false, "error": { "code": "validation_failed", "message": "…", "details": { } } }
```

**Pagination** — every list endpoint, identically shaped:

```jsonc
{ "success": true,
  "data": [ ],
  "meta": { "page": 1, "limit": 20, "total": 37, "totalPages": 2 } }
```

**Serialization transform** — one shared helper every module's DTO composes with, to drop
internal-only fields (owner id used only for scoping, storage paths, raw third-party
provider responses, error internals) and normalize representations (e.g. timestamps as ISO
strings) uniformly. The goal: a single project-wide serialization rule, not a per-module
decision re-litigated in every DTO file.

**Errors** — a small typed error hierarchy carrying a machine-readable `code`, thrown from
services/controllers, converted to the failure envelope in exactly one place.

---

## 3. Protocol split

### 3.1 REST — request/response

Use for: auth callbacks, CRUD, paginated lists, search, one-off state snapshots (including
a `GET .../status` endpoint that mirrors what the WebSocket would otherwise push — see
3.3), and any "give me the current state" query.

### 3.2 WebSocket — continuous/stateful

Use for: progress streams on a long-running server-side job, and any live/collaborative
feature. Conventions worth keeping:

- One namespace hosting all real-time events, with an event-naming convention like
  `domain:action` (e.g. `job:progress`, `job:completed`, `live:chunk`).
- Structured object payloads in both directions, not bare strings.
- **Connection-time auth.** The client sends its auth token in the handshake payload; the
  server verifies it through the same auth path REST uses and joins the socket to a private,
  per-user room. An unverified socket is disconnected immediately — there is no anonymous
  real-time surface.
- Presence (connect/disconnect) tracked per user so a stateful session (e.g. a live
  recording) survives a reconnect instead of silently being lost.

### 3.3 Always pair a push channel with a pull fallback

Any state the server pushes over WebSocket must also be fetchable via a plain REST
endpoint (e.g. `GET /resource/:id/status`). The client's job-progress UI should:

1. Subscribe to the socket event as the primary source.
2. Fall back to polling the REST endpoint on a fixed interval if the socket is disconnected.
3. Stop polling the instant the socket reconnects.
4. Render from the same state machine regardless of which transport delivered it — the UI
   must behave identically under either.

This is what makes "the socket didn't connect" a degraded experience instead of a broken
one, and it's cheap to build if you design the state machine (§4) up front instead of
threading socket-specific logic through the UI.

### 3.4 Transient vs durable state

When a feature has a "live/in-progress" phase that later becomes a permanent record (a live
recording session that becomes a saved recording; a live document edit that becomes a saved
revision), model it explicitly as two different entities, not one entity with an
in-progress flag:

| | Transient | Durable |
| --- | --- | --- |
| Mutability | Mutated frequently (chunks appended, rolling state replaced) | Immutable once written, except explicit user edits |
| Lifetime | Time-boxed (TTL), swept by a periodic job if abandoned | Permanent |
| Driven by | WebSocket events | REST |

On a clean "end" event, materialize the transient entity into the durable record set via the
owning modules' interfaces, emit a completion event, and expire the transient entity. On an
unclean end (dropped connection, expired TTL with no explicit end), a sweeper job
materializes whatever exists and marks the result complete-with-partial-data or failed — a
dropped connection must never silently lose already-captured work.

---

## 4. The processing pipeline pattern (for any multi-stage async job)

When a feature requires multiple sequential server-side stages (e.g. upload → extract →
transform → analyze → persist), model it as:

1. **A state machine on the primary entity**, forward-only plus one `failed` terminal state:

   ```
   created ──► stage1 ──► stage2 ──► stage3 ──► completed
                  │           │           │
                  └───────────┴───────────┴────► failed  (+ human-readable errorMessage)
   ```

   - Never move backwards. A "reset" is a new record or an explicit, logged exception, not a
     silent backward transition.
   - Every transition to `failed` carries a message a non-technical user could read, never a
     raw stack trace or provider error body.
   - Retry re-enters at the earliest **incomplete** stage, not stage one — if stage 1's
     output already exists and is valid, retry only re-runs from stage 2 onward.
   - Progress shown to the user is a fixed lookup table per state, not a real measurement
     (e.g. `created`→0, `stage2`→0.4, `completed`→1.0) — it exists to make a progress bar
     move meaningfully, not to be precise.

2. **One orchestrator module** (model-less, per §2.1) that is the *only* writer of the
   primary entity's status field from the first async stage onward, and the *only* place
   that translates domain events into both status writes and socket emissions. Each pipeline
   stage module (extract, transform, analyze, …) does its one job and publishes an event when
   done — it must not know what happens next, or that a socket exists at all.

3. **Event bus contracts documented as a table**, e.g.:

   | Event | Publisher | Subscribers |
   | --- | --- | --- |
   | `job:created` | orchestrator | stage-1 module |
   | `stage1:done` | stage-1 module | orchestrator |
   | `stage2:done` | stage-2 module | orchestrator |
   | `pipeline:failed` | any stage | orchestrator (status write + socket emit) |

   Why the event bus instead of stage modules calling each other directly: stage N must not
   import stage N+1 (or know it exists), and no stage module should need to know a socket
   layer exists. The orchestrator is the single place where "what just happened" becomes
   "what does the user see."

4. **Run this as a long-running process, not serverless**, whenever a stage needs a native
   binary/tool unavailable in a serverless runtime, or the job can exceed a serverless
   wall-clock limit, or in-process job state needs to be colocated with open WebSocket
   connections (avoids needing an external queue/pub-sub just to get progress events back to
   the right open socket). Trade-off accepted deliberately: a single process is a scaling
   bottleneck and a single point of failure; the mitigation is that the event bus is already
   an abstraction seam — swapping the in-memory bus for a durable queue later requires no
   module code changes, only a different `eventBus.js` implementation.

---

## 5. Frontend — package-based components

### 5.1 Layers

```
Pages  →  Components  →  Hooks / Services  →  Global Stores / Utils
```

- **Pages** — composition root, typically grouped by access tier (public vs authenticated).
- **Components** — presentation + local interaction logic.
- **Hooks** — stateful logic and event handlers, decoupled from JSX so they're testable
  without a renderer.
- **Services** (component-scoped) — outbound API calls for that specific component only.
- **Global stores** — cross-cutting state that outlives any one component: auth/session,
  the single socket connection, UI/theme state.
- **Global utils/config** — helpers and the single source of truth for backend endpoint
  paths, usable from any layer without violating the dependency direction above.

### 5.2 Layout

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── routes/
│   │   ├── routeTable.js            # centralized URL → page map, with access tier
│   │   └── RouteGuard.jsx           # tier-based gate, mirrors backend authorize middleware
│   ├── pages/
│   │   ├── public/
│   │   └── authenticated/
│   ├── components/
│   │   └── <one directory per component package>/
│   ├── stores/
│   │   ├── auth.store.js
│   │   └── socket.store.js
│   ├── hooks/                       # global hooks only (e.g. useSocketEvent, useAuth)
│   ├── config/
│   │   ├── endpoints.js             # SINGLE source of truth for backend paths
│   │   └── env.js                   # validated env access
│   └── utils/
└── vite.config.js (or equivalent)
```

### 5.3 Package-based componentization

Each component is a self-contained **package**, not a single file:

```
SomeFeature/
├── index.jsx                        # presentation (JSX) only — the ONLY public export
├── sub-components/                  # children private to this package
│   └── SomePart.jsx
├── useSomeFeature.hook.js           # logic: data fetching, socket subscription, handlers
├── someFeature.service.js           # API calls scoped to this component
└── SomeFeature.css                  # or CSS-in-JS / utility classes, per project convention
```

- A component is exposed to the rest of the app **only** through its `index.jsx`. Nothing
  outside the package imports its hook, service, or sub-components directly.
- An `index.jsx` that makes an API call, or a hook file that returns JSX, is a layering
  violation — catch it in review.
- This mirrors the backend's `*.interface.js` convention (§2.1): every unit, backend module
  or frontend component, exposes a narrow public surface and keeps its internals private.

### 5.4 Routing and access control

- One central route table maps every path to a page and an access tier.
- A route guard component enforces the tier before a page renders.
- **The guard is a UX affordance, not security.** Every rule it enforces must be enforced
  again in backend middleware. A client-side-only guard protects nothing, since the API is
  reachable directly.

### 5.5 Real-time on the client

- One global store owns exactly one socket connection for the whole app, created after
  authentication succeeds and torn down on sign-out. Components never construct their own
  socket connection.
- A small `useSocketEvent(event, handler)` hook subscribes/unsubscribes in step with the
  calling component's lifecycle, so components don't hand-roll cleanup.
- Any component driven by a push event implements the fallback described in §3.3.

---

## 6. Cross-cutting principles (why this shape, in one table)

| Principle | Applied as |
| --- | --- |
| Separation of concerns | N-Tier layering — backend per-module, frontend per-component package |
| Bounded contexts | Modular Monolith; one owning module per entity; model-less orchestrator/aggregator modules for cross-cutting flows |
| Encapsulation across boundaries | Modules reachable only via `*.interface.js` or the event bus; components only via `index.jsx` |
| Protocol-appropriate communication | REST for CRUD/snapshots, WebSocket for progress and live/stateful features, always with a pull fallback |
| Data shape consistency | One response envelope, one pagination shape, one serialization transform, project-wide |
| Transient vs durable state | A time-boxed, frequently-mutated entity materializes into a permanent, mostly-immutable record set |
| Defence in depth | Authorization enforced in service/repository layer even when a database-level row-security feature also exists; a frontend route guard is mirrored by backend middleware |
| Failure as a first-class state | A terminal `failed` state with a human-readable message at every async stage, surfaced over both protocols |

---

## 7. Applying this to a new project — checklist

1. Identify the bounded contexts (one per persistent entity/table, grouped by the
   capability that owns it). List them in a table like §2.2 of
   `docs/system.doc/ARCHITECTURE.md` before writing any module code.
2. Identify which flows are "just CRUD" (REST only) vs which need a live progress/streaming
   UI (REST + WebSocket, with the pull fallback from §3.3).
3. If there's a multi-stage async job anywhere, design its state machine and event-bus
   contract table (§4) before writing the first stage.
4. Decide the response envelope and DTO serialization rule (§2.4) once, project-wide, before
   the first controller is written — retrofitting it later means touching every module.
5. Set up the module/component directory skeletons (§2.2, §5.2) empty, so the boundary
   convention exists before the first line of business logic, not after.
6. Write down the non-negotiable rules (§2.3's list, §5.3's "index.jsx only" rule) in the
   project's own CLAUDE.md / contributing doc, and reference *this* pattern doc from it —
   don't re-derive the reasoning each time, and don't over-build patterns the project's
   scale doesn't need (see the "what not to build" spirit of
   `docs/server.doc/OOP_PATTERNS_GUIDE.md` §5 in this repo: prefer a guard function over a
   full State-pattern class hierarchy for a handful of states, prefer a flat orchestrator
   function over an abstract Template Method base class for a linear pipeline — introduce a
   named design pattern only where real variation exists, e.g. Strategy+Factory for "N
   interchangeable ways to do the same conceptual step").
