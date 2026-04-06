# not-a-cms — Product Milestones

## Current State

**M1: Foundation** — Complete
**Phase A: Wire It Together** — Complete
**Phase B: Production Essentials** — Complete
**Phase C: The Differentiators** — Complete
**Phase D: Visual Site Builder** — Complete

220 tests, 6 packages. Visual page builder with drag-and-drop component canvas (@dnd-kit), component registry with REST API, CSS Grid positioning with resize handles, visual CSS editor (layout/spacing/typography/background/border), responsive breakpoints (desktop/tablet/mobile) with per-device overrides and media query generation. New `pageLayout` field type stores pages as Portable Text-like JSON. Auto-migration adds missing columns to existing tables.

---

## Phase A: Wire It Together (DONE)

> Goal: Turn the scaffolding into a working CMS you can demo and use.

- [x] **A1: Embed editor in admin** — Tiptap `<Editor>` embedded in ContentEditor.tsx via React.lazy() (avoids bun:sqlite in Vite bundle). Portable Text serialization wired for save/load.

- [x] **A2: Schema metadata API** — `/api/_schema` endpoint returns all collections with field definitions. All admin pages fetch from this instead of hardcoded arrays. Sidebar, content list, and editor are fully schema-driven.

- [x] **A3: Auth middleware** — AdminLayout.astro checks session via Better Auth. Unauthenticated users redirected to /login. Login page uses separate AuthLayout (no redirect loop). Magic link flow wired.

- [x] **A4: Media upload + storage** — `/api/media/upload` endpoint with local file storage. MediaLibrary component uploads to real endpoint. Files persist to disk in configurable uploads directory.

- [x] **A5: Y.js WebSocket handler** — `/collab` WebSocket route in Bun.serve() with Y.js doc management. One Y.Doc per document, pub/sub broadcasting, state sync on connect.

- [x] **A6: Slug auto-generation** — `slugify()` utility in core (handles unicode, special chars, hyphen collapsing). ContentEditor slug field has "Generate" button. Field defaults (like status: "draft") now pre-populated on new content.

---

## Phase B: Production Essentials (DONE)

> Goal: Make it reliable enough to run a real site.

- [x] **B1: Content versioning** — `_versions` table with snapshot on every save/publish. Version history sidebar in editor with expand/collapse and restore. Auto-increments version numbers per document.

- [x] **B2: Full-text search** — SQLite FTS5 with porter stemmer across all collections. Dynamic field extraction from schema (not hardcoded). SearchBar with 300ms debounce. REST `?search=` param. Query injection protection.

- [x] **B3: Drizzle Kit migrations** — Custom SQL migration runner with `_migrations` tracking table. `not-a-cms generate migration` creates timestamped SQL files. `not-a-cms migrate run/status` applies and reports. bootstrapTables() preserved for dev convenience.

- [x] **B4: Image optimization** — Sharp pipeline generates responsive variants (640-1536px) in WebP + AVIF. Blur placeholder (20x20 base64 JPEG). Metadata extraction (dimensions). `<picture>` tag with srcset in Image.astro. Failure-tolerant (serves original on error).

- [x] **B5: Error handling + loading states** — ErrorBoundary wraps React islands. ToastProvider with 4s auto-dismiss (success/error/info). ContentListSkeleton and ContentEditorSkeleton. Proper API error messages with collection context.

- [x] **B6: Renderer connected to API** — `[...slug].astro` fetches by slug across collections, renders Portable Text through `portableTextToHtml`. Homepage lists published posts. Dev script boots renderer alongside admin + API. Slug lookup REST endpoint.

- [x] **B7: RSS feed with real content** — `rss.xml.ts` fetches published posts, renders Portable Text body to HTML descriptions. Includes title, link, pubDate, guid. Graceful fallback on API unavailability.

- [x] **B8: Deployment** — Multi-stage Dockerfile (oven/bun:1.2). docker-compose.yml with persistent volumes for data + uploads. fly.toml with auto-scaling, HTTPS enforcement, persistent storage mount.

---

## Phase C: The Differentiators (DONE)

> Goal: Features that make not-a-cms better than the alternatives.

- [x] **C1: GraphQL endpoint** — Pothos auto-generates typed GraphQL schema from collections. Mounted at `/graphql` with graphql-yoga playground. List queries with `limit`, `offset`, `where` (JSON) args. Single-item queries by ID.

- [x] **C2: Webhook system** — DB-backed webhook store with CRUD REST API. Event matching by collection + event type. HMAC-SHA256 signing. Retry with exponential backoff (3 attempts). Delivery logging. Admin WebhookManager UI with create/toggle/delete.

- [x] **C3: Scheduled publishing** — `createScheduler` promotes posts with `status: "scheduled"` and past `publishedAt`. Server runs 60-second interval check. Purple "scheduled" badge in admin content list.

- [x] **C4: Content preview** — Token-based preview links (72h TTL). `POST /api/_preview/generate` creates tokens. `GET /api/_preview/validate/:token` returns document. Renderer preview page with yellow "this is a preview" banner. PreviewLink component in editor sidebar.

- [x] **C5: Role-based field visibility** — `filterFieldsByRole` checks `access.read` and `access.write` on field definitions. Schema API accepts `?role=` param and filters fields accordingly. Admin adapts automatically.

