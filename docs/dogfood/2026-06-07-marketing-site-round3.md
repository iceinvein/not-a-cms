# Dogfood Round 3: beautiful, dynamic company sites

Date: 2026-06-07
Author: Dik Rana

## Goal

Rounds 1 and 2 took the not-a-cms marketing site from broken to functional to
"proper" (section blocks, a theme-driven design layer, a Vault media picker, cover
images). Round 3 raises the bar to "a company could ship this," and tests generality by
attempting two contrasting sites on one engine:

1. **not-a-cms** (warm, serif, light, editorial): refine the existing seeded site.
2. **Atelier** (a creative studio: dark, bold, imagery-led, a portfolio): build from
   scratch.

Both are real `loadConfig` projects under `dogfood-sites/` (own config, theme, and
database) rendered by the same engine. "Dynamic" means both visual/motion richness and
genuinely data-driven content (collection-driven sections, related posts, config-driven
chrome). This document records the discovery pass: every wall to that bar, captured
through the real product, with evidence.

## Setup

- Foundation (Plan 0, branch `fix/dogfood-round3`): both sites promoted to real
  `loadConfig` projects; the dev orchestrator gained a `--site=<name>` selector
  (`scripts/dev-site.ts`) that sets `CONFIG_PATH`; the server dev entry honors
  `CONFIG_PATH` (`resolveConfigLoadOptions`); the real config path gained an
  `E2E_TEST_AUTH` test-auth seam so dogfood login works (`createServerConfigFromCMSConfig`).
- Stack: `E2E_TEST_AUTH=1 bun scripts/dev.ts --site=<not-a-cms|studio> --port=4341
  --admin-port=4342 --renderer-port=3001`.
- not-a-cms runs on the existing seeded `dogfood.db`; Atelier on a fresh `studio.db`.
- Evidence: `dogfood-output/round3/screenshots/` (the `before-*` set).

## Foundation results (verified)

- **Both sites boot on the real config path.** not-a-cms via `--site=not-a-cms` serves
  all existing content unchanged (3 posts, 3 pages, blog index): the config promotion is
  a clean regression. Atelier via `--site=studio` loads its `project`/`blog_post`/`page`
  schema and serves (`/api/project` 200, empty).
- **Login works on the real config path.** The test-auth seam captured and returned a
  magic link for both sites; login established an admin session
  (`before-notacms-admin.png`).
- **First-run roles resolved for fresh installs.** On the empty `studio.db`, the first
  magic-link user (`founder@atelier.dev`) was auto-promoted to admin
  (`GET /api/media/context` returned `{"role":"admin"}`). This is the inverse of the
  round-2 side observation: a brand-new install's first user does become admin; the
  round-2 "stuck as viewer" only happened because `dogfood.db` already had an admin.

## Severity scale (same as rounds 1-2)

- BLOCKER: a user cannot proceed without a code change.
- BUG: it does the wrong thing.
- GAP: the capability is simply absent.
- FRICTION: doable, but slow, confusing, or surprising.
- POLISH: minor rough edge.

---

## Findings

### F-019 (BLOCKER, headline): a per-project site is not brandable; the chrome is hardcoded to "not-a-cms"

Atelier is configured with `site.name: "Atelier"` and `theme: atelier-studio`, yet its
public site renders the wordmark **"not-a-cms"**, the page title **"Home — not-a-cms"**,
and the footer **"© 2026 not-a-cms. Powered by not-a-cms."** (`before-studio-home.png`).
A brand-new company spinning up not-a-cms gets a site branded as, and crediting,
not-a-cms, with no supported way to make it theirs.

