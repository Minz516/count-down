# DESIGN.md - Countdown ("ChronoFlow") Implementation Design System

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
data-grid dashboard - it's a narrow, mostly-empty-space personal tool (one hero card + a
short list) - so the typography/color/shape/motion/a11y discipline applies cleanly. What
does **not** apply and is deliberately skipped: hero-viewport rules, marquees, bento grids,
GSAP scroll-hijacking, logo walls, section-eyebrow budgets. There is no marketing page here.

**Dials** (inferred from the existing references, not the skill's baseline - this is
preserve mode):

| Dial | Value | Why |
|---|---|---|
| `DESIGN_VARIANCE` | **3** | Fixed 800px reading-lane, centered, symmetrical list rows. The brief is explicit about this ("prevents the eye from wandering"). Do not introduce asymmetric grids or bento layouts. |
| `MOTION_INTENSITY` | **3** | "Quiet Anticipation" is the opposite of kinetic. Motion is limited to live data updates, hover/press feedback, and enter/exit transitions. No scroll-driven choreography. |
| `VISUAL_DENSITY` | **3** | Airy, generous `stack-lg` / `stack-md` spacing per THEME.md. Not a cockpit - a calm list. |

## 1. Design System Choice

**No UI kit.** Build with Tailwind v4 utilities bound to CSS variables generated 1:1 from
the `colors:` and `typography:` blocks in `THEME.md`. Reasons: the brand is fully specified
down to hex values and font stacks already; importing shadcn/Radix/etc. would mean fighting
default tokens instead of using the ones that exist.

```css
/* app/globals.css - tokens sourced from docs/THEME.md, do not hand-edit values here */
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
  --status-past: #7fb08a;      /* green, muted - see §5 */
  --status-today: #e5484d;     /* red */
  --status-soon: #e0b84f;      /* yellow */
}
```

Wire these into `tailwind.config.ts` as `colors.surface.*`, `colors.on.*`, etc. Never write
raw hex in components - always the token.

**Stack confirmation (matches ARCHITECTURE.md, no change):** Next.js App Router + TS +
Tailwind v4, Supabase client-side. Client Components only for the parts that need them:
`useCountdown` hook, the Hero Card's ticking digits, the add/edit form, delete-confirm
buttons. Everything else (layout, static list rendering) stays a Server Component.

## 2. Color - Consistency Lock

