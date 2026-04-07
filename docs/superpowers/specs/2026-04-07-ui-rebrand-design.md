# UI Rebrand — Design Spec

**Date:** 2026-04-07
**Status:** Approved

---

## Overview

Full visual rebrand of the not-a-cms admin UI. Dark monochrome palette, Inter font, Lucide icons, collapsible sidebar. Every admin page restyled to match.

---

## Color System

Dark monochrome with white accent. No color used for branding — color is reserved for semantic meaning (status, errors, success).

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `bg-app` | `#0a0a0c` | Main content area |
| `bg-sidebar` | `#111113` | Sidebar |
| `bg-surface` | `#18181b` | Cards, panels, elevated surfaces |
| `bg-surface-hover` | `#27272a` | Hover state on surfaces |
| `bg-active` | `rgba(255,255,255,0.08)` | Active nav item, selected state |
| `bg-subtle` | `rgba(255,255,255,0.05)` | Subtle backgrounds (search bar, badges) |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `border-default` | `rgba(255,255,255,0.06)` | Standard borders (cards, dividers, sidebar) |
| `border-hover` | `rgba(255,255,255,0.1)` | Hover state borders |
| `border-strong` | `rgba(255,255,255,0.15)` | Emphasized borders (focused inputs) |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `text-primary` | `#fafafa` | Headings, primary content, active nav |
| `text-secondary` | `#a1a1aa` | Body text, descriptions |
| `text-muted` | `#71717a` | Inactive nav, placeholders, metadata |
| `text-subtle` | `#52525b` | Disabled, timestamps, tertiary info |

### Accent

| Token | Value | Usage |
|-------|-------|-------|
| `accent` | `#fafafa` | Primary buttons (white bg, dark text) |
| `accent-text` | `#0a0a0c` | Text on accent buttons |

### Semantic Colors (used sparingly, only for status)

| Token | Value | Usage |
|-------|-------|-------|
| `status-success` | `#22c55e` | Published, completed, active |
| `status-warning` | `#f59e0b` | Scheduled, pending, draft |
| `status-error` | `#ef4444` | Failed, error, destructive |

---

## Typography

**Font:** Inter, loaded via Google Fonts CDN in AdminLayout `<head>`.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Tailwind config:** Extend `fontFamily.sans` to `['Inter', ...defaultTheme.fontFamily.sans]`.

**Scale:**

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Page title | 16px (`text-base`) | 600 | Page headings like "Blog Posts" |
| Section heading | 14px (`text-sm`) | 600 | Card headers, panel titles |
| Body | 13px (`text-[13px]`) | 400 | List items, nav items, form labels |
| Small | 12px (`text-xs`) | 400/500 | Badges, metadata, timestamps |
| Tiny | 11px (`text-[11px]`) | 400 | Keyboard shortcuts, hints |

Note: The entire admin uses a tighter type scale than Tailwind defaults. 13px is the base reading size, not 14px or 16px. This matches Linear's density.

---

## Icons

**Package:** `lucide-react` (install via `bun add lucide-react` in `packages/admin`)

**Size:** 14-16px for nav icons, 12-14px for inline icons.

**Color:** Inherits from parent text color (use `currentColor` / Tailwind text classes).

**Icon mapping (replacing emoji):**

| Current | Lucide icon | Import name |
|---------|-------------|-------------|
| 📊 Dashboard | `LayoutGrid` | `LayoutGrid` |
| 📄 Blog Posts / Pages | `FileText` | `FileText` |
| 🖼️ Media | `Image` | `Image` |
| ⚡ Automations | `Workflow` | `Workflow` |
| 🔗 Webhooks | `Webhook` | `Webhook` |
| ⚙️ Settings | `Settings` | `Settings` |
| 👤 User avatar | `User` | `User` |

---

## Layout: Collapsible Sidebar

### Expanded (190px)

- Dark background (`#111113`)
- Top: logo (white "N" badge) + "not-a-cms" label + collapse chevron
- Search bar: `rgba(255,255,255,0.05)` bg, "Search" placeholder, "Cmd+K" hint right-aligned
- Nav items: Lucide icon + label, 13px, `#71717a` default, `#fafafa` + `rgba(255,255,255,0.08)` bg when active
- Bottom section (separator line): Automations, Webhooks, Settings
- Collapse toggle: left-pointing chevron in the header, toggles sidebar width

### Collapsed (48px icon rail)