What is sharp here is the split: `config.theme` **does** reach the renderer
(`GET /api/_theme` returns Atelier's `atelier-studio` theme), but `site.name`, the
navigation, and the footer do **not**. The layout hardcodes `siteName = "not-a-cms"`
(`defaults/layouts/default.astro`), builds nav from published `page` docs, and the
footer string is literal. There is no endpoint that serves the site identity. This is
the single most important gap for "build a site for your company."

### F-020 (GAP, headline): no collection-driven section; a page cannot show live content

There is no way to place live, query-driven content on a marketing page. The not-a-cms
home cannot show "latest 3 posts"; Atelier cannot show a portfolio grid of `project`
documents. The editor block set (`packages/admin/.../continuum/blocks/`) is
`hero, cta, featureGrid, gallery, image, seo, author`: every one renders static
authored content. No `collectionList`/`featuredPosts`/`relatedPosts` block exists in
`editor`, `renderer`, or `admin`. This is the core "dynamic" gap and it blocks the
studio's portfolio entirely.

### F-021 (GAP): the section vocabulary is too thin for a real marketing or studio page

Authorable sections are only `hero`, `cta`, `featureGrid` (plus inline `image`/`gallery`
and the `callout` from round 2). There are no `stats`, `logoCloud`, `testimonial`,
`faq`, `pricingCards`, or `splitMedia` sections. The clearest casualty is **Pricing**,
which still renders as flat stacked prose: three `h2 + paragraph` tiers
(Community / Team / Enterprise), not three cards with a prominent price and a button
(`before-notacms-pricing.png`). The exact round-2 F-012 complaint persists for pricing.

### F-022 (BUG/GAP): the theme cannot express a dark or bold brand

`config.theme` only meaningfully carries `colors.accent` today, and overriding accent
alone leaves the warm-paper light palette intact. There are no `surface`/`inverse`
tokens for dark bands, no swappable display/body font pairing, and no scale tokens
(radius, container width). Atelier's intended dark studio identity is unreachable: it
renders in not-a-cms's exact light theme (`before-studio-home.png`). The theme system
spans one brand, not a range.

### F-023 (BUG, visitor-facing): the hero CTA renders as an isolated band, and feature cards are cramped

On the not-a-cms home (`before-notacms-home.png`), the "Read the blog" CTA renders in
its own full-width band floating below the hero, centered in isolation, rather than as
part of the hero composition. The "Why teams switch" feature grid renders as four small
cards with tiny body text and a left-aligned heading, with weak vertical rhythm (a large
empty gap above, cramped cards below). The page reads as stacked blocks, not a composed
landing page.

### F-024 (GAP): navigation and footer are not real site chrome

The header is a flat list auto-built from published pages (About / Pricing / Blog), with
no logo mark, no primary CTA button, and no mobile menu. The footer is a single
hardcoded line. There is no way to express ordered links, external links, a header CTA,
footer columns, or social links: the vocabulary of a real company header/footer is
absent.

### F-025 (POLISH/GAP): there is no motion anywhere

The rendered sites have zero motion: no scroll-reveal, no hover transitions beyond a
color change, no state transitions. For a site meant to feel "beautiful" and alive, the
total absence of considered motion reads as static and templated.

### F-026 (GAP): blog posts are dead-ends; no related content

A post page renders title, date, cover, and body, then stops. There is no "related
posts" or "more from the blog" affordance, so every post is a navigational dead-end. The
data exists (posts carry `tags`) but nothing surfaces it.

### F-027 (POLISH): cover imagery is placeholder SVGs with baked-in text, inconsistently shown

Cover images are dark SVG placeholders with the "not-a-cms" wordmark baked into the
image (`before-notacms-blog.png`). On the blog index the first post shows a large cover
while the others show none, so the treatment is inconsistent. There is no real imagery
story, which matters most for the studio, whose entire value is visual.

### F-028 (FRICTION, install path): standing up a real project exposed missing scaffold

Running a site on the real `loadConfig` path (which the dev stack had always bypassed via
its sample config) required hand-adding `dogfood-sites/*` to the Bun workspace and a
per-site `package.json` so the config could resolve `@not-a-cms/core`, plus a way to
select which site to boot and a test-auth seam on the real path. These were fixed in the
Plan 0 foundation, but they show that a real `not-a-cms init` scaffold (workspace wiring,
boot command, first-run admin) is not yet a smooth path. Worth a dedicated onboarding
pass later.

### F-029 (GAP): full-bleed is constrained by the layout

`default.astro`'s `<main>` is `max-w-4xl mx-auto`, so section bands cannot truly go
edge-to-edge with impact; heroes and color bands are boxed into the prose column width.
The band/container split the renderer needs (full-width band, centered constrained
content) is not in place.

---

## Result

The foundation works: two companies, two configs, two databases, one engine, both
booting on the real config path with working auth and correct content. But pushing to
"a company could ship this" hits a consistent wall: **the product renders one brand's
site well, and cannot yet be made into a different company's brand, nor compose a
dynamic, richly-sectioned page.** The studio test is the proof: a fresh install renders
as "not-a-cms", in not-a-cms's theme, crediting not-a-cms, with no portfolio and no way
to brand or compose its way out.

## Top fixes, mapped to the round-3 waves

The discovery **confirms all seven proposed Wave 1 blocks are needed** (no trim): both
target sites use the set. Mapping:

1. **Wave 1 (section blocks + collectionList)** closes F-020 and F-021. Confirmed block
   set: `stats`, `logoCloud`, `testimonial`, `faq`, `pricingCards`, `splitMedia`, and
   the dynamic `collectionList`. not-a-cms uses hero/stats/logoCloud/featureGrid/
   testimonial/pricingCards/faq/collectionList/cta; Atelier uses hero/collectionList
   (portfolio)/splitMedia/testimonial/stats/cta. `logoCloud` is the lowest-priority of
   the set and the first candidate to cut if scope demands.
2. **Wave 2 (chrome + dynamic data)** closes F-019 (the headline), F-024, and F-026: a
   `GET /api/_site` serving `{siteName, nav, footer, theme}` consumed by the layout;
   config-driven nav (logo, links, CTA) and footer (columns, social); related posts by
   tag overlap.
3. **Wave 3 (visual + motion)** closes F-023, F-025, F-029, and the responsive half of
   F-024: full-width `<main>` with a band/container split, hero composition fix,
   CSS-first scroll-reveal and hover motion (reduced-motion honored), mobile nav and
   grid reflow, tightened rhythm.
4. **Wave 4 (theme tokens + authoring)** closes F-022 and F-027: extend theme tokens
   (`surface`/`inverse`, font pairing, radius, container width) and `themeToCssVariables`
   so Atelier's dark brand drops out of config; then author both sites with hybrid
   imagery (real photos where available, gradient/duotone fallback).

Priority order for execution: Wave 1 (unblocks composition) -> Wave 2 (F-019 is the
headline, but depends on nothing in Wave 1) -> Wave 3 -> Wave 4. F-019 and F-020 are the
two findings that most define whether the round succeeds.

### Severity tally

- BLOCKER: F-019 (branding).
- BUG: F-022 (dark brand), F-023 (hero CTA / cards).
- GAP: F-020 (collectionList, headline), F-021 (blocks), F-024 (chrome), F-026
  (related), F-029 (full-bleed).
- FRICTION: F-028 (install path; foundation-resolved).
- POLISH: F-025 (motion), F-027 (imagery).

### Evidence

`dogfood-output/round3/screenshots/`: `before-notacms-home`, `before-notacms-blog`,
`before-notacms-pricing`, `before-notacms-post`, `before-notacms-admin`,
`before-admin-editor` (the minimal B/I/code/link/H1/H2 body toolbar),
`before-studio-home` (the "not-a-cms"-branded empty studio), `before-studio-admin`.

---

## Resolution (2026-06-07)

All findings were addressed on branch `fix/dogfood-round3`, executed in waves with TDD
where there was logic, two-stage review per task, and the full suite green
(`turbo run test` + `turbo run typecheck` 11/11) before every commit. Live-verified
through the real dev orchestrator on both sites. After evidence:
`after-w2-studio-home` (Atelier branded, no "Powered by"), `after-w4-studio-dark-empty`
+ `after-w4-studio-home` + `after-w4-studio-home-scrolled` (the dark grotesk studio with
a live portfolio grid), `after-w4-notacms-pricing` (real pricing cards),
`after-w4-notacms-home`, `after-w3-home-mobile`/`after-w3-mobile-fixed` (responsive nav).

**Foundation (Plan 0).** Both sites became real `loadConfig` projects under
`dogfood-sites/` rendered by one engine; the dev orchestrator gained a `--site=<name>`
selector (`CONFIG_PATH`), the server dev entry honors it, and the real config path
gained an `E2E_TEST_AUTH` test-auth seam so dogfood login works. First-run auto-admin
verified on a fresh `studio.db`.

| Finding | Resolution |
|---|---|
| F-019 (branding BLOCKER) | New `GET /api/_site` serves `{siteName, nav, footer, theme}`; the renderer brands from it. Config-driven nav (logo, links, CTA) and footer (tagline, columns, social, legal). Verified live: Atelier renders its own wordmark/title/footer with no "Powered by not-a-cms". |
| F-020 (collectionList, headline) | New `collectionList` block resolves live published docs at render time (async pre-pass in `renderDocumentContent` injects fetched data into the serializer). Powers the studio portfolio grid and the homepage "From the blog". |
| F-021 (thin block set) | Added `stats`, `logoCloud`, `testimonial`, `faq`, `pricingCards`, `splitMedia` section blocks (NodeView + slash command + Portable Text round-trip + renderer band). Pricing now renders as real cards (verified). |
| F-022 (dark brand) | The theme token set already spanned the needed colors/fonts; the studio config now declares a full dark palette + Space Grotesk/Inter pairing, proving light to dark from config alone with no renderer changes. |
| F-023 (hero CTA / cramped cards) | Tightened section rhythm and card generosity (consistent band padding, larger feature cards, comfortable measure). The isolated-CTA composition was resolved by re-authoring the homepage from the richer block set. |
| F-024 (nav/footer chrome) | Real config-driven header (wordmark + links + CTA) and multi-column footer, plus a mobile disclosure nav (accessible, `aria-expanded`); live-verified at 390px (a cascade fix was caught and applied so the desktop nav hides under Tailwind's `.flex`). |
| F-025 (no motion) | CSS-first scroll-reveal via a dependency-free IntersectionObserver, plus hover/focus transitions and card lift; fully gated on `prefers-reduced-motion` and `html.js-reveal` so content is never hidden without JS or for reduced-motion users. |
| F-026 (dead-end posts) | `relatedPosts` (shared-tag overlap then recency, recency fallback) renders a "More from the blog" band on blog posts only. |
| F-027 (imagery) | Partially addressed: the dark theme + bold typography carry the studio without photos (no image-gen tool available; `mediaUrl` mangles data-URIs). Real photographic imagery remains a deferral. |
| F-028 (install friction) | Resolved in the foundation: workspace wiring, the `--site` boot selector, and the test-auth seam. A real `not-a-cms init` scaffold remains a future onboarding pass. |
| F-029 (full-bleed) | Section bands break out to full width via the `nac-band` 100vw technique with `overflow-x: hidden`; rhythm tightened. (A full-width-`main` refactor was judged unnecessary given the working breakout.) |

### New finding (discovered during Wave 4) — RESOLVED

**F-030 (GAP): custom collections have no public route.** The renderer's `DEFAULT_ROUTES`
mapped only `page` and `blog_post`, so the studio's `project` collection had no
detail-page route: `collectionList` portfolio cards linked to `#` and case-study pages
were unreachable.

Resolved: `config.routes` is now served via `/api/_site`, merged with the renderer
defaults (`mergeRoutes`, config routes first), and threaded through the page fetchers,
`documentPath`, and the `collectionList` serializer (`RenderOpts.routes`). The studio
config declares `routes: [{ collection: "project", path: "/work/:slug" }]`, and a "Work"
index page lists the projects. Verified live: portfolio cards link to `/work/<slug>`,
`/work/<slug>` returns 200 and renders the project's case study in the dark theme
(`after-f030-project-detail`, `after-f030-work-index`). `blog_post`/`page` behavior is
unchanged and the change is backward compatible (sites without `config.routes` get the
defaults). A real "dynamic website for your company" can now define custom content types
with their own public pages.

### Result

The product can now build two visually distinct, professional, dynamic company sites on
one engine: not-a-cms (warm, serif, light) with a richer composed homepage and real
pricing cards, and Atelier (dark, grotesk, bold) with a live portfolio grid, both fully
branded from config. The headline blockers (F-019 branding, F-020 dynamic content) are
closed. The remaining gap to a complete studio is custom-collection routing (F-030).
