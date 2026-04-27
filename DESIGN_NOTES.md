# Aeolus — Design Notes

Extracted from existing portfolio projects (Lumina, Nexus) to ensure aesthetic consistency.

---

## Color Palette

All colors expressed as CSS HSL variables on `:root`. Default is dark mode only (no toggle).

```css
/* Core */
--background: 240 10% 4%;          /* #0A0A1F — near black with blue tint */
--foreground: 0 0% 95%;            /* #F2F2F2 — off-white text */
--card: 240 8% 8%;                 /* #141420 — dark card surface */
--card-foreground: 0 0% 95%;

/* Primary brand — vibrant purple */
--primary: 262 83% 58%;            /* #7B5CFF */
--primary-foreground: 0 0% 100%;

/* Secondary / muted surfaces */
--secondary: 240 6% 14%;           /* #242430 */
--secondary-foreground: 0 0% 85%;
--muted: 240 5% 18%;               /* #2D2D38 */
--muted-foreground: 240 5% 55%;

/* Accent (same as primary) */
--accent: 262 83% 58%;
--accent-foreground: 0 0% 100%;

/* Semantic */
--destructive: 0 84% 60%;          /* #FF5C6D — error/cancel red */
--destructive-foreground: 0 0% 100%;

/* Borders / inputs */
--border: 240 6% 18%;              /* subtle dark border */
--input: 240 6% 18%;
--ring: 262 83% 58%;               /* focus ring = primary */

/* Radius */
--radius: 0.75rem;                 /* 12px */
```

### Extended tokens for Aeolus
```css
/* Status colors for flight states */
--status-on-time: 142 76% 45%;     /* emerald green */
--status-delayed: 38 92% 55%;      /* amber */
--status-cancelled: 0 84% 60%;     /* red */
--status-swapped: 262 83% 58%;     /* primary purple */

/* Aviation accent — cyan for live data indicators */
--accent-cyan: 197 100% 60%;       /* #38D9FF */

/* Glow helpers */
--glow-primary: 0 0 30px hsl(262 83% 58% / 0.2);
--gradient-purple: linear-gradient(135deg, hsl(262 83% 58%), hsl(280 80% 45%));
```

---

## Typography

**Display / heading font**: Space Grotesk (weights 400, 500, 600, 700)
**Body font**: Inter (weights 300, 400, 500, 600, 700)

Usage:
- All headings → `font-display` class (Space Grotesk)
- Body, UI labels → Inter (default)

Scale: Tailwind defaults (`text-sm` → `text-8xl`) with responsive clamp on large headings.

---

## Component Primitives

### Button variants
```
default     — bg-primary text-white hover:bg-primary/90
hero        — bg-gradient-purple glow-purple hover:opacity-90
heroOutline — border border-border bg-secondary hover:bg-muted
outline     — border border-input bg-background hover:bg-accent
ghost       — hover:bg-accent hover:text-accent-foreground
destructive — bg-destructive hover:bg-destructive/90
```

Sizes: `sm` (h-9), `default` (h-10), `lg` (h-11 px-8)

### Card
```
border: border-border
background: bg-card
padding: p-6 (default), p-8 (hero cards)
radius: rounded-2xl
hover: border-primary/30 transition-colors
```

### Badge / status pill
```
Inline flex, rounded-full, px-2 py-0.5, text-xs font-medium
Colors tied to --status-* tokens above
```

### Input
```
bg-secondary border-border focus:ring-1 focus:ring-primary
rounded-lg h-10 px-3
```

---

## Motion Patterns

**Library**: Framer Motion
**Principle**: Subtle, purposeful — never decorative for its own sake.

Standard entrance:
```js
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4, ease: "easeOut" }}
```

Staggered list items: `delay: index * 0.08`

Hover: `whileHover={{ scale: 1.02 }}` on cards only.

Pulse / glow keyframe (for active events):
```css
@keyframes pulse-glow {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px hsl(262 83% 58% / 0.4); }
  50%       { opacity: 0.8; box-shadow: 0 0 24px hsl(262 83% 58% / 0.7); }
}
```

Flight disruption pulse (amber → red cascade):
```css
@keyframes flight-pulse {
  0%   { fill: hsl(38 92% 55%); opacity: 1; }
  100% { fill: hsl(0 84% 60%);  opacity: 0.6; }
}
```

---

## Spacing & Layout

- Base unit: 4px (Tailwind `space-1`)
- Section padding: `py-24 px-6` on large screens, `py-12 px-4` on mobile
- Card grid gaps: `gap-6` (default), `gap-8` (hero grids)
- Max content width: `max-w-7xl mx-auto`

---

## Dark Mode

**Default dark** — no toggle. Same pattern as Lumina and Nexus. Single set of CSS variables on `:root`.

---

## shadcn/ui

Use shadcn/ui for: Button, Card, Input, Select, Tabs, Badge, Dialog, Tooltip, Separator, Skeleton.
Do NOT use for: Map container, Gantt timeline (custom), recovery plan comparison (custom).

---

## Icons

`lucide-react` throughout. Match Lumina pattern.

---

## Custom Cursor

Not used in Aeolus (it's a data-dense tool; custom cursors hurt usability on dashboards).

---

## Skeleton Loaders

Use `<Skeleton />` from shadcn/ui during all data fetches. Never raw spinners in main content areas.
Skeleton delay: appear after 300ms to avoid flicker on fast connections.
