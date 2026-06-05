# not-a-cms: Product Milestones

## Current State

**Shipped:**

- [x] M1: Foundation
- [x] Phase A: Wire It Together
- [x] Phase B: Production Essentials
- [x] Phase C: The Differentiators
- [x] Phase D: Visual Site Builder
- [x] Phase E: Radical Admin & Real-Time
- [x] Phase F: Media Library

**Planned:** Phase G (Email, Newsletters & Integrations), Phase H (Membership & Paywall), Phase I (Plugin Marketplace), Phase J (AI Infrastructure).

708 passing tests across 6 packages (core, server, admin, editor, renderer, cli). The admin is a schema-driven Astro + React-islands app with a `⌘K` command palette, a document-canvas editor with live collaboration and channel preview, a dashboard of publishing/expiry horizons and review/automation queues, a visual page builder, a media Vault with folders/tags/usage tracking, and a visual automations engine with dry-run testing. Content is stored as Portable Text and served over REST, tRPC, and GraphQL.

---

## Phase A: Wire It Together (DONE)

> Goal: Turn the scaffolding into a working CMS you can demo and use.

- [x] **A1: Embed editor in admin.** Tiptap `<Editor>` embedded in ContentEditor.tsx via React.lazy() (avoids bun:sqlite in Vite bundle). Portable Text serialization wired for save/load.

- [x] **A2: Schema metadata API.** `/api/_schema` endpoint returns all collections with field definitions. All admin pages fetch from this instead of hardcoded arrays. Sidebar, content list, and editor are fully schema-driven.

- [x] **A3: Auth middleware.** AdminLayout.astro checks session via Better Auth. Unauthenticated users redirected to /login. Login page uses separate AuthLayout (no redirect loop). Magic link flow wired.

- [x] **A4: Media upload + storage.** `/api/media/upload` endpoint with local file storage. MediaLibrary component uploads to real endpoint. Files persist to disk in configurable uploads directory.

- [x] **A5: Y.js WebSocket handler.** `/collab` WebSocket route in Bun.serve() with Y.js doc management. One Y.Doc per document, pub/sub broadcasting, state sync on connect.

- [x] **A6: Slug auto-generation.** `slugify()` utility in core (handles unicode, special chars, hyphen collapsing). ContentEditor slug field has "Generate" button. Field defaults (like status: "draft") now pre-populated on new content.

---

## Phase B: Production Essentials (DONE)

> Goal: Make it reliable enough to run a real site.

- [x] **B1: Content versioning.** `_versions` table with snapshot on every save/publish. Version history sidebar in editor with expand/collapse and restore. Auto-increments version numbers per document.

- [x] **B2: Full-text search.** SQLite FTS5 with porter stemmer across all collections. Dynamic field extraction from schema (not hardcoded). SearchBar with 300ms debounce. REST `?search=` param. Query injection protection.

- [x] **B3: Drizzle Kit migrations.** Custom SQL migration runner with `_migrations` tracking table. `not-a-cms generate migration` creates timestamped SQL files. `not-a-cms migrate run/status` applies and reports. bootstrapTables() preserved for dev convenience.

- [x] **B4: Image optimization.** Sharp pipeline generates responsive variants (640-1536px) in WebP + AVIF. Blur placeholder (20x20 base64 JPEG). Metadata extraction (dimensions). `<picture>` tag with srcset in Image.astro. Failure-tolerant (serves original on error).

- [x] **B5: Error handling + loading states.** ErrorBoundary wraps React islands. ToastProvider with 4s auto-dismiss (success/error/info). ContentListSkeleton and ContentEditorSkeleton. Proper API error messages with collection context.

- [x] **B6: Renderer connected to API.** `[...slug].astro` fetches by slug across collections, renders Portable Text through `portableTextToHtml`. Homepage lists published posts. Dev script boots renderer alongside admin + API. Slug lookup REST endpoint.

