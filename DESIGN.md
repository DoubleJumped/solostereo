# solostereo design system

Binding for every page (see plan.md §2). The cover — the spray-painted
cassette-deck mural with its live LCD — is the design system. Every page
should read like the app projected onto that deck's screen: phosphor type on
a green-cast wall, hardware-square controls, scanlines. Never like a BI
dashboard, and never like a generic dark theme.

## Palette — dark only

The app has one permanent dark theme; tokens live in `:root` in
`app/globals.css` as oklch values. The canvas is the mural's green-cast
near-black and the one accent is the LCD's phosphor green (`#4be387` on the
painted screen).

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.15 0.012 152)` | near-black, green-cast wall |
| `--foreground` | `oklch(0.95 0.02 152)` | pale-mint text |
| `--primary` | `oklch(0.82 0.17 152)` | **the one accent — phosphor green**. Active nav, key data, readouts, lit buttons |
| `--muted-foreground` | `oklch(0.66 0.04 152)` | secondary text, axis labels |
| `--card` | `oklch(0.18 0.016 152)` | surfaces — kept *just* above the canvas so panels feel light, not boxed |
| `--border` | green-white at 12% | faint green hairlines |
| `--chart-1…5` | phosphor green, pale mint, deep green, dim phosphor, embers | chart series, in that priority order |
| `--lcd-glow` | primary at 45% | shared halo color for glow effects |

Rules:

- Phosphor green is the only saturated color. The data is the color; the
  chrome stays quiet. Never introduce a second accent for emphasis — use
  weight, size, or the dimmer green chart shades. In two-series views
  (compare), the secondary series uses pale mint (chart-2) so full phosphor
  reads as "the subject."
- Use `--chart-*` for chart series; never library default palettes.
- Keep surfaces light: cards sit barely above the canvas with faint hairlines.
  Prefer open, hairline-separated layouts over heavily bordered boxes.

## Texture & glow

The CRT is texture, not decoration — all of it is pure CSS (no images, no
filters, no extra client JS):

- `body::after` lays faint scanlines over the whole viewport (one fixed,
  pointer-transparent layer — composited once, free to scroll).
- `.crt` — stronger scanlines for panels that should read as screens (the
  stat banks, the hero chart). Pseudo-element only.
- `.lcd-glow` — phosphor text halo. For green text only: big readout values,
  the wordmark cursor, active nav, lit buttons.
- `h1–h3` get a subtle glow globally; don't add more.
- Glow is `text-shadow` and scanlines are repeating gradients; never reach for
  `filter`/`backdrop-filter` — they cost real paint time.

## Typography

Loaded via `next/font/google` in `app/layout.tsx`:

| Face | CSS var / utility | Role |
|---|---|---|
| **VT323** (single 400 weight — one small file) | `--font-lcd`, `font-display` | display: the deck's dot-matrix face. Headings, big numerals, rankings, nav, buttons, the wordmark. Always lowercase |
| **Inter** | `--font-inter`, `font-sans` (default) | body, tables, UI — legibility where density matters |
| **Geist Mono** | `--font-geist-mono`, `font-mono` | small data labels, code-ish chips |

Helpers in `globals.css`:

- `.stat-numeral` — dot-matrix numerals (VT323 is monospaced, digits
  self-align), tight leading. Use for every big readout number, paired with
  `text-primary lcd-glow`.
- `.tabular` — tabular figures for dense Inter data tables.

Hierarchy: page titles `font-display text-5xl lowercase tracking-tight`;
section headings `font-display text-2xl lowercase`; body and tables Inter at
`text-sm`/`text-base`. VT323 renders small for its em size — display text is
one step larger than the Inter equivalent (e.g. chips at `text-base`, not
`text-xs`). Headings and nav labels are lowercase — it is part of the
wordmark language.

## Wordmark

`components/wordmark.tsx` — `solostereo` in VT323 lowercase with a blinking
phosphor cursor (`solostereo_`), like a deck waiting for input. Small in the
nav, large as a hero mark on empty states. No icon/logo besides this.
The blink respects `prefers-reduced-motion`.

## Controls

Buttons and chips are deck hardware, not web pills:

- Square-ish (`rounded-sm`), bordered, `font-display` labels.
- Active/primary: `border-primary/60 bg-primary/15 text-primary` (+
  `lcd-glow` on real actions) — a lit button, never a solid green fill.
- Inactive chips: transparent border, muted text; hover raises the border.
- Destructive keeps the red border treatment; red is a state, not an accent.

## Layout

- Top nav (`components/site-nav.tsx`): the deck's faceplate — wordmark +
  pages on a lifted panel (`bg-card/60`), baseline aligned, hairline bottom
  border. Active page is lit phosphor with glow; inactive is muted.
- Content column: `max-w-6xl` centered, `px-6`, generous vertical rhythm
  (`py-10`+). Whitespace is generous by default; density is reserved for data
  tables where density serves the data.
- Radius is tight (`--radius: 0.375rem`) — bezels, not bubbles; surfaces are
  flat with hairline borders, no shadows-as-decoration.
- The cover (`/`) is the mural itself and owns the whole viewport; the nav
  hides there. Its hardcoded colors in `components/cover/deck.tsx` are the
  source the tokens were derived from.

## Charts

Charts are readouts on the deck's screen, not library defaults:

- Recharts output must be restyled: no default grid gray, no default
  tooltips, no default font. Axis text is `--muted-foreground` at 11–12px
  Inter; grid lines are `--border`.
- Area/line fills use phosphor green with low-opacity gradients into
  transparent.
- Every chart ships with deliberate hover states, an empty state, and a
  loading state.
- Each page has one signature visualization treated as a hero readout
  (see plan.md §6).

## Components

shadcn/ui (radix base, nova preset) is the component base; everything is
restyled by the tokens above. Components live in `components/ui/` (generated)
and `components/` (bespoke). No page ships in default-library styling.
