# Dogfood: building the not-a-cms marketing site

Date: 2026-06-06
Author: Dik Rana

## Goal

Build a real company website (landing page + blog) for not-a-cms itself, as a
brand-new user would, end to end. Prove the product works in a realistic
scenario and produce an honest list of what it cannot yet do.

## Method

1. Scaffold a greenfield project with the CLI (`not-a-cms init`), as a new user
   would.
2. Boot the full dev stack (API :4321, admin :4322, public site :3000).
3. Authenticate through the real passwordless `/login` flow.
4. Author all content through the admin UI (Tiptap editor, Vault, SEO, tags,
   publish workflow), not through the API.
5. Verify rendering on the public site (:3000) and the RSS channel.
6. Record every gap as it surfaces.

Browser interaction uses agent-browser. Screenshots live in
`dogfood-output/marketing-site/`.

## Site content plan

Pages (`page` collection):

- Home / landing: hero, feature highlights, pricing teaser, CTA.
- About: who we are, the manifesto.
- Pricing: plan tiers.

Blog posts (`blog_post` collection):

- "Why we left WordPress behind"
- "Portable Text: why we store JSON, not HTML"
- "Real-time editing without losing your mind"

Breadth to exercise: cover-image upload via the Vault, SEO fields, tags, the
draft -> published workflow, version history, the Command Deck, the RSS feed,
search, and one publish automation (dry-run).

## Handling blockers

When a real user would be blocked, record it as a finding, then apply the
minimal workaround to keep building. The working site and the findings list are
both deliverables.

## Severity scale

- BLOCKER: a new user cannot proceed without outside knowledge or a code change.
- FRICTION: doable, but slow, confusing, or surprising.
- POLISH: minor rough edge.
- GAP: capability is simply absent.

---

## Findings

### F-001 (BLOCKER): scaffolded project pins `@not-a-cms/*` to unpublished npm versions

`packages/cli/src/commands/init.ts` writes a `package.json` whose dependencies
are `"@not-a-cms/core": "latest"` (and the other five packages). None of these
packages are published to npm, so a brand-new user running the documented
`bun install` immediately fails. Found by reading the scaffold template before
running it.

Workaround for this dogfood: point the scaffolded project's deps at the local
workspace packages so the site can actually run.

### F-002 (FRICTION): dev orchestrator health check is IPv6-ambiguous and orphans children on timeout

`scripts/dev.ts` waits on `http://localhost:4321/health`. On a machine where another
project's dev server is already bound to `[::1]:4321` (IPv6 localhost), `localhost`
resolves to `::1` first, so the health check hits the stranger's server, never sees a
200 for `/health`, times out, and calls `process.exit(1)`. Two issues:
1. It uses `localhost` rather than `127.0.0.1`, so it is sensitive to IPv6 squatters.
2. On timeout it exits without killing the API child it already spawned, orphaning a
   `bun --hot` process on the port.
Mostly environmental (a leftover dev server from another project), but a developer who
runs multiple local stacks can hit this. Worked around by running not-a-cms on free
ports (API 4331) with explicit `127.0.0.1`.

### F-003 (BLOCKER for the use case): there is no blog index / listing route

Default routes (`content-fetcher.ts`) are: `page` slug `home` at `/`, `blog_post` at
`/blog/:slug`, and `page` at `/:slug`. There is no route that lists blog posts. `/blog`
matches the `page /:slug` route, finds no page named "blog", and 302-redirects to `/404`
(confirmed: `GET /blog` -> 302). The ONLY place posts are listed is the homepage
fallback, and that fallback renders ONLY when no `home` page exists (see F-004). So a
real blog (a page that lists your posts) does not exist out of the box. To ship a blog
you must hand-build a listing page, and it cannot list dynamically without custom code.

### F-004 (FRICTION / surprising): creating a landing page silently removes the post listing

`index.astro` resolves `/` to the `page` with slug `home`. If that page exists, it
renders it and sets `posts = []`; the "Latest Posts" listing only appears when NO home
page exists. So the intuitive act of "make a homepage" silently turns off the only
built-in post listing, with no warning and nowhere else to see posts. Combined with
F-003, the landing page and the blog are mutually exclusive on the default theme.

### F-005 (BUG): homepage post listing links to the wrong URL (404)

In the `index.astro` fallback listing, each post links to `/${post.slug}` (route 3,
which is for `page`), but blog posts actually live at `/blog/${post.slug}` (route 2).
So every post link on the default homepage 404s. Off-by-a-prefix routing bug in the
shipped default theme.

### F-006 (GAP, headline feature missing): the visual site builder is not wired into the running admin