- [x] **B7: RSS feed with real content.** `rss.xml.ts` fetches published posts, renders Portable Text body to HTML descriptions. Includes title, link, pubDate, guid. Graceful fallback on API unavailability.

- [x] **B8: Deployment.** Multi-stage Dockerfile (oven/bun:1.2). docker-compose.yml with persistent volumes for data + uploads. fly.toml with auto-scaling, HTTPS enforcement, persistent storage mount.

---

## Phase C: The Differentiators (DONE)

> Goal: Features that make not-a-cms better than the alternatives.

- [x] **C1: GraphQL endpoint.** Pothos auto-generates typed GraphQL schema from collections. Mounted at `/graphql` with graphql-yoga playground. List queries with `limit`, `offset`, `where` (JSON) args. Single-item queries by ID.

- [x] **C2: Webhook system.** DB-backed webhook store with CRUD REST API. Event matching by collection + event type. HMAC-SHA256 signing. Retry with exponential backoff (3 attempts). Delivery logging. Admin WebhookManager UI with create/toggle/delete.

- [x] **C3: Scheduled publishing.** `createScheduler` promotes posts with `status: "scheduled"` and past `publishedAt`. Server runs 60-second interval check. Purple "scheduled" badge in admin content list.

- [x] **C4: Content preview.** Token-based preview links (72h TTL). `POST /api/_preview/generate` creates tokens. `GET /api/_preview/validate/:token` returns document. Renderer preview page with yellow "this is a preview" banner. PreviewLink component in editor sidebar.

- [x] **C5: Role-based field visibility.** `filterFieldsByRole` checks `access.read` and `access.write` on field definitions. Schema API accepts `?role=` param and filters fields accordingly. Admin adapts automatically.

- [x] **C6: Theme customizer.** Key-value `_settings` table with upsert. REST API at `/api/_settings`. ThemeCustomizer admin component with color picker, font select, header style, and max-width controls. Settings persisted to DB.

- [x] **C7: Email channel rendering.** MJML-based `portableTextToEmail()` converts Portable Text to email-safe HTML. Handles paragraphs, headings, bold/italic, images, code blocks, dividers. Wraps in branded email template.

- [x] **C8: WordPress import.** `htmlToPortableText()` converts HTML to Portable Text (paragraphs, headings, lists, blockquotes, images, inline marks). `parseWXR()` extracts posts from WXR XML. CLI: `not-a-cms import wordpress <file>`.

---

## Phase D: Visual Site Builder (DONE)

> Goal: Non-technical users can build pages visually.

- [x] **D1: Component registry in admin.** `defineComponent()` declarations passed to server config. `/api/_components` REST endpoint returns registry. Admin palette groups components by category. New `field.pageLayout()` field type.

- [x] **D2: Visual page builder.** @dnd-kit drag-and-drop canvas. Three-column layout: palette | canvas | configurator. Components placed on CSS Grid sections. Props edited via type-specific inputs. Saves as Portable Text-like JSON. Server-side page renderer converts layout to HTML.

- [x] **D3: Visual CSS editor.** StyleEditor with 5 category tabs (layout, spacing, typography, background, border). Style compiler generates CSS from style objects. Inline styles flow through to renderer output.

- [x] **D4: Free grid positioning.** GridCanvas with resize handles (right/bottom/corner). Snap-to-grid drag repositioning. Visual grid lines overlay. Numeric position controls. Z-index for overlapping.

- [x] **D5: Responsive breakpoints.** BreakpointSwitcher (desktop 1280px, tablet 768px, mobile 375px). Canvas resizes to active breakpoint. Per-breakpoint grid position overrides and hide toggles. Renderer generates `@media` queries.

---

## Phase E: Radical Admin & Real-Time (DONE)

> Goal: Rebuild the admin into a purpose-built instrument, and make collaboration and automation first-class. (Specs and plans live under `docs/superpowers/`.)