- Same dark background
- Logo badge only (no text)
- Icons only (no labels), centered, 32x32 hit area
- Active icon: same `rgba(255,255,255,0.08)` bg
- Tooltip on hover showing the label

### State persistence

Collapsed/expanded state stored in `localStorage` key `nacms-sidebar-collapsed`. Persists across page loads.

### Implementation

The sidebar is an Astro component. Since Astro pages are server-rendered and the sidebar needs client-side interactivity (collapse toggle, localStorage), the collapse behavior uses a `<script>` tag in the Astro component (not a React island — too heavy for a toggle).

---

## Page Structure

### AdminLayout.astro

```
<html> (dark bg)
  <head> Inter font, global styles </head>
  <body class="bg-[#0a0a0c] text-[#a1a1aa] font-sans">
    <div class="flex min-h-screen">
      <Sidebar />
      <main class="flex-1 min-h-screen">
        <header> (page title, optional actions slot) </header>
        <div class="p-6"> <slot /> </div>
      </main>
    </div>
  </body>
</html>
```

The header bar from the current layout is simplified — just the page title left-aligned, no background color, no border. The dark bg of the content area provides the visual frame.

### Global CSS

Extend `global.css` with:
- CSS custom properties for all color tokens (enables future theming)
- Default body/text styling
- Scrollbar styling (thin, dark)
- Focus ring styling (white, subtle)

---

## Component Patterns

### Cards/Panels

```
bg-[#18181b] border border-[rgba(255,255,255,0.06)] rounded-lg
```

### Buttons

**Primary:** `bg-[#fafafa] text-[#0a0a0c] font-medium text-sm rounded-md px-3 py-1.5`
**Secondary:** `border border-[rgba(255,255,255,0.08)] text-[#a1a1aa] rounded-md px-3 py-1.5`
**Ghost:** `text-[#71717a] hover:text-[#a1a1aa]`
**Destructive:** `text-[#71717a] hover:text-[#ef4444]`

### Inputs

```
bg-transparent border border-[rgba(255,255,255,0.1)] rounded-md px-3 py-1.5 text-sm text-[#fafafa]
placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none
```

### Badges

```
text-xs px-2 py-0.5 rounded-full font-medium
```
- Published/Active: `bg-[rgba(34,197,94,0.1)] text-[#22c55e]`
- Draft: `bg-[rgba(255,255,255,0.05)] text-[#71717a]`
- Scheduled: `bg-[rgba(245,158,11,0.1)] text-[#f59e0b]`
- Failed: `bg-[rgba(239,68,68,0.1)] text-[#ef4444]`

### Tables/Lists

Rows separated by `border-b border-[rgba(255,255,255,0.06)]`. Hover: `bg-[rgba(255,255,255,0.02)]`. No alternating row colors.

---

## Pages to Restyle

All pages follow the same pattern: dark background, Inter font, Lucide icons, monochrome palette.

### 1. Login page
Simple centered card on dark bg. White "N" logo. Email input + magic link button.

### 2. Dashboard (index.astro)
Collection list with document counts. Links to each collection.

### 3. Content list ([collection].astro)
Table of documents. Search bar. "+ New" primary button. Status badges. Click row to edit.

### 4. Content editor ([id].astro, new.astro)
Two-column: main content area (editor) + sidebar (metadata, publish controls). The Tiptap editor needs a dark theme — white text on dark bg, toolbar with monochrome icons.

### 5. Media page
Grid of uploaded images. Upload button. Dark card backgrounds.

### 6. Webhooks page
Same pattern as current but restyled with dark palette.

### 7. Settings page
Theme customizer restyled with dark palette.

### 8. Automations pages
All automation components (FlowList, FlowEditor, FlowCanvas, StepConfigurator, StepPicker, RunList, RunDetail) restyled with dark palette. The flow canvas uses a dark dot grid. Step blocks use surface color (`#18181b`). Trigger block uses accent (white border or bg).

---

## New Dependency

```bash
cd packages/admin && bun add lucide-react
```

---

## Tailwind Config Changes

Extend `packages/admin/tailwind.config.mjs`:

```js
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}
```

Color tokens are applied via CSS custom properties in `global.css` and used inline in components (not as Tailwind config extensions — keeps the config minimal and the tokens visible where they're used).

---

## What's Out of Scope

- Dark/light mode toggle (dark only for now)
- Command palette (Cmd+K) implementation (UI hint shown, functionality is a future feature)
- Custom favicon redesign
- Responsive/mobile layout
- Tiptap editor theme (will use a simple CSS override for dark bg + light text, not a full editor retheme)
