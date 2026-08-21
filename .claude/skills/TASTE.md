# TASTE.md — Personal Design Taste Reference

> Distilled from the Countdown / ChronoFlow brand (`THEME.md`, `references/*.png`) and the
> anti-slop discipline in the `design-taste-frontend` skill. This is meant to outlive this
> one project: read it before starting the visual design of any future app so the same
> decisions don't have to be re-litigated, and the same mistakes don't get repeated.

## Palette

- **Deep desaturated dark neutrals + exactly one muted accent.** "Obsidian" near-black
  bases (`#0f1115` territory), never pure `#000000`. One accent color, used identically
  everywhere it appears — never a second accent sneaking in for "variety."
- **Never AI-purple, never oversaturated neon.** The accent should be calm and desaturated
  (this project's is a slate blue, `#5c697d`). If a future brief calls for a livelier brand,
  rotate to a different family entirely rather than defaulting to violet glow.
- **Status/semantic colors are a separate bounded system from the brand accent** — a small,
  fixed set (e.g. past/today/soon), each color always paired with a text label. Never rely
  on color alone to communicate state.
- **Gradient text/wordmarks are a red flag if the rest of the system is single-accent.**
  Caught this exact inconsistency in the reference login screen (rainbow "ChronoFlow"
  wordmark against an otherwise strict one-accent system) — see `DESIGN.md` §2. Default
  answer going forward: keep the wordmark in the neutral/on-surface color with the accent
  reserved for a small mark, not the whole logotype, unless a gradient brand mark is an
  explicit, deliberate, one-time decision — confirm before applying it anywhere else.

## Typography

- **A distinct type family per role, not one font doing everything:** a display/headline
  sans, a warmer body sans, and a monospace reserved for data/labels/timestamps. This
  project's set (Hanken Grotesk / Manrope / JetBrains Mono) is the template to reach for
  again — geometric sans for headlines, humanist sans for body, mono for anything
  "technical/precise" (countdowns, metadata labels, timestamps).
- **Avoid Inter as the default.** Reach for it only when the brief is explicitly neutral/
  standard (e.g. public-sector, accessibility-first).
- **Mono for numbers that move or need to align:** live counters, countdowns, tabular data.
  Always pair with `font-variant-numeric: tabular-nums` so digit width doesn't jitter.
- **Labels sit above inputs, never inside as a placeholder-only label.** Non-negotiable.
- **If the product's copy is in a language with diacritics (Vietnamese, etc.), explicitly
  verify the chosen fonts ship that Unicode subset** before locking the type stack — don't
  assume Latin-subset defaults cover it silently.

## Shape

- **One radius scale per project, enforced everywhere.** Soft-rounded is the default taste
  (8px base for buttons/inputs, ~16px/1rem for cards) — approachable without being toy-like.
  Pill/full-radius is reserved specifically for status dots and count badges, never for
  structural elements like cards or nav bars. Don't let a button be pill-shaped in an
  otherwise soft-square system.

## Elevation & Depth

- **Tonal layering over drop shadows.** Depth comes from stepping through a tiered surface
  scale (base → container → elevated) plus a thin, low-opacity accent-tinted border (10-20%
  opacity) for edge definition — not from `box-shadow` blur. This reads as more precise and
  less "webby" than shadow-based elevation, and it's the taste default now.
- If shadows are ever used, they must be tinted to the background hue, never pure black.

## Motion

- **Restrained and functional, not cinematic.** Motion should always be traceable to one of:
  hierarchy, feedback, or a state transition. No motion "because it looked cool," no
  scroll-hijacking, no infinite decorative loops on informational content.
- **Live data should not animate for its own sake.** A ticking countdown just updates the
  text — don't add a slide/flash per second; it becomes exhausting on something the user
  looks at continuously. Save animation for discrete events (item added/removed, modal open,
  hover/press feedback).
- Always wrap non-trivial motion in a reduced-motion check and degrade to the instant end
  state — no exceptions carved out for "just this one."

## Status / Semantic Signaling

- **Color + text label together, always.** Never ship a status indicator that relies on
  hue alone (accessibility, and it also just reads clearer).
- **De-emphasize rather than hide.** Inactive/past/archived items get reduced opacity +
  desaturation (grayscale filter), staying visible but clearly "not current" — don't remove
  them from view entirely if the product logic says they should still be visible for a while.

## Layout & Density

- **Prefer a narrow, centered "reading lane" over full-bleed dashboards** for personal/
  single-focus tools (this project's 800px column). Full-width, high-density layouts are for
  genuine multi-panel dashboards, not a one-hero-card-plus-a-list utility app.
- **Airy over cockpit by default.** Reach for tight/dense layouts only when the brief is
  genuinely data-heavy (a real dashboard, admin panel), not by default.

## Copy Voice

- **Plain and functional, not cute.** Avoid AI-flavored copy that tries too hard ("Your
  timeline awaits its first moment") in favor of direct, useful language ("No events yet.
  Add your first deadline to start the countdown."). This applies to empty states, button
  labels, and helper text alike.
- No filler marketing verbs (elevate, unleash, seamless, next-gen) in a utility product's UI
  copy — that register belongs to landing pages, not app chrome.
- No em-dashes in shipped UI copy.

## Icons

- **One icon family per project, consistent stroke weight.** Default to Phosphor unless a
  project already has a different family established. Never hand-roll SVG icon paths.
- Icons that imply live state (notification bells, status dots) must reflect real state —
  no permanently-on decorative badges.

## Working Notes

- When a brand/theme is already partially defined (existing theme doc, reference
  screenshots, a design system started elsewhere), treat it as **redesign-preserve**: audit
  what's there, operationalize it into implementation-ready tokens/specs, and call out any
  internal inconsistencies explicitly rather than silently "fixing" or silently keeping them.
- Producing a `DESIGN.md` that maps every UI element to a specific token (not just "use the
  brand colors") is the format that's worked well — implementation-ready, not just a mood
  board restatement.