- [x] **E1: Design system + app shell.** Self-hosted font pairing, design tokens (`packages/admin/src/styles/global.css`), and a standardized `Icon` (lucide-react). `AppShell.astro` (breadcrumb spine + thin collapsible rail) replaced `Sidebar.astro`. Keyboard grammar: `⌘K` go/do/find, `/` insert, `⌘↵` publish.

- [x] **E2: Command Deck.** Global `⌘K` `CommandPalette` island with Jump / Do / Find / Ask modes. Listens on a `nacms:command-open` event from anywhere in the admin.

- [x] **E3: Continuum editor.** Document-canvas editor (`packages/admin/src/components/continuum/`) with inline field-blocks (author, gallery, SEO) and a live `ChannelMirror`. Portable Text converters round-trip custom/atom blocks.

- [x] **E4: The Desk.** Dashboard with a publishing horizon (`GET /api/_horizon`) and a "needs you" queue (content in review plus failed automation runs via `GET /api/_flows/runs`).

- [x] **E5: Automations engine + UI.** Readable WHEN/IF/THEN rules over a flow engine that records real per-step timestamps, with a run Console (run feed + scrubber/step-timeline). Triggers: `content.created/updated/published/deleted`, `schedule.cron`, `webhook.received`. Conditions: `eq/neq/gt/lt/contains/not_contains/matches`, combined with `all`/`any`. Actions: create/update/delete content, email, webhook, transform, log. Real action adapters via `FlowEngineOptions`; content writes can suppress automation dispatch (loop prevention).

- [x] **E6: Automation dry-run.** `engine.dryRun` simulates a flow with zero side effects via a shared `walk` plus a swappable `RunRecorder` seam. `POST /api/_flows/dry-run` (ephemeral, flow-in-body). Admin TestPanel + extracted `RunInspector` carry simulated badges through the timeline.

- [x] **E7: The Vault.** Media library clustering assets by type plus an Unused group, with usage back-references (`GET /api/media/:id/usage` exact for media fields, `GET /api/media/usage` for counts).

- [x] **E8: Live presence + cursors.** `PresenceRegistry` over the collab WebSocket plus `GET /api/_presence`, feeding the Desk's Live-now panel. Per-caret remote cursors via a ProseMirror decoration plugin (`packages/editor/src/collaboration/remote-cursors.ts`) and a server relay.

- [x] **E9: Natural-language Ask.** Pluggable `AskProvider` plus a `content_embeddings` table and `GET /api/_ask`, with FTS fallback when no provider is configured. Vector search is served by a derived `sqlite-vec` `vec0` KNN index when the extension loads, falling back transparently to in-memory JS cosine otherwise (see Phase J4). Opt-in OpenAI/Anthropic adapters; no AI dependency added to core (`packages/core/src/ai/`, `packages/server/src/ask/`).

- [x] **E10: Real email mirror.** `POST /api/_email-preview` runs MJML server-side; the editor's `ChannelMirror` renders it in an `<iframe srcDoc>` for live email preview.

- [x] **E11: Content expiry.** Optional `unpublishAt`/`unpublish_at`; the scheduler auto-archives due published docs (`unpublishExpired` in `scheduler.ts`). `GET /api/_expiring` feeds the Desk's "expiring soon" Needs-you item.

- [x] **E12: Content export.** `not-a-cms export` writes all configured collections to JSON, complementing the WordPress importer.

---

## Phase F: Media Library (DONE)

> Goal: Turn the Vault into a real asset manager.

- [x] **F1: Media tags.** Per-asset tags, normalized and validated on PATCH, with a tag filter bar in the Vault.

- [x] **F2: Tag filtering + bulk.** Untagged filter, multi-tag AND filtering, and bulk add/remove of tags across selected assets.

- [x] **F3: Tag entities.** A tag registry with colors, recolor, global rename/delete, and a TagManager UI.

- [x] **F4: Media folders.** Folder tree, breadcrumb path, asset move ("Move to"), and reparenting delete. Server-side folder store + routes.

