# not-a-cms — Product Milestones

## Current State

**M1: Foundation** — Complete (134 tests, 6 packages, 44 commits)

Core schema engine, content CRUD, REST + tRPC APIs, passwordless auth, Tiptap editor package, Astro admin panel, renderer with block system, CLI tooling. All pieces built but not fully wired together.

---

## Phase A: Wire It Together

> Goal: Turn the scaffolding into a working CMS you can demo and use.

- [ ] **A1: Embed editor in admin** — Replace the richText placeholder in ContentEditor.tsx with the actual `<Editor>` from @not-a-cms/editor. Wire up Portable Text serialization so content saves and loads correctly.

- [ ] **A2: Schema metadata API** — Add a `/api/_schema` endpoint that returns all registered collections with their field definitions. Admin reads this instead of hardcoded arrays in Astro pages. Collections appear dynamically in sidebar, content list, and editor.

- [ ] **A3: Auth middleware** — Protect admin routes with session-based auth. Redirect unauthenticated users to /login. Wire up the magic link flow end-to-end (send → click → session cookie → redirect to dashboard). First user becomes owner automatically.

- [ ] **A4: Media upload + storage** — Add `/api/media/upload` endpoint. Store files to disk (configurable: local, S3, R2). Create `_media` table tracking filename, mimetype, size, path, dimensions. MediaLibrary component uploads to the real endpoint.

- [ ] **A5: Y.js WebSocket handler** — Add `/collab` WebSocket route to Bun.serve(). One Y.Doc per document, snapshot to DB periodically. Connect the editor's useCollaboration hook so two users can edit the same post in real-time.

- [ ] **A6: Slug auto-generation** — Auto-generate slug from title on blur (slugify: lowercase, replace spaces with hyphens, strip special chars). Show in the slug field with option to edit manually. Check uniqueness via API.

---

## Phase B: Production Essentials

> Goal: Make it reliable enough to run a real site.

- [ ] **B1: Content versioning** — Create `_versions` table. Snapshot content on every explicit save and publish. Version list in editor sidebar. Restore any previous version. Diff view between versions.

- [ ] **B2: Full-text search** — Add search to content list. SQLite FTS5 index on title + body. Search bar in admin content list with debounced filtering. REST API supports `?search=` query param.

- [ ] **B3: Drizzle Kit migrations** — Replace bootstrapTables() with proper migration workflow for production. `not-a-cms generate migration` creates SQL files. `not-a-cms migrate` applies them. Migration state tracked in `_migrations` table.

- [ ] **B4: Image optimization** — Process uploads through sharp/squoosh. Generate responsive variants (640, 768, 1024, 1280, 1536). Convert to WebP + AVIF. Extract dimensions + blur placeholder. Serve optimized variants via the Image component.

- [ ] **B5: Error handling + loading states** — Add error boundaries to all React islands. Loading skeletons for content list and editor. Toast notifications for save/publish/delete. Proper error messages from API (not just "Failed to fetch").

- [ ] **B6: Renderer connected to API** — Wire [...slug].astro to fetch real content via createContentFetcher. Render Portable Text through block components. Homepage lists recent published posts. Individual post pages work.

- [ ] **B7: RSS feed with real content** — Wire rss.xml.ts to fetch published posts and render through portableTextToHtml. Include title, link, description, pubDate, guid.

- [ ] **B8: Deployment** — Dockerfile + docker-compose.yml (Bun runtime, SQLite volume, uploads volume). Fly.io config with Postgres + persistent storage. Document the deploy process in README.

---

## Phase C: The Differentiators

> Goal: Features that make not-a-cms better than the alternatives.

- [ ] **C1: GraphQL endpoint** — Auto-generate GraphQL schema from collections using Pothos. Mount at `/graphql` with playground. Support queries with filtering, pagination, relations. Type-safe with generated schema.

- [ ] **C2: Webhook system** — Configure outbound webhooks per collection event (afterPublish, afterDelete, etc). Admin UI for managing webhook URLs. Retry with exponential backoff. Delivery log with status.

- [ ] **C3: Scheduled publishing** — Set a future `publishedAt` date on a post. Cron job (Bun setInterval or Bun.cron) checks and promotes scheduled posts. Admin shows "Scheduled for [date]" status.

- [ ] **C4: Content preview** — Generate a shareable preview link for draft content. Token-based access (no auth required for preview). Preview renders through the actual theme — WYSIWYG.

- [ ] **C5: Role-based field visibility** — Apply field-level access rules from the schema. Authors see content fields only, admins see everything. Editor view adapts based on user role. Content Mode vs Design Mode.

- [ ] **C6: Theme customizer** — Admin settings page reads `theme.config.ts` settings. Visual controls for colors, fonts, layout options. Save to DB, theme reads at render time. Live preview in an iframe.

- [ ] **C7: Email channel rendering** — MJML-based email renderer for Portable Text. Same content → email-safe HTML. Newsletter integration: select subscribers, send on publish. Email-specific blocks (CTA, subscriber teaser).

- [ ] **C8: WordPress import** — Parse WXR (WordPress eXtended RSS) export files. Convert HTML content to Portable Text. Map WordPress post types to collections. Import media assets. Migration CLI command: `not-a-cms import wordpress export.xml`.

---

## Phase D: Visual Site Builder (M2)

> Goal: Non-technical users can build pages visually.

- [ ] **D1: Component registry in admin** — Developers register components via defineComponent(). Admin shows available components in a palette. Drag components onto a canvas.

- [ ] **D2: Visual page builder** — Drag-and-drop page assembly from registered components. Reorder, configure props, preview. Saves as a Portable Text-like structure with component references.

- [ ] **D3: Visual CSS editor** — Webflow-style CSS controls. Flexbox/Grid visual toggles. Spacing, typography, colors. Generates real CSS classes. Class-based system for reuse.

- [ ] **D4: Free grid positioning** — Squarespace Fluid Engine-style independent block positioning. Dense grid, no cascade reflow. Overlapping elements.

- [ ] **D5: Responsive breakpoints** — Mobile, tablet, desktop breakpoint controls. Per-breakpoint overrides for layout and visibility. Preview at each breakpoint.

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
