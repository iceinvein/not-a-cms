# not-a-cms Admin Design System

The visual system for the not-a-cms admin (the `@not-a-cms/admin` package). This
documents the shipped identity, not aspirations. See `PRODUCT.md` for the design
context and principles this serves.

## Identity at a glance

A dark editorial workshop tool. De-warmed cool-neutral surfaces carry the work; a
single electric-lime accent fires only on actions, the current selection, and
state. Type does the rest of the talking: Fraunces (an editorial serif) for
titles and prose, Inter for the UI, JetBrains Mono for labels and metadata.

The mood is a control room, held in deliberate contrast to the light, warm pages
the tool publishes. Quiet by default, loud only where it earns it.

## Two color layers (do not confuse them)

1. **Admin identity** — the `:root` tokens below. This is the chrome of the tool
   itself: shell, sidebar, panels, forms, dashboards. Dark, lime-accented.
2. **Site-brand canvas** — the `.cn-visual` scope in the Continuum editor mirrors
   the *edited site's* brand (its `--paper` / `--ink` / `--body` / `--accent`,
   set per-site by `scope-theme.ts`). It is intentionally light and is **not**
   the admin's identity. The terracotta `#c2613f` fallbacks there belong to the
   default site theme, not to this system.

Changing the admin brand means changing the `:root` tokens (and the Tailwind
arbitrary values that mirror them in components). It never touches `.cn-visual`.

## Color

Strategy: **Restrained + bold signal accent.** Neutrals dominate (~90% of every
surface). The accent is a signal, never decoration.

### Neutrals (cool-neutral, dark ramp)

| Token | Value | Role |
| --- | --- | --- |
| `--bg-app` | `#0a0a0c` | App background (deepest) |
| `--bg-sidebar` | `#111113` | Sidebar, toolbars, status bar |
| `--bg-surface` | `#18181b` | Panels, cards, raised surfaces |
| `--bg-surface-hover` | `#27272a` | Hover on raised surfaces |
| `--bg-active` | `rgba(255,255,255,0.08)` | Pressed / active fill |
| `--bg-subtle` | `rgba(255,255,255,0.05)` | Faint fills, count chips |
| `--bg-input` | `rgba(10,10,12,0.6)` | Inputs, selects, textareas |

### Borders

| Token | Value | Role |
| --- | --- | --- |
| `--border-default` | `rgba(255,255,255,0.06)` | Default hairline |
| `--border-hover` | `rgba(255,255,255,0.1)` | Hover / interactive edge |
| `--border-strong` | `rgba(255,255,255,0.15)` | Popovers, emphasis |

### Text

| Token | Value | Role |
| --- | --- | --- |
| `--text-primary` | `#fafafa` | Headings, primary content |
| `--text-secondary` | `#a1a1aa` | Body, descriptions |
| `--text-muted` | `#909099` | Labels, icons, metadata |
| `--text-subtle` | `#838389` | Placeholders, separators |

The four steps descend in contrast but every one clears WCAG AA (>= 4.5:1) on
the app, sidebar, and surface backgrounds, so even the dimmest label stays
legible: secondary ~6.9:1, muted ~5.3:1, subtle ~4.7:1 on `--bg-surface`. The
ramp is enforced by `contrast.test.ts`; darkening these values must keep AA.

### Accent (electric lime signal)

| Token | Value | Role |
| --- | --- | --- |
| `--accent` | `#c6ff3d` | Primary actions, active state, selection |
| `--accent-hover` | `#d4ff6e` | Hover on accent fills and accent text |
| `--accent-text` | `#0a0a0c` | Text/icons on an accent fill (near-black) |
| `--accent-subtle` | `rgba(198,255,61,0.1)` | Active-row wash, badge fills |
| `--accent-muted` | `rgba(198,255,61,0.2)` | Accent borders, focus rings |

**Where the accent is allowed:**
- Primary action buttons (lime fill + `--accent-text`).
- The current selection / active state (active nav item, active tab, selected
  card or row, checked control).
- State indicators (status/count badges, focus rings, `::selection`, the live
  block rail).
- Interactive feedback (hover-to-accent on links, native form-control accents).

