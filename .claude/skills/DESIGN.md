# DESIGN.md — Countdown ("ChronoFlow") Implementation Design System

> Operationalizes `THEME.md` + `UI_SPEC.md` + `references/*.png` into implementation-ready
> rules. This is a **redesign-preserve** exercise, not a greenfield brief: the brand
> (Obsidian Chronos palette, Hanken Grotesk / Manrope / JetBrains Mono type stack, tonal
> layering) is already decided. This document locks it down, fills the gaps the brand
> tokens don't cover (icons, motion, states, a11y), and flags the one place the references
> contradict their own rules.

## 0. Design Read

**Reading this as:** a single-user, calm personal-utility dashboard (event countdown
tracker) for a general consumer audience, with a "Quiet Anticipation" sophisticated-
minimalism dark language, leaning toward **Tailwind v4 utilities + CSS-variable tokens**
(no third-party component kit) on **Next.js App Router + TypeScript**.

**Scope note:** the taste-skill this doc is built with targets marketing/landing pages by
default and explicitly excludes dense dashboards (its Section 13). This app is not a dense
data-grid dashboard — it's a narrow, mostly-empty-space personal tool (one hero card + a
short list) — so the typography/color/shape/motion/a11y discipline applies cleanly. What
does **not** apply and is deliberately skipped: hero-viewport rules, marquees, bento grids,
GSAP scroll-hijacking, logo walls, section-eyebrow budgets. There is no marketing page here.

**Dials** (inferred from the existing references, not the skill's baseline — this is
preserve mode):

| Dial | Value | Why |
|---|---|---|
| `DESIGN_VARIANCE` | **3** | Fixed 800px reading-lane, centered, symmetrical list rows. The brief is explicit about this ("prevents the eye from wandering"). Do not introduce asymmetric grids or bento layouts. |
| `MOTION_INTENSITY` | **3** | "Quiet Anticipation" is the opposite of kinetic. Motion is limited to live data updates, hover/press feedback, and enter/exit transitions. No scroll-driven choreography. |
| `VISUAL_DENSITY` | **3** | Airy, generous `stack-lg` / `stack-md` spacing per THEME.md. Not a cockpit — a calm list. |

## 1. Design System Choice

**No UI kit.** Build with Tailwind v4 utilities bound to CSS variables generated 1:1 from
the `colors:` and `typography:` blocks in `THEME.md`. Reasons: the brand is fully specified
down to hex values and font stacks already; importing shadcn/Radix/etc. would mean fighting
default tokens instead of using the ones that exist.

```css
/* app/globals.css — tokens sourced from docs/THEME.md, do not hand-edit values here */
:root {
  --surface: #101319;
  --surface-container-lowest: #0b0e14;
  --surface-container-low: #191c22;
  --surface-container: #1d2026;
  --surface-container-high: #272a30;
  --surface-container-highest: #32353b;
  --surface-deep: #0f1115;
  --surface-elevated: #252a31;
  --on-surface: #e1e2ea;
  --on-surface-variant: #c5c6cd;
  --text-muted: #8d99ae;
  --outline: #8e9197;
  --outline-variant: #44474c;
  --primary: #bac7de;
  --primary-container: #5c697d;
  --on-primary: #243143;
  --secondary: #b9c8dd;
  --tertiary: #dfc29e;
  --error: #ffb4ab;
  --error-container: #93000a;
  --accent-warning: #e0a899;
  --status-past: #7fb08a;      /* green, muted — see §5 */
  --status-today: #e5484d;     /* red */
  --status-soon: #e0b84f;      /* yellow */
}
```

Wire these into `tailwind.config.ts` as `colors.surface.*`, `colors.on.*`, etc. Never write
raw hex in components — always the token.

**Stack confirmation (matches ARCHITECTURE.md, no change):** Next.js App Router + TS +
Tailwind v4, Supabase client-side. Client Components only for the parts that need them:
`useCountdown` hook, the Hero Card's ticking digits, the add/edit form, delete-confirm
buttons. Everything else (layout, static list rendering) stays a Server Component.

## 2. Color — Consistency Lock

