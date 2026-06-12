# solostereo design system

Decided in task 0.2; binding for every page (see plan.md §2). The app should
read like beautifully typeset liner notes or an editorial music magazine —
never like a BI dashboard.

## Palette — dark only

The app has one permanent dark theme; tokens live in `:root` in
`app/globals.css` as oklch values with a warm hue (~80°) so the near-black
never reads as cold blue-gray.

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.16 0.008 80)` | near-black warm canvas |
| `--foreground` | `oklch(0.93 0.014 85)` | warm off-white text |
| `--primary` | `oklch(0.78 0.145 70)` | **the one accent — amber** ("amp glow"). Active nav, key data, the wordmark dot |
| `--muted-foreground` | `oklch(0.66 0.018 80)` | secondary text, axis labels |
| `--card` | `oklch(0.20 0.009 80)` | elevated surfaces |
| `--border` | foreground at 10% | hairlines |
| `--chart-1…5` | amber, pale gold, rust, warm gray, deep warm gray | chart series, in that priority order |

Rules:

- Amber is the only saturated color. The data is the color; the chrome stays
  quiet. Never introduce a second accent for emphasis — use weight, size, or
  the pale-gold/rust chart shades.
- Use `--chart-*` for chart series; never library default palettes.

## Typography

Loaded via `next/font/google` in `app/layout.tsx`:

| Face | CSS var / utility | Role |
|---|---|---|
| **Fraunces** (variable, opsz axis) | `--font-fraunces`, `font-display` | display: big numerals, rankings, year headlines, the wordmark. Always lowercase for headings |
| **Inter** | `--font-inter`, `font-sans` (default) | body, tables, UI |
| **Geist Mono** | `--font-geist-mono`, `font-mono` | small data labels, code-ish chips |

Helpers in `globals.css`:

- `.stat-numeral` — Fraunces at display optical size (opsz 144), tabular
  figures, tight leading. Use for every big editorial number.
- `.tabular` — tabular figures for dense data tables.

Hierarchy: page titles `font-display text-5xl lowercase tracking-tight`;
section headings `font-display text-2xl lowercase`; body and tables Inter at
`text-sm`/`text-base`. Headings and nav labels are lowercase — it is part of
the wordmark language.

## Wordmark

`components/wordmark.tsx` — `solostereo` in Fraunces lowercase with an amber
terminal dot (`solostereo.`). Small in the nav, large as a hero mark on empty
states. No icon/logo besides this.

## Layout

- Top nav (`components/site-nav.tsx`): wordmark + the four pages, baseline
  aligned, hairline bottom border. Active page is amber; inactive is muted.
- Content column: `max-w-6xl` centered, `px-6`, generous vertical rhythm
  (`py-10`+). Whitespace is generous by default; density is reserved for data
  tables where density serves the data.
- Radius is restrained (`--radius: 0.5rem`); surfaces are flat with hairline
  borders, no shadows-as-decoration.

## Charts

Charts are designed objects, not library defaults:

- Recharts output must be restyled: no default grid gray, no default tooltips,
  no default font. Axis text is `--muted-foreground` at 11–12px Inter; grid
  lines are `--border`.
- Area/line fills use amber with low-opacity gradients into transparent.
- Every chart ships with deliberate hover states, an empty state, and a
  loading state.
- Each page has one signature visualization treated as an editorial graphic
  (see plan.md §6).

## Components

shadcn/ui (radix base, nova preset) is the component base; everything is
restyled by the tokens above. Components live in `components/ui/` (generated)
and `components/` (bespoke). No page ships in default-library styling.