**Where it is not:** section-header icons, category markers, decorative glows,
or any element that is not an action, a selection, or a state. Those use
`--text-muted`. Identity comes from type and the active states, not from
coloring every glyph. (Diff "after" values and descriptive run summaries are
text, not state, and stay neutral: primary white and secondary gray.)

Contrast: lime resolves to AAA on every dark surface (12.6–17.3:1 as text;
16.7:1 for near-black text on a lime fill). The accent must never be used as a
cursor or fill on the light `.cn-visual` canvas, where it falls to ~1.1:1.

### Status and presence

Semantic status colors: `--status-success #22c55e`, `--status-warning #f59e0b`,
`--status-error #ef4444`. These stay distinct from the lime accent and are used
only for their meaning.

Collaborator presence (`--presence-1..5`) is spread across the wheel at a mid
luminance so each cursor reads on both the dark shell and the light canvas, and
none collide with lime (a yellow-green is deliberately absent):
`#6ea8fe` (blue), `#f472b6` (pink), `#a78bfa` (violet), `#fb923c` (amber),
`#2dd4bf` (teal). The default collaborator color is `--presence-1`.

## Typography

Three families, each with a clear job. Fixed rem/px scale (no fluid clamps in the
UI).

| Token | Family | Used for |
| --- | --- | --- |
| `--font-ui` | Inter Variable | All UI: nav, buttons, labels, body, data |
| `--font-serif` | Fraunces Variable | Document titles, editor prose, page headings (`The Vault`, `.cn-title`, section headlines) |
| `--font-mono` | JetBrains Mono Variable | Kickers, micro-labels, metadata, keyboard hints, code |

Fraunces carries an optical-size axis. `font-optical-sizing: auto` is set on
`body`, so the same family renders with the display cut at the 58px document
title and the text cut in 22px editor prose. The document title (`.cn-title`)
runs at weight 480 / `-0.015em`; everything else uses Fraunces at its natural
weight.

Fonts are self-hosted via `@fontsource-variable/*`, imported once in
`src/styles/fonts.ts` and bundled by the admin's Vite/Astro pipeline. The
Tailwind `font-serif` utility is mapped to Fraunces in `tailwind.config.mjs`, so
both the CSS `var(--font-serif)` path and the Tailwind path resolve to the same
face.

## Motion

| Token | Value |
| --- | --- |
| `--motion-fast` | `120ms` |
| `--motion-ease` | `cubic-bezier(0.2, 0, 0, 1)` (ease-out) |

Motion conveys state only: hover, focus, selection, reveal. Transitions sit in
the 120–250ms range; no orchestrated page-load sequences. Every animation
respects `prefers-reduced-motion: reduce` via the global reset in `global.css`.

## Component conventions

- **Buttons.** Two tiers. Primary action: lime fill (`--accent`) with
  `--accent-text`, weight 600, `border-radius: 7px`, hover to `--accent-hover`.
  Secondary: transparent with `--border-hover`, `--text-secondary`, hover lifts
  to `--bg-surface-hover` and `--text-primary`.
- **Inputs / selects / textareas.** `--bg-input`, `--border-default`, radius 7px.
  Hover raises the border to `--border-hover`; focus uses `--accent-muted` border
  plus a 3px `--accent-subtle` ring.
- **Focus.** Global `:focus-visible` is a 1px `--accent` outline at 2px offset.
- **Selection.** `::selection` is `--accent` at 24% on `--text-primary`.
- **Cards.** Flat: `--bg-surface` + `--border-default`, radius 8–10px. No nested
  cards. No side-stripe accents (use full borders, fills, or leading icons).
- **Icons.** Default to `--text-muted`. Lime only when the icon is itself the
  active/selected state.

## Source of truth

- Tokens and global rules: `packages/admin/src/styles/global.css` (`:root`).
- Fonts: `packages/admin/src/styles/fonts.ts`, `packages/admin/tailwind.config.mjs`.
- Components mirror these tokens as Tailwind arbitrary values
  (`bg-[#c6ff3d]`, `text-[#fafafa]`, `rgba(198,255,61,…)`); a rebrand updates both
  the `:root` tokens and those literals together.
