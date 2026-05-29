# JourneyLine Ops Dashboard — Design System

Scope: `/dashboard/ops/*` — the marketer/founder's cockpit for generating, scoring, rendering, and approving ad creative. Other dashboard surfaces (`/dashboard` creator app) use the separate light-theme indigo/coral/teal system and are NOT covered here.

## Intent

**Who:** A founder or marketer working from a laptop in fragmented sessions. They are the operator of an ad factory. Fast, decisive, calm. Often have the ad they're rendering open in another tab — Canva, Meta Ads Manager, the marketing doc.

**What they accomplish:** Generate copy → score → render visual → approve/reject → download. The entire loop should feel under their hand, never blocked.

**How it should feel:** A control room at night. Confident, instrumented, calm. The same brand world the ads themselves live in — so the operator never leaves the visual identity of the product they're shipping for. Ambient blue glow against deep navy. Glass over canvas. Quiet typography. No friction, no decoration.

## Direction

The Ops dashboard inhabits the **same visual world as the brand-identity ads** (Surface A in JOURNEYLINEMARKETING.md §3). This is deliberate: the operator is making *ads in this world*. The dashboard should not be a different aesthetic universe — that creates cognitive switch cost on every render. Brand world inside, brand world outside.

**Domain concepts:** night workspace, control room, signal/glow, journey line, calm pathway, craft station, instrumentation panel.

**Signature element:** the off-center radial blue glow on deep navy. Present once per page (top-right of the canvas). Subtle 50px grid noise behind everything. Glass surfaces over the canvas — never solid different-colored cards.

**Rejecting these dashboard defaults:**
- ✗ Sidebar with different background color than canvas → ✓ Same `--bg-canvas` everywhere, separated by 1px ghost border
- ✗ Solid white cards on a slate background → ✓ Glass surfaces (`rgba(255,255,255,0.05)` + `backdrop-blur` + `rgba(255,255,255,0.10)` border)
- ✗ Generic gray-scale (slate-700, gray-500, etc.) → ✓ Single navy hue, varying lightness only via white-alpha overlays
- ✗ Coral/red CTAs from creator-side product UI → ✓ Electric blue with glow shadow

## Tokens (CSS variables — emit in `apps/web/app/dashboard/ops/layout.tsx` or a global ops stylesheet)

```css
/* Surfaces */
--ops-bg-canvas: #0A0E1A;
--ops-surface-1: rgba(255, 255, 255, 0.04);   /* base panel */
--ops-surface-2: rgba(255, 255, 255, 0.06);   /* card */
--ops-surface-3: rgba(255, 255, 255, 0.09);   /* dropdown / popover (above card) */
--ops-surface-input: rgba(255, 255, 255, 0.03); /* inputs are slightly inset, darker */

/* Borders */
--ops-border: rgba(255, 255, 255, 0.10);
--ops-border-soft: rgba(255, 255, 255, 0.06);
--ops-border-emphasis: rgba(77, 159, 255, 0.40);
--ops-border-focus: rgba(77, 159, 255, 0.80);

/* Text */
--ops-text-primary: #FFFFFF;
--ops-text-secondary: rgba(255, 255, 255, 0.70);
--ops-text-tertiary: rgba(255, 255, 255, 0.50);
--ops-text-muted: rgba(255, 255, 255, 0.30);

/* Brand accent */
--ops-glow-primary: #4D9FFF;
--ops-glow-soft: #6EB3FF;
--ops-glow-shadow: 0 0 30px rgba(77, 159, 255, 0.4);
--ops-glow-shadow-hover: 0 0 40px rgba(77, 159, 255, 0.6);

/* Semantic */
--ops-success: #22C5B5;     /* re-used from product palette intentionally — only place teal appears */
--ops-warning: #F0B429;
--ops-destructive: #FF5A5A;
```

## Depth strategy

**Layered surfaces, no shadows.** Shadows on dark backgrounds disappear. Hierarchy comes from white-alpha overlay steps and ghost borders. The only shadow in the system is the **brand glow** on primary CTAs and the renderer "active" state — that's intentional, not decoration.

Elevation scale (whisper-quiet):
- L0: canvas (`--ops-bg-canvas`)
- L1: panel (`--ops-surface-1`)
- L2: card (`--ops-surface-2`)
- L3: dropdown / hover-revealed (`--ops-surface-3`)

Each step is a 2-percentage-point alpha jump. You should barely perceive them in isolation. Together they create structure.

## Spacing

