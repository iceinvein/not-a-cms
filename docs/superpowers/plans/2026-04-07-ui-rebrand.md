# UI Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire not-a-cms admin from light Tailwind defaults to a dark monochrome palette with Inter font, Lucide icons, and a collapsible sidebar.

**Architecture:** This is a pure visual refactor — no logic changes. Task R1 establishes the design foundation (font, CSS tokens, Tailwind config, dependency). Task R2 rebuilds the two layout shells (AdminLayout + Sidebar). Tasks R3-R7 restyle individual pages/components. Each task produces a commit and a visually coherent admin at that point — earlier tasks restyle the shell, later tasks restyle page content.

**Tech Stack:** Tailwind CSS, Inter (Google Fonts), lucide-react, Astro, React

---

## Execution Waves

```
Wave 1:  R1 Foundation (dependency, font, config, global CSS)
Wave 2:  R2 Layout Shell (AdminLayout, Sidebar, AuthLayout)
Wave 3 (parallel):  R3 Core Pages (Dashboard, Content List, Login)
Wave 4 (parallel):  R4 Secondary Pages (Media, Webhooks, Settings, Content Editor)
Wave 5:  R5 Automations Pages (all 7 automation components)
```

---

## File Structure (all changes)

```
packages/admin/
  package.json                          MODIFY - add lucide-react dependency
  tailwind.config.mjs                   MODIFY - add Inter font family
  src/
    styles/global.css                   MODIFY - add CSS custom properties, scrollbar, focus styles
    layouts/
      AdminLayout.astro                 MODIFY - dark bg, Inter font CDN, simplified header
      AuthLayout.astro                  MODIFY - dark bg, Inter font CDN
    components/
      Sidebar.astro                     MODIFY - full rewrite: dark, collapsible, Lucide icons, localStorage
      DashboardStats.tsx                MODIFY - dark card styling
      ContentList.tsx                   MODIFY - dark table, badges, empty states
      SearchBar.tsx                     MODIFY - dark input styling
      LoginForm.tsx                     MODIFY - dark input/button styling
      MediaLibrary.tsx                  MODIFY - dark grid cards
      WebhookManager.tsx                MODIFY - dark cards, inputs, badges
      ThemeCustomizer.tsx               MODIFY - dark panels, inputs
      ContentEditor.tsx                 MODIFY - dark panels, inputs, editor bg
      LoadingSkeleton.tsx               MODIFY - dark skeleton colors
      ErrorBoundary.tsx                 MODIFY - dark error styling
      Toast.tsx                         MODIFY - dark toast styling
      VersionHistory.tsx                MODIFY - dark list styling
      PreviewLink.tsx                   MODIFY - dark styling
      automations/
        FlowList.tsx                    MODIFY - dark cards, badges
        FlowEditor.tsx                  MODIFY - dark panels, canvas bg
        FlowCanvas.tsx                  MODIFY - dark step blocks, connectors
        StepConfigurator.tsx            MODIFY - dark panels, inputs
        StepPicker.tsx                  MODIFY - dark dropdown
        RunList.tsx                     MODIFY - dark table
        RunDetail.tsx                   MODIFY - dark panels, JSON viewer
    pages/
      index.astro                       MODIFY - dark text classes
      login.astro                       MODIFY - dark text classes
      media.astro                       NO CHANGE (just passes to component)
      settings.astro                    NO CHANGE
      webhooks.astro                    NO CHANGE
      content/[collection].astro        MODIFY - dark text/button classes
      content/[collection]/[id].astro   MODIFY - dark text classes (if any inline)
      content/[collection]/new.astro    MODIFY - dark text classes (if any inline)
      automations/index.astro           MODIFY - dark text
      automations/[id].astro            MODIFY - dark text
```

---

## Task R1: Foundation (Dependency + Font + Config + Global CSS)

**Files:**
- Modify: `packages/admin/package.json`
- Modify: `packages/admin/tailwind.config.mjs`
- Modify: `packages/admin/src/styles/global.css`

- [ ] **Step 1: Install lucide-react**

Run: `cd packages/admin && bun add lucide-react`

- [ ] **Step 2: Update Tailwind config**

Replace `packages/admin/tailwind.config.mjs` with:

```js
import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
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

- [ ] **Step 3: Replace global.css**

Replace `packages/admin/src/styles/global.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-app: #0a0a0c;
  --bg-sidebar: #111113;
  --bg-surface: #18181b;
  --bg-surface-hover: #27272a;
  --bg-active: rgba(255, 255, 255, 0.08);
  --bg-subtle: rgba(255, 255, 255, 0.05);

  --border-default: rgba(255, 255, 255, 0.06);
  --border-hover: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.15);

  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --text-subtle: #52525b;

  --accent: #fafafa;
  --accent-text: #0a0a0c;

  --status-success: #22c55e;
  --status-warning: #f59e0b;
  --status-error: #ef4444;
}

body {
  background: var(--bg-app);
  color: var(--text-secondary);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Focus rings */
*:focus-visible {
  outline: 1px solid rgba(255, 255, 255, 0.3);
  outline-offset: 2px;
}

/* Selection */
::selection {
  background: rgba(255, 255, 255, 0.15);
  color: #fafafa;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/admin/package.json packages/admin/bun.lock packages/admin/tailwind.config.mjs packages/admin/src/styles/global.css
git commit -m "feat(R1): design foundation — lucide-react, Inter font, dark CSS tokens"
```

---

## Task R2: Layout Shell (AdminLayout + Sidebar + AuthLayout)

**Files:**
- Modify: `packages/admin/src/layouts/AdminLayout.astro`
- Modify: `packages/admin/src/layouts/AuthLayout.astro`
- Modify: `packages/admin/src/components/Sidebar.astro`

- [ ] **Step 1: Rewrite AdminLayout.astro**

Read the current file first. Replace the entire file with:

```astro
---
import Sidebar from "../components/Sidebar.astro"
import { fetchCollections } from "../lib/schema"

interface Props {
  title: string
}

const { title } = Astro.props
const currentPath = Astro.url.pathname
const collections = await fetchCollections()

// Auth check — skip for login and auth callback pages
const isAuthPage = currentPath === "/login" || currentPath.startsWith("/auth/")
if (!isAuthPage) {
  try {
    const sessionRes = await fetch("http://localhost:4321/api/auth/get-session", {
      headers: { cookie: Astro.request.headers.get("cookie") || "" },
    })
    if (sessionRes.ok) {
      const session = await sessionRes.json()
      if (!session?.user) {
        return Astro.redirect("/login")
      }
    } else {
      return Astro.redirect("/login")
    }
  } catch {
    if (import.meta.env.PROD) {
      return Astro.redirect("/login")
    }
  }
}
---
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — not-a-cms</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body class="bg-[#0a0a0c] text-[#a1a1aa] font-sans min-h-screen">
  <div class="flex min-h-screen">
    <Sidebar collections={collections} currentPath={currentPath} />

    <main class="flex-1 min-h-screen">
      <header class="px-6 py-5">
        <h1 class="text-base font-semibold text-[#fafafa]">{title}</h1>
      </header>

      <div class="px-6 pb-6">
        <slot />
      </div>
    </main>
  </div>
</body>
</html>
```

Key changes: dark body bg, Inter font links, simplified header (no white bg/border, just left-aligned title), `text-base` heading.

- [ ] **Step 2: Rewrite Sidebar.astro**

Read the current file first. Replace the entire file with the dark collapsible sidebar. This is the most complex component — it uses a `<script>` tag for collapse toggle and localStorage persistence.

```astro
---
interface Props {
  collections?: Array<{ name: string; label?: string; labels?: { singular: string; plural: string } }>
  currentPath: string
}

const { collections = [], currentPath } = Astro.props
---

<aside id="sidebar" class="w-[190px] bg-[#111113] border-r border-[rgba(255,255,255,0.06)] min-h-screen flex flex-col transition-all duration-200 flex-shrink-0" data-expanded="true">
  <!-- Header -->
  <div class="flex items-center gap-2 px-3 py-3 border-b border-[rgba(255,255,255,0.06)]">
    <div class="w-6 h-6 bg-[#fafafa] rounded flex items-center justify-center text-[#0a0a0c] font-bold text-[10px] flex-shrink-0">N</div>
    <span id="sidebar-label" class="text-[13px] font-semibold text-[#e4e4e7] flex-1 truncate">not-a-cms</span>
    <button id="sidebar-toggle" class="text-[#52525b] hover:text-[#a1a1aa] transition-colors flex-shrink-0" title="Toggle sidebar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
    </button>
  </div>

  <!-- Search hint -->
  <div id="sidebar-search" class="mx-3 mt-3 mb-2 px-2 py-1.5 rounded-md bg-[rgba(255,255,255,0.05)] text-[#52525b] text-[11px] flex items-center gap-2">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <span class="flex-1">Search</span>
    <span class="text-[9px] opacity-50">Cmd+K</span>
  </div>

  <!-- Main nav -->
  <nav class="flex-1 px-2 py-1">
    <ul class="space-y-0.5">
      <li>
        <a href="/" class:list={["sidebar-link flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors", currentPath === "/" ? "bg-[rgba(255,255,255,0.08)] text-[#fafafa] font-medium" : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)]"]} title="Dashboard">
          <svg class="sidebar-icon flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span class="sidebar-text truncate">Dashboard</span>
        </a>
      </li>
      {collections.map(c => {
        const href = `/content/${c.name}`
        const isActive = currentPath === href || currentPath.startsWith(href + "/")
        const label = c.labels?.plural ?? c.label ?? c.name
        return (
          <li>
            <a href={href} class:list={["sidebar-link flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors", isActive ? "bg-[rgba(255,255,255,0.08)] text-[#fafafa] font-medium" : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)]"]} title={label}>
              <svg class="sidebar-icon flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
              <span class="sidebar-text truncate">{label}</span>
            </a>
          </li>
        )
      })}
      <li>
        <a href="/media" class:list={["sidebar-link flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors", currentPath === "/media" ? "bg-[rgba(255,255,255,0.08)] text-[#fafafa] font-medium" : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)]"]} title="Media">
          <svg class="sidebar-icon flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          <span class="sidebar-text truncate">Media</span>
        </a>
      </li>
    </ul>
  </nav>

  <!-- Bottom nav -->
  <div class="px-2 py-2 border-t border-[rgba(255,255,255,0.06)]">
    <ul class="space-y-0.5">
      <li>
        <a href="/automations" class:list={["sidebar-link flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors", currentPath.startsWith("/automations") ? "bg-[rgba(255,255,255,0.08)] text-[#fafafa] font-medium" : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)]"]} title="Automations">
          <svg class="sidebar-icon flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/></svg>
          <span class="sidebar-text truncate">Automations</span>
        </a>
      </li>
      <li>
        <a href="/webhooks" class:list={["sidebar-link flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors", currentPath === "/webhooks" ? "bg-[rgba(255,255,255,0.08)] text-[#fafafa] font-medium" : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)]"]} title="Webhooks">
          <svg class="sidebar-icon flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 .8 7.93"/></svg>
          <span class="sidebar-text truncate">Webhooks</span>
        </a>
      </li>
      <li>
        <a href="/settings" class:list={["sidebar-link flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors", currentPath === "/settings" ? "bg-[rgba(255,255,255,0.08)] text-[#fafafa] font-medium" : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)]"]} title="Settings">
          <svg class="sidebar-icon flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          <span class="sidebar-text truncate">Settings</span>
        </a>
      </li>
    </ul>
  </div>
</aside>

<script>
  const sidebar = document.getElementById('sidebar')!
  const toggle = document.getElementById('sidebar-toggle')!
  const isCollapsed = localStorage.getItem('nacms-sidebar-collapsed') === 'true'

  function collapse() {
    sidebar.style.width = '48px'
    sidebar.dataset.expanded = 'false'
    sidebar.querySelectorAll('.sidebar-text').forEach(el => (el as HTMLElement).style.display = 'none')
    document.getElementById('sidebar-label')!.style.display = 'none'
    document.getElementById('sidebar-search')!.style.display = 'none'
    toggle.querySelector('svg')!.style.transform = 'rotate(180deg)'
    localStorage.setItem('nacms-sidebar-collapsed', 'true')
  }

  function expand() {
    sidebar.style.width = '190px'
    sidebar.dataset.expanded = 'true'
    sidebar.querySelectorAll('.sidebar-text').forEach(el => (el as HTMLElement).style.display = '')
    document.getElementById('sidebar-label')!.style.display = ''
    document.getElementById('sidebar-search')!.style.display = ''
    toggle.querySelector('svg')!.style.transform = ''
    localStorage.setItem('nacms-sidebar-collapsed', 'false')
  }

  if (isCollapsed) collapse()

  toggle.addEventListener('click', () => {
    if (sidebar.dataset.expanded === 'true') collapse()
    else expand()
  })
</script>
```

- [ ] **Step 3: Rewrite AuthLayout.astro**

Replace the entire file with:

```astro
---
interface Props {
  title: string
}
const { title } = Astro.props
---
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — not-a-cms</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body class="bg-[#0a0a0c] text-[#a1a1aa] font-sans min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="inline-flex w-10 h-10 bg-[#fafafa] rounded-lg items-center justify-center text-[#0a0a0c] font-bold text-sm mb-3">N</div>
      <h1 class="text-base font-semibold text-[#fafafa]">not-a-cms</h1>
    </div>
    <div class="bg-[#18181b] rounded-lg border border-[rgba(255,255,255,0.06)] p-8">
      <slot />
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/layouts/ packages/admin/src/components/Sidebar.astro
git commit -m "feat(R2): dark layout shell — AdminLayout, collapsible Sidebar, AuthLayout"
```

---

## Task R3: Core Pages (Dashboard + Content List + Login)

**Files:**
- Modify: `packages/admin/src/pages/index.astro`
- Modify: `packages/admin/src/pages/login.astro`
- Modify: `packages/admin/src/pages/content/[collection].astro`
- Modify: `packages/admin/src/components/DashboardStats.tsx`
- Modify: `packages/admin/src/components/ContentList.tsx`
- Modify: `packages/admin/src/components/SearchBar.tsx`
- Modify: `packages/admin/src/components/LoginForm.tsx`
- Modify: `packages/admin/src/components/LoadingSkeleton.tsx`

- [ ] **Step 1: Read all files listed above before making any changes**

- [ ] **Step 2: Restyle Dashboard page (index.astro)**

Replace the content inside the `<AdminLayout>` tag. Change all light classes to dark:
- `text-gray-900` → `text-[#fafafa]`
- `bg-blue-600 text-white` buttons → `bg-[#fafafa] text-[#0a0a0c]`
- `hover:bg-blue-700` → `hover:bg-[#e4e4e7]`
- `text-gray-500` → `text-[#71717a]`

- [ ] **Step 3: Restyle DashboardStats.tsx**

Apply dark palette to the entire component. Every Tailwind class referencing light colors must change:
- `bg-white` → `bg-[#18181b]`
- `border-gray-200` → `border-[rgba(255,255,255,0.06)]`
- `hover:border-blue-300` → `hover:border-[rgba(255,255,255,0.15)]`
- `text-gray-900` → `text-[#fafafa]`
- `text-gray-500` → `text-[#71717a]`
- `text-gray-400` → `text-[#52525b]`
- `bg-gray-50` → `bg-[rgba(255,255,255,0.05)]`
- `border-dashed` card: `bg-[#18181b] border-[rgba(255,255,255,0.06)] border-dashed text-[#52525b] hover:text-[#71717a] hover:border-[rgba(255,255,255,0.1)]`
- Replace `📄` emoji with inline SVG or just remove it (the icon is decorative and the card has text)

- [ ] **Step 4: Restyle ContentList.tsx**

Apply dark palette. Key changes:
- Status badge colors: `draft: "bg-[rgba(255,255,255,0.05)] text-[#71717a]"`, `published: "bg-[rgba(34,197,94,0.1)] text-[#22c55e]"`, `archived: "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]"`, `in_review: "bg-[rgba(255,255,255,0.08)] text-[#a1a1aa]"`, `scheduled: "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]"`
- Table: `bg-white` → `bg-[#18181b]`, `border-gray-200` → `border-[rgba(255,255,255,0.06)]`, `bg-gray-50` thead → remove bg (transparent), `divide-gray-100` → `divide-[rgba(255,255,255,0.06)]`, `hover:bg-gray-50` → `hover:bg-[rgba(255,255,255,0.02)]`
- Text: `text-gray-900` → `text-[#fafafa]`, `text-gray-500` → `text-[#71717a]`, `text-blue-600` → `text-[#fafafa]`
- Empty states: `bg-white` → `bg-[#18181b]`, button: `bg-blue-600 text-white` → `bg-[#fafafa] text-[#0a0a0c]`
- Error: `bg-red-50 border-red-200 text-red-600` → `bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#ef4444]`
- Delete button: `text-red-600 hover:text-red-800` → `text-[#52525b] hover:text-[#ef4444]`

- [ ] **Step 5: Restyle SearchBar.tsx**

Read the file first. Change input styling to:
- `border-gray-300` → `border-[rgba(255,255,255,0.1)]`
- `bg-white` or default → `bg-transparent`
- `text-sm` stays, add `text-[#fafafa]`
- `placeholder:text-[#52525b]`
- `focus:ring-blue-500` → `focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0`

- [ ] **Step 6: Restyle LoginForm.tsx**

- Labels: `text-gray-700` → `text-[#a1a1aa]`
- Input: `border-gray-300` → `border-[rgba(255,255,255,0.1)]`, add `bg-transparent text-[#fafafa] placeholder:text-[#52525b]`, focus → `focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0`
- Button: `bg-blue-600 text-white hover:bg-blue-700` → `bg-[#fafafa] text-[#0a0a0c] hover:bg-[#e4e4e7]`
- Error text: `text-red-600` → `text-[#ef4444]`
- Success state: `text-gray-900` → `text-[#fafafa]`, `text-gray-500` → `text-[#71717a]`, `text-blue-600` → `text-[#a1a1aa] hover:text-[#fafafa]`
- Replace `📧` emoji with just a simple text: "Check your email" heading is enough
- Login page (login.astro): `text-gray-900` → `text-[#fafafa]`, `text-gray-500` → `text-[#71717a]`

- [ ] **Step 7: Restyle LoadingSkeleton.tsx**

Read file first. Change skeleton bg colors:
- `bg-gray-200` or `bg-gray-100` → `bg-[rgba(255,255,255,0.06)]`
- `animate-pulse` stays
- Any surrounding card: `bg-white border-gray-200` → `bg-[#18181b] border-[rgba(255,255,255,0.06)]`

- [ ] **Step 8: Restyle content/[collection].astro**

- `text-gray-500` → `text-[#71717a]`
- `bg-blue-600 text-white hover:bg-blue-700` → `bg-[#fafafa] text-[#0a0a0c] hover:bg-[#e4e4e7]`

- [ ] **Step 9: Commit**

```bash
git add packages/admin/src/pages/index.astro packages/admin/src/pages/login.astro packages/admin/src/pages/content/ packages/admin/src/components/DashboardStats.tsx packages/admin/src/components/ContentList.tsx packages/admin/src/components/SearchBar.tsx packages/admin/src/components/LoginForm.tsx packages/admin/src/components/LoadingSkeleton.tsx
git commit -m "feat(R3): dark restyle — dashboard, content list, login, search, skeletons"
```

---

## Task R4: Secondary Pages (Content Editor + Media + Webhooks + Settings + Utilities)

**Files:**
- Modify: `packages/admin/src/components/ContentEditor.tsx`
- Modify: `packages/admin/src/components/MediaLibrary.tsx`
- Modify: `packages/admin/src/components/WebhookManager.tsx`
- Modify: `packages/admin/src/components/ThemeCustomizer.tsx`
- Modify: `packages/admin/src/components/Toast.tsx`
- Modify: `packages/admin/src/components/ErrorBoundary.tsx`
- Modify: `packages/admin/src/components/VersionHistory.tsx`
- Modify: `packages/admin/src/components/PreviewLink.tsx`

- [ ] **Step 1: Read ALL files listed above before making any changes**

- [ ] **Step 2: Restyle ContentEditor.tsx**

This is the largest component. Apply dark palette throughout:
- All `bg-white` → `bg-[#18181b]`
- All `border-gray-200` / `border-gray-300` → `border-[rgba(255,255,255,0.06)]` / `border-[rgba(255,255,255,0.1)]`
- All `text-gray-900` → `text-[#fafafa]`, `text-gray-700` → `text-[#a1a1aa]`, `text-gray-500` → `text-[#71717a]`, `text-gray-400` → `text-[#52525b]`
- All inputs: add `bg-transparent text-[#fafafa] placeholder:text-[#52525b]`, replace `focus:ring-blue-500` with `focus:border-[rgba(255,255,255,0.2)] focus:outline-none`
- Buttons: `bg-blue-600 text-white hover:bg-blue-700` → `bg-[#fafafa] text-[#0a0a0c] hover:bg-[#e4e4e7]`
- Save Draft button (secondary): `border-gray-300 text-gray-700 hover:bg-gray-50` → `border-[rgba(255,255,255,0.08)] text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.05)]`
- Tiptap editor container: add `[&_.ProseMirror]:text-[#fafafa] [&_.ProseMirror]:bg-transparent` to the wrapper div
- `hover:bg-gray-50` → `hover:bg-[rgba(255,255,255,0.03)]`
- Select dropdowns: add `bg-[#18181b] text-[#fafafa]`

- [ ] **Step 3: Restyle MediaLibrary.tsx**

Read first. Apply same pattern:
- Card backgrounds: `bg-white` → `bg-[#18181b]`
- Borders: → `border-[rgba(255,255,255,0.06)]`
- Text hierarchy: primary/secondary/muted mapping
- Upload button: accent style
- Image grid cards: dark surface bg

- [ ] **Step 4: Restyle WebhookManager.tsx**

Same pattern. This component has cards, forms, badges, and toggle buttons:
- All card/form `bg-white` → `bg-[#18181b]`
- Inputs → dark input pattern
- Active badge: `bg-green-100 text-green-700` → `bg-[rgba(34,197,94,0.1)] text-[#22c55e]`
- Inactive badge: `bg-gray-100 text-gray-500` → `bg-[rgba(255,255,255,0.05)] text-[#71717a]`
- Delete: `text-red-600` → `text-[#52525b] hover:text-[#ef4444]`
- Create button: accent style

- [ ] **Step 5: Restyle ThemeCustomizer.tsx**

Read first. Same dark pattern for all panels, inputs, labels.

- [ ] **Step 6: Restyle utility components (Toast, ErrorBoundary, VersionHistory, PreviewLink)**

Read each file. Apply dark palette:
- **Toast:** success/error/info backgrounds should use semantic colors with low opacity (same badge pattern)
- **ErrorBoundary:** `bg-red-50` → `bg-[rgba(239,68,68,0.1)]`, text → `text-[#ef4444]`
- **VersionHistory:** list items dark, timestamps muted
- **PreviewLink:** dark card, link text → `text-[#a1a1aa] hover:text-[#fafafa]`

- [ ] **Step 7: Commit**

```bash
git add packages/admin/src/components/ContentEditor.tsx packages/admin/src/components/MediaLibrary.tsx packages/admin/src/components/WebhookManager.tsx packages/admin/src/components/ThemeCustomizer.tsx packages/admin/src/components/Toast.tsx packages/admin/src/components/ErrorBoundary.tsx packages/admin/src/components/VersionHistory.tsx packages/admin/src/components/PreviewLink.tsx
git commit -m "feat(R4): dark restyle — content editor, media, webhooks, settings, utilities"
```

---

## Task R5: Automations Components

**Files:**
- Modify: `packages/admin/src/components/automations/FlowList.tsx`
- Modify: `packages/admin/src/components/automations/FlowEditor.tsx`
- Modify: `packages/admin/src/components/automations/FlowCanvas.tsx`
- Modify: `packages/admin/src/components/automations/StepConfigurator.tsx`
- Modify: `packages/admin/src/components/automations/StepPicker.tsx`
- Modify: `packages/admin/src/components/automations/RunList.tsx`
- Modify: `packages/admin/src/components/automations/RunDetail.tsx`
- Modify: `packages/admin/src/pages/automations/index.astro`
- Modify: `packages/admin/src/pages/automations/[id].astro`

- [ ] **Step 1: Read ALL 9 files before making changes**

- [ ] **Step 2: Restyle FlowList.tsx**

- All `bg-white` → `bg-[#18181b]`
- Borders: → `border-[rgba(255,255,255,0.06)]`
- Flow name link: `text-blue-600` → `text-[#fafafa]`
- Trigger badge: keep gray bg → `bg-[rgba(255,255,255,0.05)] text-[#71717a]`
- Active badge: `bg-green-100 text-green-700` → `bg-[rgba(34,197,94,0.1)] text-[#22c55e]`
- Inactive badge: `bg-gray-100 text-gray-500` → `bg-[rgba(255,255,255,0.05)] text-[#71717a]`
- Delete button: `text-red-600` → `text-[#52525b] hover:text-[#ef4444]`
- "+ New Flow" button: `bg-blue-600 text-white` → `bg-[#fafafa] text-[#0a0a0c] hover:bg-[#e4e4e7]`
- Empty state: dark surface

- [ ] **Step 3: Restyle FlowEditor.tsx**

- Top bar: `bg-white` → `bg-[#18181b]`, `border-gray-200` → `border-[rgba(255,255,255,0.06)]`
- Name input: `text-gray-900` → `text-[#fafafa]`, `bg-transparent`
- Save button: accent style
- Active/Inactive toggle: dark badges as above
- Tab switcher: `border-gray-200` → `border-[rgba(255,255,255,0.1)]`, active tab: `bg-blue-600 text-white` → `bg-[#fafafa] text-[#0a0a0c]`, inactive: `text-gray-600` → `text-[#71717a]`
- Canvas container: `bg-gray-50` → `bg-[#0a0a0c]`, the dot grid radial-gradient should change to use `#27272a` dots: `radial-gradient(circle, #27272a 1px, transparent 1px)`
- Config panel wrapper: remains transparent (child components handle their own bg)
- "Saved at" text: `text-gray-400` → `text-[#52525b]`

- [ ] **Step 4: Restyle FlowCanvas.tsx**

- Trigger block: `bg-blue-600 text-white border-blue-600` → `bg-[#fafafa] text-[#0a0a0c] border-[#fafafa]`, selected: `border-[#fafafa] ring-[rgba(255,255,255,0.2)]`
- Condition step block: `border-amber-300 bg-amber-50` → `border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.05)]`
- Action step block: `border-gray-200 bg-white` → `border-[rgba(255,255,255,0.06)] bg-[#18181b]`
- Selected state: `border-blue-500 ring-blue-200` → `border-[#fafafa] ring-[rgba(255,255,255,0.15)]`
- Text inside blocks: `text-gray-800` → `text-[#fafafa]`, `text-gray-400` → `text-[#52525b]`
- Connector lines: `bg-gray-300` → `bg-[rgba(255,255,255,0.1)]`
- `[+]` buttons: `bg-gray-100 border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200` → `bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] text-[#52525b] hover:bg-[rgba(255,255,255,0.08)] hover:text-[#a1a1aa] hover:border-[rgba(255,255,255,0.15)]`
- "Remove" text: `text-gray-400 hover:text-red-500` → `text-[#3f3f46] hover:text-[#ef4444]`
- End node: `bg-gray-200 text-gray-500` → `bg-[rgba(255,255,255,0.05)] text-[#52525b]`
- Run status colors: `border-green-400 bg-green-50` → `border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.05)]`; red → `border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)]`; gray → `border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]`
- Status badges in readOnly mode: `bg-green-100 text-green-700` → `bg-[rgba(34,197,94,0.1)] text-[#22c55e]`, etc.
- Onboarding hint text: `text-gray-400` → `text-[#52525b]`, inline `[+]` badge → dark version

- [ ] **Step 5: Restyle StepConfigurator.tsx**

- Panel bg: `bg-white` → `bg-[#18181b]`, border → dark
- Left border accents: `border-l-blue-500` → `border-l-[#fafafa]` (trigger), `border-l-amber-400` → `border-l-[#f59e0b]` (condition), `border-l-gray-400` → `border-l-[#52525b]` (action)
- Heading: `text-gray-800` → `text-[#fafafa]`
- Labels: `text-gray-500` → `text-[#71717a]`
- All inputs: dark input pattern
- Select dropdowns: `bg-[#18181b] text-[#fafafa] border-[rgba(255,255,255,0.1)]`
- Rule row inputs: dark pattern, smaller
- "+ Add rule" text: `text-blue-600` → `text-[#a1a1aa] hover:text-[#fafafa]`
- Remove rule "x": `text-red-400` → `text-[#52525b] hover:text-[#ef4444]`
- Helper text: `text-gray-400` → `text-[#52525b]`, inline code: `bg-gray-100` → `bg-[rgba(255,255,255,0.05)]`
- Close button: `text-gray-400 hover:text-gray-600` → `text-[#52525b] hover:text-[#a1a1aa]`
- Cron presets: `bg-gray-100 text-gray-600 hover:bg-gray-200` → `bg-[rgba(255,255,255,0.05)] text-[#71717a] hover:bg-[rgba(255,255,255,0.08)]`

- [ ] **Step 6: Restyle StepPicker.tsx**

- Container: `bg-white border-gray-200 shadow-lg` → `bg-[#18181b] border-[rgba(255,255,255,0.08)] shadow-2xl`
- Header: `border-gray-100` → `border-[rgba(255,255,255,0.06)]`
- Header text: `text-gray-500` → `text-[#52525b]`
- Close button: `text-gray-400 hover:text-gray-600` → `text-[#52525b] hover:text-[#a1a1aa]`
- Section labels: `text-gray-400` → `text-[#52525b]`
- Logic options: `hover:bg-amber-50 border-l-transparent hover:border-l-amber-400` → `hover:bg-[rgba(245,158,11,0.05)] border-l-transparent hover:border-l-[#f59e0b]`
- Action options: `hover:bg-blue-50 border-l-transparent hover:border-l-blue-400` → `hover:bg-[rgba(255,255,255,0.03)] border-l-transparent hover:border-l-[#fafafa]`
- Option text: `text-gray-800` → `text-[#e4e4e7]`, description: `text-gray-500` → `text-[#52525b]`

- [ ] **Step 7: Restyle RunList.tsx**

- Container: `bg-white` → `bg-[#18181b]`, border → dark
- Table header: `text-gray-500` → `text-[#52525b]`, `border-gray-100` → `border-[rgba(255,255,255,0.06)]`
- Table rows: `hover:bg-gray-50` → `hover:bg-[rgba(255,255,255,0.02)]`, `divide-gray-50` → `divide-[rgba(255,255,255,0.04)]`
- Row text: `text-gray-700` → `text-[#d4d4d8]`, `text-gray-500` → `text-[#71717a]`
- Status badges: dark semantic colors as defined above
- Pagination: `text-gray-500 hover:text-gray-800` → `text-[#52525b] hover:text-[#a1a1aa]`, `text-gray-400` → `text-[#3f3f46]`
- Empty state: dark text

- [ ] **Step 8: Restyle RunDetail.tsx**

- Run info bar: `bg-white` → `bg-[#18181b]`, border → dark
- Error banner: `bg-red-50 border-red-200 text-red-700` → `bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#ef4444]`
- Canvas container: `bg-gray-50` → `bg-[#0a0a0c]`, border → dark
- Step detail panel: `bg-white` → `bg-[#18181b]`, border → dark
- JSON viewer pre tags: `bg-gray-50 border-gray-100` → `bg-[#0a0a0c] border-[rgba(255,255,255,0.06)]`
- Error pre: `bg-red-50 border-red-100 text-red-700` → `bg-[rgba(239,68,68,0.05)] border-[rgba(239,68,68,0.1)] text-[#ef4444]`
- Text hierarchy: apply standard mapping
- Branch badge: `bg-amber-100 text-amber-700` → `bg-[rgba(245,158,11,0.1)] text-[#f59e0b]`

- [ ] **Step 9: Restyle automation Astro pages**

`automations/index.astro`: `text-gray-500` → `text-[#71717a]`

`automations/[id].astro`: `text-blue-600 hover:text-blue-800` → `text-[#71717a] hover:text-[#a1a1aa]`

- [ ] **Step 10: Commit**

```bash
git add packages/admin/src/components/automations/ packages/admin/src/pages/automations/
git commit -m "feat(R5): dark restyle — all automation components"
```

---

## Verification

After all tasks, start the dev server and visually verify:

```bash
bun run dev
```

Check each page:
1. `/login` — dark card, white logo, dark inputs
2. `/` — dark dashboard cards, dark bg
3. `/content/blog_post` — dark table, dark search, dark badges
4. `/content/blog_post/new` — dark editor, dark sidebar
5. `/media` — dark grid
6. `/webhooks` — dark cards
7. `/settings` — dark customizer
8. `/automations` — dark flow list
9. `/automations/:id` — dark editor, dark canvas with dot grid, dark configurator
10. Sidebar collapse/expand works, state persists across reload