- [x] **C6: Theme customizer** — Key-value `_settings` table with upsert. REST API at `/api/_settings`. ThemeCustomizer admin component with color picker, font select, header style, and max-width controls. Settings persisted to DB.

- [x] **C7: Email channel rendering** — MJML-based `portableTextToEmail()` converts Portable Text to email-safe HTML. Handles paragraphs, headings, bold/italic, images, code blocks, dividers. Wraps in branded email template.

- [x] **C8: WordPress import** — `htmlToPortableText()` converts HTML to Portable Text (paragraphs, headings, lists, blockquotes, images, inline marks). `parseWXR()` extracts posts from WXR XML. CLI: `not-a-cms import wordpress <file>`.

---

## Phase D: Visual Site Builder (DONE)

> Goal: Non-technical users can build pages visually.

- [x] **D1: Component registry in admin** — `defineComponent()` declarations passed to server config. `/api/_components` REST endpoint returns registry. Admin palette groups components by category. New `field.pageLayout()` field type.

- [x] **D2: Visual page builder** — @dnd-kit drag-and-drop canvas. Three-column layout: palette | canvas | configurator. Components placed on CSS Grid sections. Props edited via type-specific inputs. Saves as Portable Text-like JSON. Server-side page renderer converts layout to HTML.

- [x] **D3: Visual CSS editor** — StyleEditor with 5 category tabs (layout, spacing, typography, background, border). Style compiler generates CSS from style objects. Inline styles flow through to renderer output.

- [x] **D4: Free grid positioning** — GridCanvas with resize handles (right/bottom/corner). Snap-to-grid drag repositioning. Visual grid lines overlay. Numeric position controls. Z-index for overlapping.

- [x] **D5: Responsive breakpoints** — BreakpointSwitcher (desktop 1280px, tablet 768px, mobile 375px). Canvas resizes to active breakpoint. Per-breakpoint grid position overrides and hide toggles. Renderer generates `@media` queries.

---

## Phase E: Automations & Integrations (M3-M4)

> Goal: Replace Zapier for CMS workflows.

- [ ] **E1: Visual automation builder** — Event-driven workflow editor. Trigger: content events, cron, webhook. Actions: send email, call API, update content, notify. Visual flow canvas like Directus Flows.

- [ ] **E2: Built-in email sending** — Transactional email (magic links, notifications) via configurable provider (Resend, SES, SMTP). Template engine for email layouts.

- [ ] **E3: Newsletter delivery** — Subscriber management. Send email channel render of a post to subscribers on publish. Free/paid tier segmentation.

- [ ] **E4: Third-party integrations** — Pre-built connectors: Stripe (payments), Mailchimp, Slack, Google Analytics. Webhook-based for anything else.

---

## Phase F: Membership & Paywall (M5)

> Goal: Monetize content directly.

- [ ] **F1: Subscriber management** — Sign up flow, subscriber profiles, email preferences. Import from Mailchimp/Substack.

- [ ] **F2: Free/paid tiers** — Define membership tiers with different content access levels. Gate content at the collection or individual post level.

- [ ] **F3: Stripe integration** — Payment processing, subscription management, invoicing. Handle upgrades, downgrades, cancellations.

- [ ] **F4: Subscriber-only content** — Content visibility rules based on membership tier. Teaser content for non-subscribers. "Subscribe to read more" paywall.

---

## Phase G: Plugin Marketplace (M6)

> Goal: Third-party extensibility at scale.

- [ ] **G1: Plugin manifest and lifecycle** — Standardized plugin format (npm package with manifest). Install, activate, deactivate, uninstall via admin UI.

- [ ] **G2: Sandboxed execution** — Plugins run in isolated V8 contexts (similar to EmDash's Dynamic Workers). Capability-scoped permissions declared in manifest.

- [ ] **G3: Marketplace** — Browse, search, install plugins from a registry. Ratings, reviews, verified publishers. Revenue sharing for paid plugins.

- [ ] **G4: Theme marketplace** — Same marketplace for themes. Preview before install. One-click activate.

---

## Phase H: AI Infrastructure (M7)

> Goal: AI as a first-class citizen, not a bolted-on feature.

- [ ] **H1: MCP server** — Every not-a-cms instance exposes an MCP server. AI agents can create content types, manage entries, query content, install plugins.

- [ ] **H2: AI writing assistant** — Inline AI assistance in the editor. Continue writing, rewrite selection, summarize, translate. Powered by the structured Portable Text model (not HTML string manipulation).

- [ ] **H3: AI content generation** — Generate full posts from a prompt. Auto-generate SEO metadata. Suggest tags and categories. Image generation for cover images.

- [ ] **H4: AI-powered search** — Semantic search over content using embeddings. "Find posts similar to this one." Auto-tag content based on embeddings.

---

## Success Metrics

| Milestone | "Done" when... |
|---|---|
| Phase A | You can log in, create a blog post with rich text, and see it on the public site |
| Phase B | You'd trust it to run your personal blog in production |
| Phase C | You'd recommend it to a client over WordPress |
| Phase D | A non-technical user can build a landing page without help |
| Phase E | Marketing team can set up "publish → tweet → email subscribers" without a developer |
| Phase F | A writer can earn money from their content on their own site |
| Phase G | Third-party developers are building and selling plugins |
| Phase H | An AI agent can manage an entire site autonomously |
