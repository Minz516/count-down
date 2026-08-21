---
name: Obsidian Chronos
colors:
  surface: '#101319'
  surface-dim: '#101319'
  surface-bright: '#363940'
  surface-container-lowest: '#0b0e14'
  surface-container-low: '#191c22'
  surface-container: '#1d2026'
  surface-container-high: '#272a30'
  surface-container-highest: '#32353b'
  on-surface: '#e1e2ea'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#e1e2ea'
  inverse-on-surface: '#2d3037'
  outline: '#8e9197'
  outline-variant: '#44474c'
  surface-tint: '#bac7de'
  primary: '#bac7de'
  on-primary: '#243143'
  primary-container: '#5c697d'
  on-primary-container: '#dde9ff'
  inverse-primary: '#525f73'
  secondary: '#b9c8dd'
  on-secondary: '#243142'
  secondary-container: '#3d4a5c'
  on-secondary-container: '#abb9cf'
  tertiary: '#dfc29e'
  on-tertiary: '#3f2d14'
  tertiary-container: '#7b6446'
  on-tertiary-container: '#ffe3c3'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e3fb'
  primary-fixed-dim: '#bac7de'
  on-primary-fixed: '#0f1c2d'
  on-primary-fixed-variant: '#3b485a'
  secondary-fixed: '#d5e4fa'
  secondary-fixed-dim: '#b9c8dd'
  on-secondary-fixed: '#0e1c2c'
  on-secondary-fixed-variant: '#3a4859'
  tertiary-fixed: '#fddeb8'
  tertiary-fixed-dim: '#dfc29e'
  on-tertiary-fixed: '#281903'
  on-tertiary-fixed-variant: '#574328'
  background: '#101319'
  on-background: '#e1e2ea'
  surface-variant: '#32353b'
  surface-deep: '#0f1115'
  surface-elevated: '#252a31'
  accent-warning: '#e0a899'
  text-muted: '#8d99ae'
typography:
  hero-countdown:
    fontFamily: Hanken Grotesk
    fontSize: 80px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.04em
  hero-countdown-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1'
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 800px
  gutter: 1.5rem
  margin-mobile: 1rem
  stack-lg: 3rem
  stack-md: 1.5rem
  stack-sm: 0.75rem
---

## Brand & Style

The design system is centered on the concept of "Quiet Anticipation." It moves away from the anxiety often associated with deadlines, favoring a calm, focused environment that emphasizes the passage of time as a graceful progression. 

The aesthetic is **Sophisticated Minimalism** with a **Corporate-Modern** foundation. It prioritizes high-quality typography and intentional negative space to reduce cognitive load. By utilizing a deep, desaturated palette, the UI creates a "sanctuary" feel—an easy-on-the-eyes interface that feels premium and utility-driven without being stark or cold. Surfaces are layered using subtle tonal shifts rather than harsh borders, ensuring the focus remains entirely on the temporal data.

## Colors

The palette is anchored by the primary **Slate Blue (#5c697d)**, which provides a professional and calming anchor for the UI. The background uses a deep "Obsidian" neutral to minimize eye strain in low-light environments.

- **Primary:** Used for the most critical active states and the main Hero Card countdown digits.
- **Secondary:** A lighter, desaturated tint used for secondary actions and subtle iconography.
- **Neutral:** A tiered system of dark grays. The background is the darkest (#0f1115), while interactive cards use a slightly lighter tier (#252a31).
- **Readability Fix:** Contrast ratios are maintained above 4.5:1 for all primary information by using an off-white or light gray for body text, rather than pure white, to prevent "glowing" text on dark backgrounds.

## Typography

Typography is the primary vehicle for hierarchy in this design system. 

- **Hanken Grotesk** is used for headlines and the main countdown. Its sharp, contemporary geometry feels precise and modern.
- **Manrope** provides a highly legible, slightly warmer body text to ensure descriptions and secondary data are comfortable to read.
- **JetBrains Mono** is reserved for labels and metadata (e.g., "DAYS LEFT", "DEADLINE"). The monospaced nature adds a technical, "clock-like" precision to the temporal data.

For the Hero Card, the countdown numbers use the largest scale to create an immediate focal point. On mobile, these scale down significantly to ensure the live counter remains on a single line.

## Layout & Spacing

The layout follows a **Fixed Grid** approach for desktop, centered and constrained to a narrow 800px column. This "reading lane" prevents the eye from wandering and keeps the countdown front and center.

- **The Hero Section:** Occupies the top portion of the screen with `stack-lg` padding to separate the "Immediate" from the "Upcoming."
- **The Feed:** A vertical list of cards with `stack-md` spacing between items.
- **Responsive Behavior:** 
  - **Desktop:** 800px centered container with generous side margins.
  - **Tablet:** Full-width with 48px horizontal padding.
  - **Mobile:** Full-width with 16px horizontal padding. The Hero Card digits scale down to accommodate smaller widths.

## Elevation & Depth

This design system uses **Tonal Layering** instead of heavy shadows to define depth. This maintains the minimalist, "clean" aesthetic requested.

- **Base Layer:** The deepest neutral color (#0f1115).
- **Surface Layer:** All cards (Hero and List) use a slightly lighter gray (#1a1d23). 
- **Interactive Layer:** On hover or active states, cards elevate further to #252a31. 
- **Subtle Definition:** A 1px solid border using a very low-opacity primary color (10-15%) is used on cards to provide edge definition without the visual weight of a drop shadow. This creates a "precision-milled" look.

## Shapes

The shape language is **Rounded**, using an 8px (0.5rem) base radius. This softens the technical nature of a countdown app and makes the interface feel more approachable and "human."

- **Cards:** Use `rounded-lg` (1rem) to create a distinct, soft container for events.
- **Input Fields & Buttons:** Use the base 8px radius for consistency.
- **Progress Indicators:** Small decorative elements (like the status dots) are fully rounded (pill-shaped) to distinguish them from structural elements.

## Components

### Hero Countdown Card
The centerpiece of the app. It features the event name in `headline-lg`, the countdown in `hero-countdown`, and the specific date in `label-caps`. The background is a subtle gradient from the primary color (at 5% opacity) to the surface color.

### Event List Item
A compact version of the card. It uses a horizontal layout: Title on the left (`body-lg`), and "X Days Left" on the right in `label-caps` using the primary color to draw focus.

### Buttons
- **Primary:** Solid background in #5c697d with off-white text. No shadows.
- **Ghost:** No background, border in #5c697d at 30% opacity. Used for "Add Event" or "Cancel" actions.

### Input Fields
Darker than the surface layer (#0f1115) to create an "inset" feel. Borders appear only on focus using the primary color. Typography inside inputs uses `body-lg`.

### Past Events Section
This section uses lowered opacity (60%) and grayscale tones to indicate the events are no longer active, keeping them visible but mentally archived.