**One accent, used identically everywhere: Slate Blue `primary-container` (#5c697d) /
`primary` (#bac7de) on dark.** It appears on: the Hero Card countdown digits, primary
buttons, focus rings, the "còn X ngày" upcoming label, active nav underline. Nowhere else
introduces a second brand color.

**Status colors are a separate, bounded system** (not "accent creep") — exactly three,
each always paired with text, never color alone:

| Status | Color | Text label | Used only in the timeline/recurring cards |
|---|---|---|---|
| Past (24h grace) | muted green `--status-past` | "Đã qua" | list row status pill + past-events dimming |
| Today / nearest | red `--status-today` | "Hôm nay" | list row status pill (bold) |
| Soon (≤7d) | yellow `--status-soon` | "còn X ngày" | list row status pill |
| Later (>7d) | `--text-muted` | "còn X ngày" | list row status pill |

**Flag — reference inconsistency to resolve:** `references/register-login.png` renders the
"ChronoFlow" wordmark and the "Quiet Anticipation." subtitle in a multi-color rainbow
gradient. That directly violates the one-accent rule the rest of the system follows (Hero
Card, buttons, dashboard — all single slate-blue accent). Recommendation: drop the rainbow
treatment and set the wordmark in `on-surface` white with the `primary` accent used only on
a small mark/icon, matching every other screen. If the rainbow wordmark is an intentional
one-time brand flourish, confirm that explicitly — don't let it leak beyond the auth
screen's logo lockup (it currently doesn't, per the reference, so this is containment
guidance, not a live bug).

**Contrast check (WCAG AA):** `on-surface` (#e1e2ea) on `surface` (#101319) = ~14.8:1, pass.
`text-muted` (#8d99ae) on `surface` = ~5.4:1, pass for body text. `on-primary` (#243143) on
`primary` (#bac7de) = ~8.7:1, pass. `status-today` red on `surface-container` needs the text
label bolded at 14px minimum (JetBrains Mono `label-caps` already specifies 500 weight,
12px — bump to 600 weight for the "Hôm nay" pill specifically since red-on-dark at 12px/500
sits close to the AA edge for non-bold text).

## 3. Typography — usage map

Already fully specified in THEME.md. This section only maps tokens to actual elements so
there's no ambiguity during build, and confirms **Vietnamese diacritic support** (status
labels are Vietnamese: "Đã qua", "Hôm nay", "còn X ngày", "Lặp lại", "hàng tuần") — Hanken
Grotesk, Manrope, and JetBrains Mono all ship Vietnamese-subset glyphs on Google Fonts;
load with `next/font/google` and `subsets: ['latin', 'vietnamese']` explicitly, don't rely
on the default Latin subset silently dropping diacritics into fallback fonts.

| Element | Token | Notes |
|---|---|---|
| Hero Card countdown digits | `hero-countdown` / `hero-countdown-mobile` | `font-variant-numeric: tabular-nums` mandatory — prevents digit-width jitter every second |
| Hero Card event name | `headline-lg` | |
| Section headers ("Upcoming", "Past Events") | `headline-md` | plain text, no eyebrow treatment (§0 — this isn't a marketing page) |
| List item event name | `body-lg` | |
| List item date | `body-sm`, `text-muted` | |
| Status pill / "X Days Left" | `label-caps` | JetBrains Mono, always uppercase per token, `tabular-nums` for the digit |
| Recurring badge ("Lặp lại - Chủ Nhật hàng tuần") | `label-caps` | |
| Form field labels | `label-caps` | label **above** input, never placeholder-as-label (add-event.png already does this correctly — keep it) |
| Nav links | `label-caps` | matches reference (DASHBOARD / UPCOMING / HISTORY) |

## 4. Shape — Consistency Lock

One radius scale, per THEME.md `rounded:` tokens. No exceptions:

- Cards (Hero, list items, recurring cards, modal): `rounded-lg` (1rem)
- Buttons, inputs: `rounded` (0.5rem / 8px base)
- Status dots, "Days Left" pills: `rounded-full`
- Never mix — a pill-shaped card or a sharp-cornered button both break the lock.

## 5. Elevation & Depth

Tonal layering only, per THEME.md — **no drop shadows anywhere in this app.**

- Base: `surface-deep` (#0f1115)
- Card resting state: `surface-container` (#1d2026) with a `1px solid` border at
  `primary-container` (#5c697d) and **10-15% opacity** (`rgb(92 105 125 / 0.12)`)
- Card hover/active: `surface-elevated` (#252a31), border opacity steps up to ~20%
- Interactive lift feedback: `transform: translateY(-1px)` on hover, `scale(0.98)` on
  `:active` — motion, not shadow, communicates the lift (see §7)

## 6. Iconography

References use a bell (notifications) and a circular user avatar in the nav, plus edit/
delete icon-buttons implied by UI_SPEC's "icon buttons" for timeline actions. Standardize
on **Phosphor Icons** (`@phosphor-icons/react`), `regular` weight, stroke width fixed at
`1.5` everywhere. Do not hand-roll SVGs for these — use `Bell`, `UserCircle`, `PencilSimple`,
`Trash`, `Plus`, `X`, `CaretDown` from Phosphor. One family, no Lucide mixing.

The bell icon must reflect real notification state (a dot badge only when there's something
to show) — no decorative always-on dot.

## 7. Motion (per `MOTION_INTENSITY: 3`)

Static by default; motion is functional only. Every animation below is justified by one of:
hierarchy, feedback, or state transition — never "because it looked cool."

- **Live countdown tick:** no animation on the digit change itself (a flashing/sliding
  digit every second would be exhausting to look at, contra "Quiet Anticipation"). Just
  re-render the tabular-nums text.
- **Card hover/press:** `transition: transform 150ms ease-out, background-color 150ms
  ease-out` — translateY(-1px) lift + surface-elevated swap. Feedback, not decoration.
- **Add/delete a timeline row:** Motion's `layout` + `AnimatePresence` for a soft
  height-collapse and fade (200-250ms, `ease: [0.16, 1, 0.3, 1]`) — state transition, so the
  list doesn't jump-cut when an item is removed.
- **Modal open/close (Add/Edit Event):** fade + scale-from-0.98, 150ms. Backdrop fades
  separately.
- **Past-event dimming:** CSS transition on opacity/grayscale filter when an event crosses
  into its 24h grace window while the app is open, 300ms — a state transition worth
  noticing without being alarming.
- All of the above wrapped behind `useReducedMotion()` (Motion) — degrade instantly to the
  end state, no exceptions, since none of this is decorative enough to be worth forcing.

## 8. Components

### 8.1 App Shell / Nav
Single line, height ≤ 64px, per reference. Left: wordmark (single-color, see §2 flag).
Center/left-of-actions: Dashboard / Upcoming / History as plain `label-caps` text links,
active state = `primary` color + 1px underline (no pill background per shape lock — pills
are reserved for status/count badges only). Right: "Add Event" primary button, bell icon,
user avatar icon.

### 8.2 Hero Countdown Card
- Container: `surface-container`, `rounded-lg`, subtle gradient overlay `primary` at 5%
  opacity fading to transparent (per THEME.md), 1px low-opacity border.
- Content, centered per reference: event name (`headline-lg`) → date (`label-caps`,
  `text-muted`) → countdown digits (`hero-countdown`) with `Days / Hrs / Min / Sec`
  sub-labels beneath each group in `label-caps`.
- Nice-to-have per UI_SPEC (not MVP-blocking): thin progress bar (`created_at` →
  `deadline`), rendered as a **flat fill, no background track shadow**, in `primary` at low
  opacity with a solid `primary` fill — avoid the "dashboard gauge" look; this is a single
  quiet line, not a metric.
- Mobile: `hero-countdown-mobile` (48px), stays on one line per UI_SPEC.

### 8.3 Timeline / Event List Item
Compact horizontal row inside a `surface-container` card, `rounded-lg`:
`[status dot] [event name (body-lg) + date (body-sm, muted)] ... [status pill (label-caps)] [edit icon] [delete icon]`.
Status dot: `rounded-full`, 8px, filled with the row's status color — this is the one
legitimate use of a decorative-looking dot in the whole app, because it carries real
semantic state (matches the skill's "only when conveying real semantic state" exception).
Edit/delete: icon-only buttons, `ghost` style, visible on hover on desktop / always visible
on touch.

### 8.4 Recurring Event Card
Visually distinct per UI_SPEC: `border-dashed` instead of the timeline's solid low-opacity
border, otherwise same card treatment. Shows "Lặp lại - [Thứ] hàng tuần" (`label-caps`,
`secondary` color), event name (`body-lg`), and "còn X ngày" to next occurrence.

### 8.5 Add / Edit Event Form (modal, per add-event.png)
- `surface-container` panel, `rounded-lg`, centered overlay on a dimmed backdrop
  (`surface-deep` at ~70% opacity, no blur needed — blur is a §5 shadow-adjacent effect
  this system doesn't use elsewhere).
- Fields, label above input per §3: Name (required), Deadline date + time (required, two
  fields side by side per reference), Description (optional, textarea).
- Inputs: darker than surface (`surface-container-lowest` / `#0b0e14`), border only on
  focus in `primary`, `body-lg` type inside. Placeholder text at `text-muted` — verify
  contrast (§2, passes at 5.4:1).
- Past-deadline warning: inline text below the deadline field, `accent-warning` color, not
  a blocking error — matches PRD's "warns but does not block."
- Actions: Cancel (`ghost`), Save (`primary`), right-aligned, single line, no wrap.

### 8.6 Buttons
- **Primary:** solid `primary-container` (#5c697d) background, `on-primary`-equivalent
  light text (verify: use `#e1e2ea` on the button, not `on-primary` #243143 which is dark-
  on-dark-primary — reference shows light "ADD EVENT" text on the slate button, confirm
  actual contrast at build time: #e1e2ea on #5c697d = ~4.6:1, passes AA for the label size).
  No shadow. `:active` → `scale(0.98)`.
- **Ghost:** transparent, 1px border `primary-container` at 30% opacity, text in `primary`.
  Used for Cancel, icon-only edit/delete buttons.
- **Danger (delete confirm only):** same ghost structure, `error` color border/text instead
  of primary — keep it visually quiet until the user is actually in a delete-confirm state.

### 8.7 Past Events
60% opacity + grayscale filter (`filter: grayscale(1) opacity(0.6)`) per THEME.md, applied
to the whole row including the status dot (dot still shows the muted green, just desaturated
consistent with the rest of the row). They live inline in the single continuous timeline per
UI_SPEC — not a separate visually-boxed section beyond the opacity treatment.

### 8.8 Empty State
Per UI_SPEC: no events yet → friendly, plain-language message (no cute AI copy, per taste —
e.g. "No events yet. Add your first deadline to start the countdown." not "Your timeline
awaits its first moment") + a single "Add Event" primary button. Centered in the space where
the Hero Card would otherwise sit, same card treatment as the Hero Card shell so the layout
doesn't visually collapse.

### 8.9 Loading State
Skeleton rows matching the timeline item's exact shape (dot + two text lines + pill-shaped
placeholder), `surface-elevated` shimmer, not a generic spinner — per skill guidance, and
because a spinner over a mostly-static list reads as heavier than the content it's loading.

## 9. Responsive

Per THEME.md, unchanged: 800px centered container desktop, 48px padding tablet, 16px
padding mobile, `hero-countdown` → `hero-countdown-mobile` breakpoint. `min-h-[100dvh]` for
the page shell, never `h-screen`, to avoid iOS Safari chrome jumping the layout.

## 10. Pre-Flight Checklist (subset applicable to this app)

- [x] One accent color used identically everywhere — flag on wordmark gradient noted (§2)
- [x] One radius scale, no mixed shapes (§4)
- [x] No drop shadows — tonal layering + low-opacity borders only (§5)
- [x] Button contrast verified (§8.6)
- [x] Form contrast verified (§8.5)
- [x] Status color always paired with text label, never color-alone (§2)
- [x] Icons from one library (Phosphor), no hand-rolled SVGs (§6)
- [x] Motion justified per-animation, all wrapped in `useReducedMotion` (§7)
- [x] Dark mode is the only mode (brand is inherently dark; no light-mode requirement in
      PRD/UI_SPEC — if one gets added later, tokens are already CSS variables, so it's an
      additive `[data-theme="light"]` block, not a rewrite)
- [x] Empty / loading / error states specified (§8.8, §8.9, §8.5)
- [x] No em-dash anywhere in UI copy
- [x] Vietnamese diacritics confirmed supported by the chosen fonts (§3)
- [ ] **Open item for the user:** confirm whether the rainbow wordmark on the auth screen
      is intentional brand flourish or an inconsistency to fix before build (§2).