The README headlines a "visual site builder" and there is a full implementation:
`PageBuilder.tsx` (drag sections, components, breakpoints, style editor) and a
form-based `ContentEditor.tsx` that mounts it and renders every field type. But
`find_references` shows `ContentEditor` is referenced ONLY by its own definition and a
single unit test (`content-editor-render.test.tsx`); no Astro route imports it. The live
content routes (`/content/[collection]/new` and `/[id]`) mount the `Continuum` editor
instead. So the visual builder and the full field-form editor are effectively dead code
in the shipped admin: a user cannot reach them. This is the single biggest gap found.

### F-007 (BLOCKER on the dev stack): the bundled `page` collection cannot be edited in the admin

`Continuum` only edits a `richText` body field (`richTextFieldName` picks the first field
whose `type === "richText"`), plus three inline blocks (author, gallery, SEO). It renders
no other fields and no `pageLayout` builder. The bundled dev server
(`packages/server/src/dev.ts`) defines `page` with `layout: field.pageLayout()` and NO
richText field, so the editor shows "This collection has no rich text field" and offers
nothing to edit beyond the title. Pages are therefore unauthorable on the default dev
stack. Worse, this disagrees with the CLI scaffold, whose `page` collection uses
`body: field.richText()` (which IS editable). The product ships two contradictory `page`
definitions.

Workaround (to keep building through the admin UI): changed the dev stack `page`
collection to use `body: field.richText()` (matching the scaffold) and ran against a
fresh `dogfood.db` so the marketing site starts from a clean slate (the existing dev.db
holds prior QA junk: "Route Check Post", "QA Full Field Post", etc.).

### F-008 (FRICTION): Continuum exposes no editor for common fields (status set only via workflow buttons; no slug/tags/datetime/select inputs)

Beyond title + richText body + author/gallery/SEO blocks, the live editor surfaces no
inputs for the other declared fields (slug, tags, select/status as data, datetime,
generic relations). `status` is changed only through the Save / Review / Publish workflow
buttons; `slug` is auto-derived from the title with no visible override; `tags` and
`publishedAt` have no editor in this view. For a blog post with `tags` and a scheduled
`publishedAt`, there is no admin-UI path to set them.

### F-009 (BUG -> BLOCKER): slug auto-generation never runs on admin save, so admin-authored pages are unroutable

`field.slug({ from: "title" })` is declared on both `page` and `blog_post`, but saving
through the Continuum editor stores `slug: null` (verified: published a page titled
"The CMS that finally replaced WordPress", got `slug: null`). The "generate slug from
title" logic does not run in the admin save path. Because the public router matches on
slug (`page` "home" at `/`, `blog_post` at `/blog/:slug`), a null-slug document can never
be reached. Combined with F-008 (no slug field in the editor), there is NO admin-UI path
to give a document a URL. Every page and post here had its slug set with an authenticated
`PATCH /api/<collection>/:id`.

### F-010 (BUG, visible to every visitor): the default public theme renders with no typographic hierarchy

The shipped pages render every heading at the same size and weight as body text (see
`dogfood-output/marketing-site/10-public-home.png` and `13post.png`). Root cause:
`default.astro` applies `@tailwind base` (Preflight), which normalizes `h1`-`h6` to
inherit body size; the content is wrapped in `prose prose-gray` (in `index.astro` and
`[...slug].astro`) which would restore hierarchy, but `@tailwindcss/typography` is not
installed (`tailwind.config.mjs` has `plugins: []`, and it is absent from the renderer's
`package.json`). So `prose` is inert and the reset wins. The content is structurally
correct (Portable Text -> HTML, real `<h2>` tags), but the site looks unstyled and
broken for a real company page.

### F-011 (GAP): there is no site navigation; authored pages are unreachable by visitors

`default.astro` renders `<Header siteName={siteName} />` and never passes `navItems`, and
there is no config-driven menu. `Header.astro` only shows a nav when `navItems.length > 0`,
which never happens. So the public header shows only the site name. The About and Pricing
pages and the blog have no link from anywhere on the site (compounded by F-003, no blog
index). A visitor can only reach them by guessing URLs.

---

## What worked (the product is real)

- Passwordless magic-link login works end to end (once the API base URL and admin/site
  hosts are aligned; see the host note under Methodology).
- Authoring flows through the real pipeline: Tiptap editor -> `onChange` -> Portable Text
  -> Continuum save -> publish. Bodies persisted correctly as typed JSON blocks
  (paragraphs + `level: 2` headings).
- Public rendering works: `/` (landing), `/about`, `/pricing`, and all three
  `/blog/:slug` posts return 200 with correct titles and body HTML.
- RSS is well formed: CDATA titles, full HTML descriptions, `pubDate`, `guid`, channel
  metadata (`/rss.xml`).
- Full-text search works across collections (`?search=` returned the right posts/pages).
- REST security is sound: list/get expose only published content; POST/PATCH/DELETE
  require an authenticated session cookie (unauthenticated writes -> 401).
- Command Deck opens and navigates; Automations page loads with a clean, helpful empty
  state; the dashboard "desk" and content lists render.

## Methodology and caveats (not product bugs)