Base unit **8px**. Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
Card padding: 24px. Section gap: 48px. Page gutter: 32px (desktop), 16px (mobile).

## Border radius

- Inputs/buttons/badges: 10px (radius-md)
- Cards: 16px (radius-lg)
- Hero panels and modals: 24px (radius-xl)
- The signature 32px radius reserved for ad templates (in renders), not dashboard chrome — this is the one place the dashboard intentionally uses a *softer* radius than the ads to feel like control vs. art

## Typography

Font: system geometric sans (matches Figma Make voice — "modern geometric sans, weight 500, confident but not loud"). Stack: `ui-sans-serif, -apple-system, "SF Pro Display", "Inter", sans-serif`. (Lock specific family later when `fonts.css` is reviewed.)

Scale (rem-anchored):
- Display: 32px / 600 / -0.02em — page heroes only
- H1: 24px / 500 / -0.01em
- H2: 18px / 500
- Body: 14px / 400 / 1.5
- Body small: 13px / 400
- Caption: 12px / 500 / 0.04em uppercase tracking — section eyebrows, labels
- Tabular: `font-variant-numeric: tabular-nums` for scores, counts, IDs

## Component patterns

### Page chrome
Every `/dashboard/ops/*` page:
- `bg: var(--ops-bg-canvas)` on `<body>` or root layout
- One off-center radial glow at top-right: `radial-gradient(circle at 80% 0%, rgba(77,159,255,0.20), transparent 60%)`, blurred via filter or huge blur-radius
- Subtle 50px grid: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)` background-size 50px
- Header with the page title (H1), breadcrumb caption, and primary action

### Card (the workhorse pattern)
```
bg: var(--ops-surface-2)
border: 1px solid var(--ops-border)
border-radius: 16px
padding: 24px
backdrop-filter: blur(12px)
```
Hover: border → `var(--ops-border-emphasis)`. No transform, no shadow, no scale.

### Input
```
bg: var(--ops-surface-input)        /* darker than surroundings — inset feel */
border: 1px solid var(--ops-border-soft)
border-radius: 10px
padding: 10px 14px
color: var(--ops-text-primary)
```
Focus: `border: var(--ops-border-focus); outline: none; box-shadow: 0 0 0 3px rgba(77,159,255,0.18)`.

### Primary CTA
```
bg: var(--ops-glow-primary)
color: white
border-radius: 10px
padding: 10px 16px
font-weight: 500
box-shadow: var(--ops-glow-shadow)
```
Hover: `bg: var(--ops-glow-soft); box-shadow: var(--ops-glow-shadow-hover)`. No translate.

### Secondary CTA
```
bg: transparent
border: 1px solid var(--ops-border)
color: var(--ops-text-primary)
```
Hover: `border: var(--ops-border-emphasis); bg: var(--ops-surface-1)`.

### Status badge
Pill, 12px text, uppercase 0.04em tracking, color-on-tint:
- Pending: `bg: rgba(255,255,255,0.06); color: var(--ops-text-secondary)`
- Rendered: `bg: rgba(77,159,255,0.12); color: var(--ops-glow-soft)`
- Approved: `bg: rgba(34,197,181,0.14); color: #22C5B5`
- Rejected: `bg: rgba(255,90,90,0.14); color: #FF7A7A`

### CreativeThumbnail card (the central new component)
- 1:1 aspect (matches v1 square templates)
- `bg: var(--ops-surface-2)` while loading; once rendered, the brand-image PNG fills it
- Border `var(--ops-border)`, radius 16px
- Footer strip below: caption with hook angle + lane tag, 4-button action row (Approve / Reject / Download / Open in Canva)
- Skeleton state: pulsing `var(--ops-surface-1)` → `var(--ops-surface-2)`, no spinner

## Accessibility

- All white-on-navy text passes 4.5:1 (primary white on `#0A0E1A` is ~17:1 — very strong)
- Focus rings always visible — never remove. Use `--ops-border-focus` + 3px alpha-18 halo
- Touch targets ≥ 40px height (dashboard is desktop-first; min height for buttons is 40px)
- `prefers-reduced-motion`: kill the glow pulse animations, keep the static glow

## What this is NOT

- Not the creator-side dashboard (that's indigo/coral/teal light theme — separate system)
- Not the learner experience (that's purple/pink dark gradient — separate system)
- Not the ad creative itself (ads are bolder, fuller-bleed; dashboard is calmer, more instrumented)

The Ops dashboard is the *quiet brother* of the ads — same world, lower volume.