- [x] **F5: Persisted media-references index.** A `media_references` table populated by content write-hooks plus a boot rebuild, replacing the per-request usage scan. Reference store extracts references from fields and rich text; the Vault serves usage from the persisted reverse index.

---

## Phase G: Email, Newsletters & Integrations (PLANNED)

> Goal: Reach subscribers and connect to outside services. (The automations engine itself shipped in Phase E; the `email.send` seam exists with a dev console logger.)

- [ ] **G1: Built-in email sending.** Concrete transactional providers (Resend, SES, SMTP) behind the existing injectable `email.send` seam. Template engine for email layouts.

- [ ] **G2: Newsletter delivery.** Subscriber management. Send the email channel render of a post to subscribers on publish. Free/paid tier segmentation.

- [ ] **G3: Third-party connectors.** Pre-built connectors: Stripe (payments), Mailchimp, Slack, Google Analytics. Generic webhooks already cover everything else.

---

## Phase H: Membership & Paywall (PLANNED)

> Goal: Monetize content directly.

- [ ] **H1: Subscriber management.** Sign up flow, subscriber profiles, email preferences. Import from Mailchimp/Substack.

- [ ] **H2: Free/paid tiers.** Define membership tiers with different content access levels. Gate content at the collection or individual post level.

- [ ] **H3: Stripe integration.** Payment processing, subscription management, invoicing. Handle upgrades, downgrades, cancellations.

- [ ] **H4: Subscriber-only content.** Content visibility rules based on membership tier. Teaser content for non-subscribers. "Subscribe to read more" paywall.

---

## Phase I: Plugin Marketplace (PLANNED)

> Goal: Third-party extensibility at scale.

- [ ] **I1: Plugin manifest and lifecycle.** Standardized plugin format (npm package with manifest). Install, activate, deactivate, uninstall via admin UI.

- [ ] **I2: Sandboxed execution.** Plugins run in isolated V8 contexts (similar to EmDash's Dynamic Workers). Capability-scoped permissions declared in manifest.

- [ ] **I3: Marketplace.** Browse, search, install plugins from a registry. Ratings, reviews, verified publishers. Revenue sharing for paid plugins.

- [ ] **I4: Theme marketplace.** Same marketplace for themes. Preview before install. One-click activate.

---

## Phase J: AI Infrastructure (PLANNED)

> Goal: AI as a first-class citizen, not a bolted-on feature. (Semantic content search already shipped as Natural-language Ask in Phase E.)

- [ ] **J1: MCP server.** Every not-a-cms instance exposes an MCP server. AI agents can create content types, manage entries, query content, install plugins.

- [ ] **J2: AI writing assistant.** Inline AI assistance in the editor. Continue writing, rewrite selection, summarize, translate. Powered by the structured Portable Text model (not HTML string manipulation).

- [ ] **J3: AI content generation.** Generate full posts from a prompt. Auto-generate SEO metadata. Suggest tags and categories. Image generation for cover images.

- [ ] **J4: AI-powered search (extends Phase E).** Semantic search over embeddings shipped as Natural-language Ask, and the `sqlite-vec` extension now backs it (a derived `vec0` KNN index, auto-detected at boot with a JS-cosine fallback) so vector search scales beyond small catalogs. "Find posts similar to this one" and embedding-based auto-tagging are still planned.

---

## Success Metrics

| Milestone | "Done" when... |
|---|---|
| Phase A | You can log in, create a blog post with rich text, and see it on the public site |
| Phase B | You'd trust it to run your personal blog in production |
| Phase C | You'd recommend it to a client over WordPress |
| Phase D | A non-technical user can build a landing page without help |
| Phase E | The admin feels like a purpose-built instrument: teammates edit together live and automations run on publish |
| Phase F | A content team can manage a large asset library with folders, tags, and usage tracking |
| Phase G | Marketing team can set up "publish, then email subscribers" without a developer |
| Phase H | A writer can earn money from their content on their own site |
| Phase I | Third-party developers are building and selling plugins |
| Phase J | An AI agent can manage an entire site autonomously |