- This harness could not deliver synthetic keystrokes to the page (a plain `<textarea>`
  received nothing from `keyboard type`). `fill` and `execCommand insertText` both work,
  so all content was authored THROUGH the real editor (execCommand fires the same
  `beforeinput`/`input` events ProseMirror serializes), with headings applied via the
  toolbar H2 button (clicks work). Consequence: markdown shortcuts and the Command Deck's
  live search (React-controlled input) could not be exercised by keystroke.
- The greenfield run was blocked by F-001, so the site was built on the repo dev stack
  with two workarounds: `page` given a richText `body` (F-007) and a fresh `dogfood.db`.
- Fields with no editor (slug always; tags/excerpt for posts) were set via authenticated
  REST PATCH (F-008/F-009). Two diagnostic draft pages were deleted via authenticated
  DELETE to leave a clean site.
- Host note: the API/admin/site were run on `127.0.0.1` (API 4331) instead of `localhost`
  to avoid an unrelated dev server squatting on `[::1]:4321` (F-002) and to keep the
  auth-cookie host consistent (`BASE_URL=http://127.0.0.1:4331`).

---

## Result

A working not-a-cms marketing site was built and is live on the dev renderer: a landing
page at `/`, About and Pricing pages, and a three-post engineering blog, all authored
through the real admin editor and rendered as published content, with a valid RSS feed
and working full-text search. So the core engine (typed content -> Portable Text -> save
-> publish -> per-channel render) genuinely works.

But shipping a "proper company website" out of the box is currently not achievable by a
normal user, for four compounding reasons:

1. F-001: a new user cannot even `bun install` the scaffold (unpublished packages).
2. F-006 / F-007 / F-009: the page-authoring story is broken on the default stack: the
   visual builder is unreachable (dead code), the bundled `page` collection cannot be
   edited, and even after fixing that, authored pages get no slug and no URL without
   hand-editing the API.
3. F-003 / F-004 / F-011: there is no blog index, no navigation, and creating a homepage
   removes the only post listing, so a visitor cannot find the content.
4. F-010: the default theme renders content with no typographic hierarchy, so even a
   correctly authored page looks unstyled.

Top fixes, in priority order: publish the packages (or make the scaffold use workspace/
local deps) [F-001]; wire the visual builder or a generic field-form editor back into the
content routes, and run slug generation on save [F-006/F-009]; ship a blog index route and
config-driven navigation [F-003/F-011]; add `@tailwindcss/typography` (or real heading
styles) to the renderer [F-010]; reconcile the two contradictory `page` definitions
[F-007].

### Severity tally

- BLOCKER: F-001, F-003 (use case), F-007 (dev stack), F-009
- BUG: F-005, F-010 (also a visitor-facing gap)
- GAP: F-006, F-011
- FRICTION: F-002, F-004, F-008

### Evidence

Screenshots in `dogfood-output/marketing-site/`: `01-login`, `02-magic-link-sent`,
`03-admin-dashboard`, `10-public-home`, `11about`, `12pricing`, `13post`, `20admin-posts`,
`21command-deck`, `22command-deck-search`, `23automations`.

---

## Resolution (2026-06-07)

All eleven findings were addressed on branch `fix/dogfood-gaps`, TDD where there was
testable logic, with the full suite green (11/11 turbo tasks) and the integrated stack
re-verified through the real `bun run dev`. Before/after screenshots: `10-public-home.png`
(flat, no nav) vs `50final-home.png` (hero hierarchy + nav), and `51final-blog.png` (the
new blog index).

| Finding | Resolution |
|---|---|
| F-001 | Scaffold pins `@not-a-cms/*` to the CLI version, not `latest`. Residual: packages must be published to npm for `bun install` to resolve (a release step, not a code change). |
| F-002 | Dev orchestrator (root script and CLI `dev`) uses 127.0.0.1 health checks, binds astro with `--host 127.0.0.1`, and kills spawned children on a startup timeout. |
| F-003 | New `/blog` index route lists published posts. |
| F-004 | Resolved by F-003: posts are always listed at `/blog`, independent of the homepage. |
| F-005 | `documentPath()` (tested) builds correct `/blog/:slug` URLs; homepage listing fixed. |
| F-006 | Removed the unreachable visual builder (PageBuilder/ContentEditor, ~2.5k LOC); kept the one used helper; README no longer advertises it as shipped. |
| F-007 | Bundled `page` collection uses a richText body, matching the scaffold and editable in Continuum. |
| F-008 | `FieldsPanel` in Continuum edits slug, tags, excerpt, datetime, select, relation, and media. |
| F-009 | `applyGeneratedSlugs()` runs on create/update: an empty slug is filled from its source field; admin-authored docs now get URLs. |
| F-010 | Added `@tailwindcss/typography`; headings render with hierarchy (36/24 vs 16px). |
| F-011 | `buildNav()` auto-builds nav from published pages + a Blog link, wired into the layout. |