**One accent, used identically everywhere: Slate Blue `primary-container` (#5c697d) /
`primary` (#bac7de) on dark.** It appears on: the Hero Card countdown digits, primary
buttons, focus rings, the "còn X ngày" upcoming label, active nav underline. Nowhere else
introduces a second brand color.

**Status colors are a separate, bounded system** (not "accent creep") - exactly three,
each always paired with text, never color alone:

| Status | Color | Text label | Used only in the timeline/recurring cards |
|---|---|---|---|
| Past (24h grace) | muted green `--status-past` | "Đã qua" | list row status pill + past-events dimming |
| Today / nearest | red `--status-today` | "Hôm nay" | list row status pill (bold) |
| Soon (≤7d) | yellow `--status-soon` | "còn X ngày" | list row status pill |
| Later (>7d) | `--text-muted` | "còn X ngày" | list row status pill |

**Tinted-chip variant, still bounded:** `StatusLabel`'s optional `chip` prop renders the same
status color as a `rounded-full bg-{status}/12 text-{status}` pill instead of bare colored
text - used on Timeline rows and the recurring "còn X ngày" badge. This is the approved way
to make a card read as "more colorful" without introducing a new hue: reuse the existing
bounded status color at low-opacity background + full-opacity text, never a fifth color.

**Flag - reference inconsistency to resolve:** `references/register-login.png` renders the
"ChronoFlow" wordmark and the "Quiet Anticipation." subtitle in a multi-color rainbow
gradient. That directly violates the one-accent rule the rest of the system follows (Hero
Card, buttons, dashboard - all single slate-blue accent). Recommendation: drop the rainbow
treatment and set the wordmark in `on-surface` white with the `primary` accent used only on
a small mark/icon, matching every other screen. If the rainbow wordmark is an intentional
one-time brand flourish, confirm that explicitly - don't let it leak beyond the auth
screen's logo lockup (it currently doesn't, per the reference, so this is containment
guidance, not a live bug).

**Contrast check (WCAG AA):** `on-surface` (#e1e2ea) on `surface` (#101319) = ~14.8:1, pass.
`text-muted` (#8d99ae) on `surface` = ~5.4:1, pass for body text. `on-primary` (#243143) on
`primary` (#bac7de) = ~8.7:1, pass. `status-today` red on `surface-container` needs the text
label bolded at 14px minimum (JetBrains Mono `label-caps` already specifies 500 weight,
12px - bump to 600 weight for the "Hôm nay" pill specifically since red-on-dark at 12px/500
sits close to the AA edge for non-bold text).

## 3. Typography - usage map

Already fully specified in THEME.md. This section only maps tokens to actual elements so
there's no ambiguity during build, and confirms **Vietnamese diacritic support** (status
labels are Vietnamese: "Đã qua", "Hôm nay", "còn X ngày", "Lặp lại", "hàng tuần") - Hanken
Grotesk, Manrope, and JetBrains Mono all ship Vietnamese-subset glyphs on Google Fonts;
load with `next/font/google` and `subsets: ['latin', 'vietnamese']` explicitly, don't rely
on the default Latin subset silently dropping diacritics into fallback fonts.

| Element | Token | Notes |
|---|---|---|
| Hero Card countdown digits | `hero-countdown` / `hero-countdown-mobile` | `font-variant-numeric: tabular-nums` mandatory - prevents digit-width jitter every second |
| Hero Card event name | `headline-lg` | |
| Section headers ("Upcoming", "Past Events") | `headline-md` | plain text, no eyebrow treatment (§0 - this isn't a marketing page) |
| List item event name | `body-lg` | |
| List item date | `body-sm`, `text-muted` | |
| Status pill / "X Days Left" | `label-caps` | JetBrains Mono, always uppercase per token, `tabular-nums` for the digit |
| Recurring badge ("Lặp lại - Chủ Nhật hàng tuần") | `label-caps` | |
| Form field labels | `label-caps` | label **above** input, never placeholder-as-label (add-event.png already does this correctly - keep it) |
| Nav links | `label-caps` | matches reference (DASHBOARD / UPCOMING / HISTORY) |

## 4. Shape - Consistency Lock

One radius scale, per THEME.md `rounded:` tokens. No exceptions:

- Cards (Hero, list items, recurring cards, modal): `rounded-lg` (1rem)
- Buttons, inputs: `rounded` (0.5rem / 8px base)
- Status dots, "Days Left" pills: `rounded-full`
- Never mix - a pill-shaped card or a sharp-cornered button both break the lock.

## 5. Elevation & Depth

Tonal layering only, per THEME.md - **no drop shadows anywhere in this app.**

- Base: `surface-deep` (#0f1115)
- Card resting state: `surface-container` (#1d2026) with a `1px solid` border at
  `primary-container` (#5c697d) and **10-15% opacity** (`rgb(92 105 125 / 0.12)`)
- Card hover/active: `surface-elevated` (#252a31), border opacity steps up to ~20%
- Interactive lift feedback: `transform: translateY(-1px)` on hover, `scale(0.98)` on
  `:active` - motion, not shadow, communicates the lift (see §7)

## 6. Iconography

References use a bell (notifications) and a circular user avatar in the nav, plus edit/
delete icon-buttons implied by UI_SPEC's "icon buttons" for timeline actions. Standardize
on **Phosphor Icons** (`@phosphor-icons/react`), `regular` weight, stroke width fixed at
`1.5` everywhere. Do not hand-roll SVGs for these - use `Bell`, `UserCircle`, `PencilSimple`,
`Trash`, `Plus`, `X`, `CaretDown` from Phosphor. One family, no Lucide mixing.

The bell icon must reflect real notification state (a dot badge only when there's something
to show) - no decorative always-on dot.

## 7. Motion (per `MOTION_INTENSITY: 3`)

Static by default; motion is functional only. Every animation below is justified by one of:
hierarchy, feedback, or state transition - never "because it looked cool."

- **Live countdown tick:** no animation on the digit change itself (a flashing/sliding
  digit every second would be exhausting to look at, contra "Quiet Anticipation"). Just
  re-render the tabular-nums text.
- **Card hover/press:** `transition: transform 150ms ease-out, background-color 150ms
  ease-out` - translateY(-1px) lift + surface-elevated swap. Feedback, not decoration.
- **Add/delete a timeline row:** Motion's `layout` + `AnimatePresence` for a soft
  height-collapse and fade (200-250ms, `ease: [0.16, 1, 0.3, 1]`) - state transition, so the
  list doesn't jump-cut when an item is removed.
- **Modal open/close (Add/Edit Event):** fade + scale-from-0.98, 150ms. Backdrop fades
  separately.
- **Past-event dimming:** CSS transition on opacity/grayscale filter when an event crosses
  into its 24h grace window while the app is open, 300ms - a state transition worth
  noticing without being alarming.
- All of the above wrapped behind `useReducedMotion()` (Motion) - degrade instantly to the
  end state, no exceptions, since none of this is decorative enough to be worth forcing.

## 8. Components

### 8.1 App Shell / Nav
Single line, height ≤ 64px, per reference. Left: wordmark (single-color, see §2 flag).
Center/left-of-actions: Dashboard / Upcoming / History as plain `label-caps` text links,
active state = `primary` color + 1px underline (no pill background per shape lock - pills
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
  opacity with a solid `primary` fill - avoid the "dashboard gauge" look; this is a single
  quiet line, not a metric.
- Mobile: `hero-countdown-mobile` (48px), stays on one line per UI_SPEC.

### 8.3 Timeline / Event List Item
`Timeline` only ever receives today/future events - `DashboardClient` filters past events out
before the list reaches it and renders them in the separate, compact §8.7 section instead, so
there's no past-event dimming state to handle here anymore.

`Timeline` owns a connecting rail, not just a stack of independent cards: each row is
`[dot + line segment column] [card]`, where the line segment is a `w-px` div that stretches
(`flex-1`) down to the next row's dot, so segments compose into one continuous rail with no
measurement/JS - the row's own bottom padding (not a `gap` on the list) is what lets the line
touch the next dot. `EventListItem` itself is now pure card content - it takes `status` as a
prop from `Timeline` (which computes `getEventStatus` once per row) rather than deriving it
itself, and no longer renders its own dot.

Card: `surface-container`, `rounded-lg`: `[date line (mono, muted) + event name (semibold)]
... [status chip] [edit icon] [delete icon]`. Date line uses `formatTimelineDate`
(`lib/dateFormat.ts`) - short Vietnamese weekday + dd/mm/yyyy (e.g. "T3, 18/08/2026") - not
`formatEventDate`, which stays reserved for the Hero Card's long English format.

Status dot (`TimelineDot` in `StatusIndicator.tsx`): `rounded-full`, 8px, filled with the
row's status color - this is the one legitimate use of a decorative-looking dot in the whole
app, because it carries real semantic state. The single nearest-upcoming row (first non-past
event in the already-sorted list, derived locally in `Timeline`) gets `emphasized`: a larger
dot (14px) with a soft ring in that *same* status color - not forced to a fixed hue. A
"today" row stays urgent-red even when it's also the nearest one; only "soon" rows render
amber. Forcing a fixed color for emphasis would break the bounded status-color rule above.

Edit/delete: icon-only buttons, `ghost` style, visible on hover on desktop / always visible
on touch. Edit hovers to `primary` (accent-action intent), delete stays `error`
(danger-action intent).

### 8.4 Recurring Event Card
Visually distinct per UI_SPEC: `border-dashed` instead of the timeline's solid low-opacity
border, otherwise same card treatment. Shows "Lặp lại - [Thứ] hàng tuần" (`label-caps`,
`secondary` color), event name (`body-lg`), and "còn X ngày" to next occurrence.

### 8.5 Add / Edit Event Form (modal, per add-event.png)
- `surface-container` panel, `rounded-lg`, centered overlay on a dimmed backdrop
  (`surface-deep` at ~70% opacity, no blur needed - blur is a §5 shadow-adjacent effect
  this system doesn't use elsewhere).
- Fields, label above input per §3: Name (required), Deadline date + time (required, two
  fields side by side per reference), Description (optional, textarea).
- Inputs: darker than surface (`surface-container-lowest` / `#0b0e14`), border only on
  focus in `primary`, `body-lg` type inside. Placeholder text at `text-muted` - verify
  contrast (§2, passes at 5.4:1).
- **Deadline date/time are hand-built, not native `<input type="date"/"time">`**
  (`DateField.tsx` / `TimeField.tsx`) - the native date input renders a locale-dependent
  mm/dd/yyyy placeholder and the native time input can render 12h AM/PM depending on browser
  locale, neither of which this app wants. `DateField` gives two ways to set a date: three
  segmented dd/mm/yyyy digit inputs (auto-advance on 2 digits, backspace-to-previous-segment,
  blur clamps/pads each segment reading the live DOM value rather than React state - a
  synchronous-blur-during-auto-advance race otherwise reads one keystroke stale), or a
  trailing calendar-icon button that opens `CalendarPopup`, a hand-built month-grid picker
  (no dependency - this app has no date-picker library and isn't adding one). `TimeField` is
  two segments (HH 0-23 / MM 0-59), always 24h, with no AM/PM control anywhere. Both emit the
  same plain-string contract (`yyyy-mm-dd` / `HH:mm`) the rest of `EventForm` already used
  with the native inputs, so `toDateTimeParts`/`fromDateTimeParts` needed no changes. Segment
  and field containers use `flex-1`/`min-w-0` (not fixed pixel widths) so the control fills
  its field box evenly instead of clustering left with dead space before the icon.
- `CalendarPopup` is a plain conditional (`{open && <CalendarPopup .../>}`), not wrapped in
  `AnimatePresence` - nested inside `EventForm`'s own `AnimatePresence` (itself nested inside
  `DashboardClient`'s), an exit animation here got stuck (opacity animated to 0 but the node
  never unmounted). The mount-in fade still plays via `initial`/`animate` without
  `AnimatePresence`; only the exit fade is sacrificed. Native HTML5 `required` is also
  dropped on the deadline fields since a segmented input can't carry it meaningfully - no
  functional loss, since `EventForm`'s existing `if (!name.trim() || !deadlineIso)` JS check
  already independently enforces it before submit.
- Past-deadline warning: inline text below the deadline field, `accent-warning` color, not
  a blocking error - matches PRD's "warns but does not block."
- Actions: Cancel (`ghost`), Save (`primary`), right-aligned, single line, no wrap.

### 8.6 Buttons
- **Primary:** solid `primary-container` (#5c697d) background, `on-primary`-equivalent
  light text (verify: use `#e1e2ea` on the button, not `on-primary` #243143 which is dark-
  on-dark-primary - reference shows light "ADD EVENT" text on the slate button, confirm
  actual contrast at build time: #e1e2ea on #5c697d = ~4.6:1, passes AA for the label size).
  No shadow. `:active` → `scale(0.98)`.
- **Ghost:** transparent, 1px border `primary-container` at 30% opacity, text in `primary`.
  Used for Cancel, icon-only edit/delete buttons.
- **Danger (delete confirm only):** same ghost structure, `error` color border/text instead
  of primary - keep it visually quiet until the user is actually in a delete-confirm state.

### 8.7 Past Events Section
Pulled out of the Timeline entirely (docs/UI_SPEC.md) into its own compact section
(`PastEventsSection.tsx` / `PastEventCard.tsx`), pinned at the bottom of the page below
Recurring - the least important, most transient content on the dashboard, since an event only
lives here for the 24h grace window before the cleanup cron hard-deletes it.

Rows are deliberately smaller and quieter than a Timeline row: `surface-container-lowest`
(one tone darker, not the Timeline's `surface-container`), `text-sm` event name in
`text-muted` (not `on-surface`/semibold), no status dot or chip - the section header already
says "past," repeating a colored status label on every row would be noise. Same 60%
opacity + grayscale filter (`filter: grayscale(1) opacity(0.6)`) per THEME.md as before,
easing to full opacity on hover so the row is still legible when the user is actually looking
at it. Section header is `label-caps`/`text-muted`, not the `headline-md` used for "Timeline"/
"Recurring" - a visually quieter heading for a visually quieter section. Section renders
nothing at all when there are no past events, matching §8.4's Recurring Section guard.

### 8.8 Empty State
Per UI_SPEC: no events yet → friendly, plain-language message (no cute AI copy, per taste - 
e.g. "No events yet. Add your first deadline to start the countdown." not "Your timeline
awaits its first moment") + a single "Add Event" primary button. Centered in the space where
the Hero Card would otherwise sit, same card treatment as the Hero Card shell so the layout
doesn't visually collapse.

### 8.9 Loading State
Skeleton rows matching the timeline item's exact shape (dot + two text lines + pill-shaped
placeholder), `surface-elevated` shimmer, not a generic spinner - per skill guidance, and
because a spinner over a mostly-static list reads as heavier than the content it's loading.

## 9. Responsive

Per THEME.md, unchanged: 800px centered container desktop, 48px padding tablet, 16px
padding mobile, `hero-countdown` → `hero-countdown-mobile` breakpoint. `min-h-[100dvh]` for
the page shell, never `h-screen`, to avoid iOS Safari chrome jumping the layout.

## 10. Pre-Flight Checklist (subset applicable to this app)

- [x] One accent color used identically everywhere - flag on wordmark gradient noted (§2)
- [x] One radius scale, no mixed shapes (§4)
- [x] No drop shadows - tonal layering + low-opacity borders only (§5)
- [x] Button contrast verified (§8.6)
- [x] Form contrast verified (§8.5)
- [x] Status color always paired with text label, never color-alone (§2)
- [x] Icons from one library (Phosphor), no hand-rolled SVGs (§6)
- [x] Motion justified per-animation, all wrapped in `useReducedMotion` (§7)
- [x] Dual mode: dark base plus an additive light theme (see §11)
- [x] Empty / loading / error states specified (§8.8, §8.9, §8.5)
- [x] No em-dash anywhere in UI copy
- [x] Vietnamese diacritics confirmed supported by the chosen fonts (§3)
- [ ] **Open item for the user:** confirm whether the rainbow wordmark on the auth screen
      is intentional brand flourish or an inconsistency to fix before build (§2).

## 11. Redesign v2 (overhaul): dark and light mode, responsive shell

Mode: redesign, overhaul of the visual language. IA, URLs, nav labels, form field names, the
logo file and legal copy are unchanged. Dials moved from 3 / 3 / 4 to **5 / 5 / 4**
(`DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY`). This extends the sections above;
it does not replace them. Sections 2 to 8 still hold, except where §11 says otherwise.

### 11.1 Theme tokens (dark is the base, light is additive)

- One palette, one accent: the cool slate family and the slate-blue accent are shared by both
  themes. The light theme is NOT warm. The cream and lavender canvases of the Slacc reference
  (Appendix A) were not adopted because mixing warm and cool grays breaks the one-palette rule.
- Tokens are CSS variables in `app/globals.css`. Dark values live on `:root`. Light values apply
  when `prefers-color-scheme: light` AND no explicit choice (`:root:not([data-theme="dark"])`),
  or when `<html data-theme="light">`. The light block is declared twice (media query and
  attribute selector) and the two copies must stay in sync.
- Explicit choice is stored in `localStorage["theme"]` (`light` or `dark`). An inline script in
  `app/layout.tsx` applies it before first paint. Absence of a choice means "follow the OS".
- Toggle: `components/ThemeToggle.tsx`. `ThemeMenuItem` sits in the account menu,
  `ThemeIconButton` sits top-right on the login and signup screens.
- Never pure `#000` or `#fff` for page surfaces. Raised surfaces in light use `#fdfdfe` or
  `#ffffff` only as card and menu fills.

| Token | Dark | Light |
|---|---|---|
| `surface-deep` (page) | `#0f1115` | `#f1f3f7` |
| `surface-container` (card) | `#1d2026` | `#fdfdfe` |
| `surface-container-lowest` (input) | `#0b0e14` | `#eef1f6` |
| `surface-elevated` (menu, hover) | `#252a31` | `#ffffff` |
| `on-surface` | `#e1e2ea` | `#151a23` |
| `text-muted` | `#8d99ae` | `#56627a` |
| `primary` (accent text, active) | `#bac7de` | `#3f506a` |
| `primary-container` (button fill) | `#5c697d` | `#475770` |
| `on-primary-container` (button text) | `#f1f4fa` | `#f7f9fc` |
| `error` | `#ffb4ab` | `#b3261e` |
| `field-border` (input outline) | `#646b75` | `#737d8f` |
| `status-past / today / soon` | `#7fb08a / #ff6b6f / #e0b84f` | `#28683a / #c9252c / #7d5a00` |

Use `text-on-primary-container` on any `bg-primary-container` fill. `text-on-surface` on it fails
contrast in light.

### 11.2 Responsive shell

- Content and header share one container: `max-w-[1120px]`, padding `px-4` (mobile), `sm:px-8`,
  `lg:px-12`. Header inner width equals content width so they line up.
- Below `sm` (640px): top bar holds the logo, ONE Add Event button, the bell and the account menu.
  Settings moves into the account menu. Personal and Group move to a fixed, labelled bottom tab bar
  (`components/Nav.tsx`). Pages that show it need `pb-28` on mobile. The group dashboard has no
  bottom bar (drill-down view): back arrow, Add Event, gear, bell, avatar, and the group name on its
  own row beneath so it is never truncated.
- From `lg` (1024px) the dashboards use two columns: sticky hero countdown (5fr) and the lists (7fr).
  Below `lg` they stack in one column. The Groups list is a 1, 2 or 3 column grid.
- Touch targets: 44px minimum on mobile (`Button` is `min-h-11` below `sm`, icon buttons use `p-3`
  below `sm`). Desktop may use smaller targets.
- Event rows wrap: title (two-line clamp) first, then status chip and edit/delete icons. The chip
  never wraps its own text.

### 11.2b Contrast (measured, not eyeballed)

`npm run check:contrast` (scripts/check-contrast.mjs) reads the tokens from `app/globals.css` and checks
every text pair at 4.5:1, every status chip against its own 12% tint, and input borders at 3:1, in
both themes. It also fails if the two light blocks drift apart. Run it after changing any color token.
Input and field borders use `border-field-border`, not `border-outline-variant` (which is a decorative
divider color and fails the 3:1 boundary rule on its own).

### 11.3 Motion (v2)

- Route content eases in with `.content-rise` (opacity and 8px rise, 320ms). Purpose: state
  transition between pages. Disabled under `prefers-reduced-motion`.
- Theme change cross-fades `background-color` and `color` on `body` for 200ms. Disabled under
  reduced motion.
- No new loops. The only continuous motion remains the 1 second countdown tick.

### 11.4 Updated pre-flight notes

- [x] Dark and light both tested at 1440, 768 and 390 on `/`, `/groups`, `/groups/[id]`, `/settings`
- [x] No horizontal scroll at any tested size
- [x] One theme per page view, no mid-page inversion
- [x] Single Add Event per screen
- [x] No em-dash in UI copy or in this section

### 11.5 Interface rules enforced by the review pass

- Every modal uses `lib/useDialog.ts` plus `role="dialog"`, `aria-modal="true"` and `aria-labelledby`.
  Escape closes, Tab is trapped, focus returns to the opener, background scroll is locked, and a
  reload warns once the user has typed. Overlays carry `overscroll-contain`.
- Every input has a `name`, a label (visible or `aria-label`), and `autoComplete` set deliberately.
  Usernames, emails, codes and URLs also disable spellcheck. Placeholders end with an ellipsis.
- Standalone inputs show a `:focus-visible` outline in addition to the border change. Compound
  controls (icon plus input) use `focus-within`.
- Phosphor icons are `aria-hidden`; the control around them carries the accessible name.
- Errors use `role="alert"`, success and progress messages use `role="status"`.
- Hover-only controls (checklist and notification delete) are always visible below `sm`.
- Destructive actions confirm through `ConfirmDialog` (event, group, checklist item, webhook).
- Secrets are masked in the UI: `lib/webhook.ts` `maskWebhookUrl`.
- Dates render through `components/LocalDate.tsx` so the viewer's time zone is used and the server
  never prints a different one. `lib/dateFormat.ts` uses `Intl.DateTimeFormat`.
- Page shell: skip link to `#main`, one `h1` per page, `theme-color` per scheme, `touch-action:
  manipulation` on controls, `scroll-padding-bottom` for the fixed tab bar.

## Appendix A: Slacc-inspired reference (kept for its light-mode structure)

Reference material supplied for the light theme. What was taken: layered white canvases, near-black
ink, hairline borders, softer shapes. What was not taken: aubergine accent, cream and lavender
canvases, pill buttons, the Salesforce fonts. Em-dashes in the original were replaced with hyphens.

---
version: alpha
name: Slacc-Inspired-design-analysis
description: An inspired interpretation of Slacc's design language  -  a workplace messaging brand built on a deep aubergine primary, with cream-lavender hero gradients, blue inline links, and pill CTAs. The system pairs a proprietary humanist sans for display with a separate utility sans for body, and stages product UI mockups inside soft pastel-mesh hero composites that act as both decoration and feature explanation.

colors:
  primary: "#4a154b"
  primary-deep: "#481a54"
  primary-press: "#611f69"
  primary-tint: "#592466"
  on-primary: "#ffffff"
  ink: "#1d1d1d"
  ink-mute: "#696969"
  link-blue: "#1264a3"
  link-hover: "#3860be"
  canvas: "#ffffff"
  canvas-cream: "#f4ede4"
  canvas-lavender: "#f9f0ff"
  surface-elev: "#ffffff"
  surface-aubergine: "#4a154b"
  hairline: "#e6e6e6"
  hairline-strong: "#000000"
  semantic-error: "#cc4117"
  semantic-success: "#007a5a"
  on-aubergine-mute: "#d9bdde"

typography:
  display-xxl:
    fontFamily: "Salesforce-Avant-Garde, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: -0.768px
  display-xl:
    fontFamily: "Salesforce-Avant-Garde, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 58px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.464px
  display-lg:
    fontFamily: "Salesforce-Avant-Garde, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 50px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: -0.6px
  display-md:
    fontFamily: "Salesforce-Avant-Garde, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.256px
  heading-lg:
    fontFamily: "Salesforce-Avant-Garde, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: -0.096px
  heading-md:
    fontFamily: "Salesforce-Avant-Garde, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  heading-sm:
    fontFamily: "Salesforce-Avant-Garde, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.56
    letterSpacing: -0.0216px
  body-lg:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: -0.0216px
  body-md:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-strong:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0.16px
  button-lg:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0
  button-md:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.38
    letterSpacing: 0.2px
  button-cap:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 14.4px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0.144px
  caption:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0.1px
  micro-cap:
    fontFamily: "Salesforce-Sans, system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0.96px

rounded:
  xs: 2px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 48px
  pill: 90px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 24px
  huge: 28px

components:
  button-primary-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 14px 28px
  button-primary-pill-pressed:
    backgroundColor: "{colors.primary-press}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 14px 28px
  button-secondary-pill:
    backgroundColor: "{colors.canvas-lavender}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 10px 30px
  button-outline-aubergine:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 14px 28px
  button-outline-on-aubergine:
    backgroundColor: "{colors.surface-aubergine}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: 14px 28px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 10px 12px
  pill-cap-shade:
    backgroundColor: "{colors.canvas-cream}"
    textColor: "{colors.ink}"
    typography: "{typography.micro-cap}"
    rounded: "{rounded.pill}"
    padding: 4px 12px
  card-pricing:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 32px
  card-pricing-featured:
    backgroundColor: "{colors.surface-aubergine}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 32px
  card-feature-cream:
    backgroundColor: "{colors.canvas-cream}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 32px
  card-aubergine-band:
    backgroundColor: "{colors.surface-aubergine}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.xl}"
    padding: 48px
  card-stat:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.xl}"
    padding: 32px
  nav-bar-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xs}"
    padding: 16px 24px
  link-on-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.link-blue}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xs}"
    padding: 0px
  link-on-aubergine:
    backgroundColor: "{colors.surface-aubergine}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xs}"
    padding: 0px
  footer-aubergine:
    backgroundColor: "{colors.surface-aubergine}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 32px 24px
---

## Overview

Slacc's design language centers on a deep aubergine primary (`{colors.primary}`)  -  the brand's most enduring visual asset  -  applied as the dominant button color, the footer band, the featured pricing tier, and the brand wordmark. Around that aubergine the system stages an unusually delicate ecosystem: cream-lavender hero canvases with soft pastel-mesh gradients (peachy oranges, lavenders, dusty greens) that pulse behind floating product UI mockups, with the actual interface chrome rendered in fine detail at 3:2 aspect.

Typography splits between two proprietary humanist sans families. The display tier runs at 700 weight at sizes 32-64px with negative letter-spacing for tight optical density on hero headlines. The UI tier uses the second family at 400-700 with slightly relaxed leading (1.55)  -  the brand's body copy reads quietly without competing with the aubergine moments.

Buttons are pill-shaped at 90px radius with an unusual amount of horizontal padding (28-30px), giving them a distinctly comfortable, almost over-padded feel. The primary aubergine pill is the only filled button in most contexts; secondary actions use a soft lavender pill (`{colors.canvas-lavender}`) which reads as a gentler echo of the primary surface. Inline links shift to a saturated blue (`{colors.link-blue}`)  -  the brand's only chromatic departure from the aubergine-and-cream world.

**Key Characteristics:**
- Single aubergine primary (`{colors.primary}`) reused across CTAs, the featured pricing tier, the footer band, and the wordmark  -  the brand's chromatic monotheism.
- Cream-lavender hero canvas (`{colors.canvas-cream}` / `{colors.canvas-lavender}`) with diffused pastel-mesh atmospheric gradients and floating UI mockups composited above.
- Pill buttons at `{rounded.pill}` (90px radius) with generous 28-30px horizontal padding  -  over-padded by SaaS-default standards, deliberately so.
- Tight negative letter-spacing on display sizes (-0.768px on 64px hero) for editorial-density headlines.
- Blue inline links (`{colors.link-blue}`)  -  the only non-aubergine chromatic accent in body type.
- Pastel-mesh gradient atmospherics: every hero band has a subtle peach-lavender-dusty-green wash behind it; product UI sits on top, never inside, the gradient.
- Statistics cards rendered in massive aubergine display type (90% / 43 / 87%) on white  -  quantitative emphasis through scale alone.

## Colors

> **Source pages:** home (`/`), `/features/channels`, `/pricing`, `/contact-sales`.

### Brand & Accent
- **Aubergine** (`{colors.primary}`  -  `#4a154b`): The brand's primary surface and CTA color. Deep, warm purple with a hint of ruby  -  used on filled buttons, the featured pricing tier, the footer band, and the brand wordmark.
- **Aubergine Deep** (`{colors.primary-deep}`  -  `#481a54`): A near-identical sibling of `{colors.primary}` extracted from a different surface; treat as functionally equivalent.
- **Aubergine Press** (`{colors.primary-press}`  -  `#611f69`): Pressed-state lift of the primary, slightly lighter and warmer.
- **Aubergine Tint** (`{colors.primary-tint}`  -  `#592466`): Border accent on aubergine-on-aubergine surfaces.
- **Link Blue** (`{colors.link-blue}`  -  `#1264a3`): Inline link color  -  saturated, slightly warm blue. The only chromatic alternative to aubergine in body type.
- **Link Hover** (`{colors.link-hover}`  -  `#3860be`): A more saturated blue used on link hover state.

### Surface
- **Canvas White** (`{colors.canvas}`  -  `#ffffff`): Default content surface.
- **Canvas Cream** (`{colors.canvas-cream}`  -  `#f4ede4`): Warm off-white used on hero gradients and feature bands. Adds editorial warmth.
- **Canvas Lavender** (`{colors.canvas-lavender}`  -  `#f9f0ff`): Pale lavender tint used as the secondary-button surface and as a soft section band.
- **Surface Aubergine** (`{colors.surface-aubergine}`  -  `#4a154b`): The primary aubergine reused as a surface  -  featured pricing tier, footer, dark feature bands.
- **Hairline** (`{colors.hairline}`  -  `#e6e6e6`): 1px borders on cards and table dividers.

### Text
- **Ink** (`{colors.ink}`  -  `#1d1d1d`): Primary body text on light surfaces. Just shy of pure black.
- **Ink Mute** (`{colors.ink-mute}`  -  `#696969`): Secondary text, captions, helper copy.
- **On Primary** (`{colors.on-primary}`  -  `#ffffff`): Text on aubergine surfaces and filled CTAs.
- **On Aubergine Mute** (`{colors.on-aubergine-mute}`  -  `#d9bdde`): Secondary text on aubergine surfaces  -  a desaturated mauve that reads as muted-light.

### Semantic
- **Error** (`{colors.semantic-error}`  -  `#cc4117`): Form error and destructive-action color.
- **Success** (`{colors.semantic-success}`  -  `#007a5a`): Inline success indicators.

## Typography

### Font Family

The display tier is **Salesforce Avant Garde**  -  a proprietary humanist sans with broad apertures and a slightly geometric character. When unavailable, fall back to the system font stack (`system-ui, -apple-system, BlinkMacSystemFont`).

The UI tier is **Salesforce Sans**  -  a separate proprietary face used for body, captions, and button labels. Same fallback chain.

Both faces are proprietary and not freely available. Substitute with **Inter** (open-source via Google Fonts) at matching weights for both display and body  -  Inter is the closest open analogue across both tiers.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xxl}` | 64px | 700 | 1.12 | -0.768px | Marketing hero headline |
| `{typography.display-xl}` | 58px | 600 | 1.25 | -0.464px | Section openers |
| `{typography.display-lg}` | 50px | 700 | 1.12 | -0.6px | Statistics callouts |
| `{typography.display-md}` | 32px | 700 | 1.25 | -0.256px | Card / feature titles |
| `{typography.heading-lg}` | 24px | 700 | 1.33 | -0.096px | Pricing tier names |
| `{typography.heading-md}` | 22px | 600 | 1.4 | 0 | Sub-section heading |
| `{typography.heading-sm}` | 18px | 600 | 1.56 | -0.0216px | Compact card title |
| `{typography.body-lg}` | 18px | 400 | 1.55 | -0.0216px | Marketing body lead |
| `{typography.body-md}` | 16px | 400 | 1.55 | 0 | Default UI body |
| `{typography.body-strong}` | 16px | 700 | 1.5 | 0.16px | Emphasized body |
| `{typography.button-lg}` | 18px | 700 | 1.0 | 0 | Hero pill button label |
| `{typography.button-md}` | 16px | 700 | 1.38 | 0.2px | Standard pill button label |
| `{typography.button-cap}` | 14.4px | 700 | 1.0 | 0.144px | Compact pill label |
| `{typography.caption}` | 14px | 400 | 1.43 | 0.1px | Helper, footnote |
| `{typography.micro-cap}` | 12px | 700 | 1.0 | 0.96px | All-caps eyebrow |

### Principles
- **Tight tracking on display.** Negative letter-spacing across 32-64px sizes; the proprietary face is wide by default, the negative tracking pulls it into editorial density.
- **Body at 1.55 leading.** Slightly relaxed for marketing readability without crossing into airy / 1.7+ territory.
- **Caps for eyebrows.** All eyebrows render uppercase with positive 0.96-0.144px tracking depending on size.

### Note on Font Substitutes
Use **Inter** (open-source Google Fonts) for both display and UI tiers  -  Inter at 700 weight with `-0.768px` letter-spacing closely approximates the brand's display behavior. For maximum brand fidelity, **Lato** is a softer humanist alternative that pairs well at body sizes. Avoid System UI fonts on the body  -  the brand's subtle warmth disappears at default weights.

## Layout

### Spacing System
- **Base unit**: 8px (with 4 / 12 / 16 / 20 / 24 / 28 sub-tokens for fine vertical rhythm).
- **Tokens**: `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.lg}` 16px · `{spacing.xl}` 20px · `{spacing.xxl}` 24px · `{spacing.huge}` 28px.
- **Section padding**: 64-96px on marketing surfaces; tightens to 48px on transactional pages.
- **Card internal padding**: 32px on pricing cards; 48px on aubergine band cards.

### Grid & Container
- Marketing pages center in a ~1240px container with edge-bleeding pastel-mesh gradients escaping the container.
- Pricing collapses 4-up → 2-up → 1-up at 992 / 768 breakpoints.
- Statistics row: 3-column grid with massive 50px aubergine display numerals.

### Whitespace Philosophy
The pastel-mesh gradients fill most of the negative space on marketing pages  -  sections feel expansive without being literally empty. On transactional pages the gradients drop, and whitespace reverts to traditional 48px-section breathing room.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | Flat | Default surface |
| 1 | `box-shadow: rgba(0,0,0,0.1) 0 5px 20px 0` | Floating buttons on hero |
| 2 | `box-shadow: rgba(0,0,0,0.1) 0 0 32px 0` | Product UI mockup composites |
| 3 | `box-shadow: rgba(0,0,0,0.2) 0 1px 10px 0` | Toast / notification chrome |
| 4 | `box-shadow: rgb(97,31,105) 0 0 0 1px inset` | Aubergine inset border (button focus, special chrome) |

### Decorative Depth
The brand's depth language is the **pastel-mesh gradient**  -  peach, lavender, dusty green stops blurred together at large radii to create soft atmospheric backdrops behind product UI screenshots. The gradient is the brand's flavor of "depth without shadows": the eye perceives the product mockup as floating above a luminous backdrop without any literal lift.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 2px | Hairline tags, status pills (rare) |
| `{rounded.sm}` | 4px | Form inputs |
| `{rounded.md}` | 8px | Compact card chrome, video frames |
| `{rounded.lg}` | 12px | Mid-size cards, secondary surface |
| `{rounded.xl}` | 16px | Pricing cards, feature cards |
| `{rounded.xxl}` | 48px | Stat badge backdrops |
| `{rounded.pill}` | 90px | All buttons |

### Photography Geometry
The brand uses **product UI screenshots** more than photography. UI mockups sit on top of pastel-mesh gradients at roughly 4:3 aspect, with no shadow but with the gradient providing the "lift" the eye expects. Real photography appears in customer-logo strips and the occasional case-study card, treated as full-bleed inside `{rounded.xl}` containers.

## Components

### Buttons

**`button-primary-pill`**  -  the dominant CTA system-wide.
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button-md}`, padding `14px 28px`, rounded `{rounded.pill}` 90px.
- Pressed state `button-primary-pill-pressed` shifts background to `{colors.primary-press}`.

**`button-secondary-pill`**  -  the soft lavender alternative.
- Background `{colors.canvas-lavender}`, text `{colors.ink}`, padding `10px 30px`, same pill geometry. Used as the second action beside the primary aubergine pill.

**`button-outline-aubergine`**  -  outline variant on white surfaces.
- Background `{colors.canvas}`, text `{colors.primary}`, 2px solid `{colors.primary}` border, same pill shape.

**`button-outline-on-aubergine`**  -  outline on aubergine canvas.
- Background `{colors.surface-aubergine}` (transparent over the surface), text `{colors.on-primary}`, 2px solid `{colors.on-primary}` border, same pill shape.

### Cards & Containers

**`card-pricing`**  -  standard pricing tier card.
- Background `{colors.canvas}`, padding `{spacing.xxl}+` (32px), rounded `{rounded.xl}` 16px, 1px `{colors.hairline}` border. Title in `{typography.heading-lg}`, price in `{typography.display-md}`, body in `{typography.body-md}`, CTA pinned to bottom as `button-primary-pill`.

**`card-pricing-featured`**  -  the inverted aubergine featured tier.
- Background `{colors.surface-aubergine}`, text `{colors.on-primary}`, otherwise identical to `card-pricing`. The aubergine fill is the brand's signature featured-tier choice.

**`card-feature-cream`**  -  feature explanation card on the cream track.
- Background `{colors.canvas-cream}`, text `{colors.ink}`, rounded `{rounded.xl}`, padding 32px.

**`card-aubergine-band`**  -  large horizontal band card with aubergine fill, often containing the closing CTA of a marketing page.
- Background `{colors.surface-aubergine}`, text `{colors.on-primary}`, padding 48px, rounded `{rounded.xl}` 16px.

**`card-stat`**  -  statistics callout card.
- Background `{colors.canvas}`, text `{colors.primary}` rendered in `{typography.display-lg}` (50px aubergine numeral). Holds a single percentage/number with a small caption underneath.

### Inputs & Forms

**`text-input`**  -  standard form field.
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-md}`, padding `10px 12px`, rounded `{rounded.sm}` 4px, 1px `{colors.hairline}` border.

### Navigation

**`nav-bar-light`**  -  top nav across all marketing pages.
- Background `{colors.canvas}`, text `{colors.ink}`, padding `{spacing.lg} {spacing.xxl}`. Logo wordmark on the left, nav items center, two pill buttons on the right (`button-secondary-pill` for "Sign In", `button-primary-pill` for "Try For Free").

### Pills, Tags, and Chips

**`pill-cap-shade`**  -  small all-caps pill used as eyebrow above pricing-tier titles.
- Background `{colors.canvas-cream}`, text `{colors.ink}`, type `{typography.micro-cap}`, padding `4px 12px`, rounded `{rounded.pill}`.

### Signature Components

**Pastel-Mesh Gradient Backdrop**  -  peach (`#fff0e6`-ish) + lavender (`#e9d8ff`) + dusty green stops blurred together behind hero bands. Implemented as a CSS radial-gradient stack, not a single image. Provides the brand's depth/luminosity without literal shadows.

**Floating Product UI Mockup**  -  product screenshots framed in `{rounded.lg}` (12px) containers, positioned above the pastel-mesh gradient with no border or shadow. The gradient does the lifting.

**Aubergine Footer Band**  -  every marketing page closes with a full-bleed `card-aubergine-band` containing a closing CTA in white type. The band height is generous (~480-600px on desktop) and reads as the page's signature.

**`link-on-light`**  -  inline links in body copy on light surfaces.
- Text `{colors.link-blue}` rendered in `{typography.body-md}`. No underline by default; underline appears on hover via the link-hover behavior.

**`link-on-aubergine`**  -  links inside aubergine surfaces.
- Text `{colors.on-primary}` with persistent underline.

**`footer-aubergine`**  -  site-wide footer.
- Background `{colors.surface-aubergine}`, text `{colors.on-primary}` rendered in `{typography.caption}`, padding `{spacing.huge}+ {spacing.xxl}` (32px 24px). Holds 4-5 columns of `{colors.on-aubergine-mute}` link groups, social icons, and a small legal/copyright row at the bottom.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` aubergine for filled CTAs, the featured pricing tier, and the closing aubergine band  -  it's the brand's chromatic monotheism.
- Use `{rounded.pill}` (90px) for every button across the system  -  never a rounded-rectangle button.
- Pair display tiers with negative letter-spacing (`-0.768px` at 64px); the proprietary face needs the tracking pull.
- Compose hero bands with pastel-mesh gradient backdrop + floating product UI mockup; the gradient is the depth.
- Use `{colors.link-blue}` for inline links  -  it's the only chromatic departure from aubergine and is part of the brand voice.

### Don't
- Don't add a third accent color to the system  -  the aubergine + blue link combination is exhaustive.
- Don't shrink button padding below `14px 28px`  -  the over-padded pill is part of the brand feel.
- Don't render display tiers at default tracking (0)  -  without negative letter-spacing the headlines read loose and unedited.
- Don't put product UI screenshots inside cards  -  they sit ABOVE the pastel-mesh gradient, never inside chrome.
- Don't use aubergine for body text  -  it's a surface and CTA color, not a type color at body sizes.
- Don't replace the pill shape with a square button anywhere.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Wide | ≥ 1440px | Full-bleed pastel-mesh hero; pricing 4-up |
| Desktop | 1024-1440px | Default content max-width; pricing 4-up |
| Tablet | 768-1023px | Pricing 2-up; product UI mockups crop to focal panel |
| Mobile | < 768px | Pricing 1-up; hamburger nav; display-xxl drops 64 → 40px |

### Touch Targets
- Pill buttons hit ≥ 48×48px due to the over-padded geometry. WCAG AAA compliant.
- Form fields stay at the 44px minimum height.

### Collapsing Strategy
- Display tiers stair-step 64 → 50 → 32 → 28 → 24 across breakpoints.
- Pastel-mesh gradients re-tile on mobile to prevent the wash from disappearing entirely.
- Floating product UI mockups crop to the most actionable inner panel on mobile.
- Pricing tiers stair-step 4 → 2 → 1; aubergine featured tier stays distinguished.
- Top nav collapses to hamburger below 768px; menu inherits canvas color.

### Image Behavior
Product UI mockups use `srcset` for desktop / tablet / mobile crops; the mobile crop centers on the most actionable inner panel rather than scaling the whole composite down.

## Iteration Guide

1. Focus on ONE component at a time.
2. Reference component names and tokens directly (`{colors.primary}`, `{button-primary-pill}-pressed`, `{rounded.pill}`).
3. Run `npx @google/design.md lint DESIGN.md` after edits.
4. Add new variants as separate entries.
5. Default body to `{typography.body-md}`; reserve `{typography.body-lg}` for marketing leads.
6. Keep aubergine scarce  -  one filled aubergine button per viewport.
7. Pair every hero band with the pastel-mesh gradient backdrop; bare-canvas heroes read as off-brand.
