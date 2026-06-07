# Dogfood Round 2: making the marketing site a proper website

Date: 2026-06-07
Author: Dik Rana

## Goal

Round 1 (`2026-06-06-marketing-site-dogfood.md`) built a working not-a-cms
marketing site and fixed all 11 findings (F-001..F-011). The site now functions:
landing `/`, `/about`, `/pricing`, a `/blog` index plus three posts, working
navigation, and real typographic hierarchy.

Round 2 asks the next question: can a real user take that functional site and make
it a *proper* company website? That means three things the handoff called out:

1. **Layouts**: richer page composition (hero, feature sections, columns, cards, CTAs).
2. **Styling**: push beyond the default theme toward a real brand identity.
3. **Images**: hero and cover imagery, wired through the media library.

Method: boot the real dev stack, log in as the existing admin through the real
passwordless flow, and try to do each of the three things *through the product*.
Record every wall as a finding with evidence.

## Setup

- Stack: `bun scripts/dev.ts` on alt ports (API 4341, admin 4342, renderer 3001),
  `DATABASE_URL=dogfood.db` (the Round 1 seeded marketing content), `E2E_TEST_AUTH=1`.
- Auth: magic-link login as `founder@not-a-cms.dev` (the seeded admin; see the role
  note in Side observations).
- Evidence: `dogfood-output/round2/screenshots/` and `dogfood-output/round2/videos/`.

## Severity scale (same as Round 1)

- BLOCKER: a user cannot proceed without a code change.
- BUG: it does the wrong thing.
- GAP: the capability is simply absent.
- FRICTION: doable, but slow, confusing, or surprising.
- POLISH: minor rough edge.

---

## Findings

### F-012 (GAP, headline): there is no way to author a multi-section marketing layout

Every page and post is a single `richText` body, and both `index.astro` and
`[...slug].astro` render it as one `<article class="prose prose-gray">` column. There
is no hero band, no feature columns, no pricing cards, no CTA button: the layout
vocabulary of a landing page does not exist.

This is the most visible gap. The seeded "Pricing" page is the clearest example: the
three tiers (Community / Team / Enterprise) render as plain `h2` + paragraph stacked
vertically, where a real pricing page needs three cards side by side with a prominent
price and a button (`baseline-pricing.png`). The homepage is a wall of prose, not a
hero + sections (`baseline-home.png`, `baseline-home-2.png`).

What makes this sharp: the *rendering* half already exists but is orphaned. The
renderer ships `renderPageLayout()` with `hero`, `text_block`, `image_block`, and
`cta` component renderers (`runtime/document-renderer.ts`), and core still ships
`field.pageLayout()` (`core/src/schema/field.ts:178`). But:

- No shipped collection declares a `layout`/`pageLayout` field (Round 1 F-007 changed
  `page` to a richText body), so `document.layout` is always undefined and the
  `isPageLayout` branch in every page template is dead.
- The editor that authored those layouts (the visual builder) was deleted in Round 1
  F-006 and never replaced.

So rich layouts are renderable but unauthorable. The middle of the pipeline (an
editor for sections) is missing. This is the inverse of F-006: there the builder
existed with nothing wired to it; here the renderer exists with no builder to feed it.

### F-013 (GAP): the body editor can only insert six block types

The Continuum body toolbar exposes exactly: **B, I, `</>` (code), link, H1, H2**
(`post-editor.png`). That is the entire authoring vocabulary for a body.

Meanwhile the renderer's Portable Text serializer (`runtime/portable-text-html.ts`)
handles `image`, `callout`, `blockquote`, `bulletList`, `orderedList`, `codeBlock`,
`divider`, `gallery`, and `author` blocks. None of those except code have a toolbar
control. A user cannot insert an inline image, a bulleted list, a blockquote, or a
callout into a blog post body through the UI. The renderer is ready for richer content
than the editor can produce.

### F-014 (FRICTION/GAP): the media field is a bare text box, with no asset picker

The `media` field ("Cover Image") renders as a plain text input whose placeholder is
literally **"Asset id"** (`cover-image-field.png`). To set a cover image, a user must
already know a media asset's UUID and type it by hand. Clicking the field opens no
picker, no Vault browser, no upload, and shows no thumbnail or preview.

This is jarring because the Vault itself is genuinely good (`media-vault.png`): upload,
tags, folders, type clustering, and per-asset usage tracking all work. But it is
completely disconnected from authoring. There is no "choose from Vault" or "upload"
affordance anywhere in the editor. Verified the backend side is sound: typing a valid
asset id and saving persists it (`coverImage` stored as `cover_image_id`), and the
Vault correctly records the reference (`/api/media/<id>/usage` returns
`count: 1, field: "coverImage"`). The gap is purely the missing picker UI.

### F-015 (BUG, visitor-facing): a cover image, even when set, is never rendered

`coverImage` is not referenced anywhere in the renderer (`grep` across
`packages/renderer/src` returns nothing). The blog index renders title + excerpt +
date only (`blog/index.astro`); the post template renders title + date + body only
(`[...slug].astro`). So a cover image is dead data for the default theme.

Verified end to end: uploaded an image to the Vault (id `a0d57b8d...`), set it as the
cover of "Why we left WordPress behind", confirmed it persisted, that the file endpoint
serves it (`200 image/svg+xml`), and that the Vault marks it "used in 1 place". The
public post page and the blog index then contained **zero `<img>` elements**
(`document.querySelectorAll('main img')` returned `[]` on both). The author does
everything right and the image silently never appears.

### F-016 (BUG, serious): clicking "Save" on a published document unpublishes it

The editor offers three workflow buttons: **Save / Review / publish**. On a *published*
document, clicking **Save** silently reverts it to **draft**, which removes it from the
public site (the page starts returning a 302 to `/404`).

Reproduced three times, including a clean repro with no content edits at all
(`videos/issue-save-unpublishes-repro.webm`, plus `issue-save-step1..step4`):

1. `GET /blog/portable-text-not-html` returns 200 (post is live).
2. Open the post in the editor (status PUBLISHED).
3. Click **Save** (no other change).
4. Status is now `draft`; `GET /blog/portable-text-not-html` returns 302 to `/404`,
   and the post disappears from the `/blog` index.

Root cause: the "Save" button maps to the `save_draft` workflow action, and
`ALLOWED_FROM.save_draft` (`core/src/content/workflow.ts`) explicitly includes
`"published"` with a target status of `draft`. So unpublishing on save is by design in
the workflow table, but it is a dangerous default: the single most natural action an
editor takes on a live post (tweak it, hit Save) takes the post offline with no
warning and no separate "published version stays live" concept. Editing a live page to
add the cover image from F-014 would silently 404 the page.

(After capturing evidence, all three posts were transitioned back to `published` and
the test cover image was removed, so `dogfood.db` is left as it started.)

### F-017 (GAP): the theme system is exported and scaffolded, but the renderer never uses it

`defineTheme()` is a public API (`renderer/src/theme/define-theme.ts`, re-exported from
the package index), and the CLI scaffold generates a `starterTheme` with it
(`cli/src/commands/init.ts:162`). A new user would reasonably edit that theme to set
brand colors, fonts, and component overrides.

It does nothing. The renderer never loads or consumes a theme: the layout hardcodes
`bg-white text-gray-900`, `siteName = "not-a-cms"`, and `prose prose-gray`; pages
hardcode their classes. `defineTheme` is referenced only by its own test, the index
re-export, and the scaffold. So the documented way to brand your site has zero effect
on the rendered output.

Compounding it, there is no design layer to begin with: `tailwind.config.mjs` has an
empty `theme: { extend: {} }`, no custom font is loaded in the layout `<head>` (the
site uses the system sans stack), and the only "accent" is Tailwind's stock
`blue-600` hover and a hardcoded `#2563eb` in the orphaned CTA renderer. There is no
supported path from "functional default theme" to "our brand".

### F-018 (POLISH): static pages render an article-style date

`[...slug].astro` renders `created_at` as a formatted date under the title for *every*
document, including pages. So the About and Pricing pages show "June 6, 2026" as if
they were blog posts (`baseline-pricing.png`). A standalone marketing page should not
carry a published-on date. Page and post share one template with no notion of which
fields are appropriate for which.

---

## Side observations (not headline findings)

- **New users default to `viewer` with no write access and no visible way up.** Logging
  in with a fresh email (`dik@not-a-cms.dev`) produced a user that got 403 Forbidden on
  media upload; the admin (`founder@not-a-cms.dev`) exists only because it was seeded
  into `_user_roles`. How the *first* user of a fresh self-hosted install becomes admin
  (and how a viewer gets elevated) is not exercised by any UI here. Worth a dedicated
  onboarding/roles dogfood; may be intentional (invite-based), but it is invisible.
- **Orphaned renderer code (echoes F-006).** `defaults/blocks/*.astro` and
  `defaults/components/Image.astro` are imported nowhere (the live path is the HTML
  string serializer `portable-text-html.ts`), and the `isPageLayout` branch plus
  `renderPageLayout`/`defaultRenderers` are unreachable now that no collection has a
  layout field. Dead-code cleanup candidates.
- **Vault holds prior QA junk.** `dogfood.db`'s Vault still contains Round 0/1 QA assets
  (`live-tagged.svg`, `live-untagged.svg`, a QA screenshot), not marketing imagery.
- **Tooling note (not a product issue):** the handoff suggested generating imagery with
  "codex imagegen", but this `codex` CLI has no image-generation subcommand (its `-i`
  flag only *attaches* images to a prompt). For the media test I uploaded a
  hand-authored SVG hero instead. Real hero/cover art generation needs a different tool.

---

## Result

The Round 1 engine still works: auth, authoring, publish, per-channel render, RSS, and
search are all live, and the Vault and the workflow backend are genuinely strong (media
references and usage tracking are correct; the editor is pleasant). But pushing the
functional site to a *proper* website hits a consistent wall: **the product can render
more than it can author, and cannot brand what it renders.**

The three Round 2 goals each fail for a concrete reason:

1. **Layouts**: impossible. Only a single prose column is authorable (F-012); the body
   editor can't even insert an inline image or list (F-013). The hero/columns/CTA
   renderer exists but has no editor to feed it.
2. **Images**: blocked end to end. No asset picker to attach one (F-014), and even a
   correctly-attached cover image is never displayed (F-015).
3. **Styling**: no supported path. The theme system the scaffold hands you is inert
   (F-017), and there is no design layer (fonts, palette, tokens) to begin with.

And along the way the most serious bug in this round surfaced: **Save silently
unpublishes live content** (F-016).

### Top fixes, in priority order

1. **F-016** first: it is a data-visibility bug that bites existing, working sites.
   "Save" on a published document must keep it published (save a working draft without
   changing public status), or at minimum warn before unpublishing.
2. **F-015**: render `coverImage` on the post page and as a blog-index thumbnail. Small
   change, immediate visual payoff, unblocks the entire image story's render half.
3. **F-014**: give the `media` field a real picker (browse Vault + upload + preview).
   The Vault already exists; this is a connector, not a new feature.
4. **F-012 / F-013**: the big one. Decide how marketing layouts get authored: either
   reintroduce a section/block builder feeding `field.pageLayout()` (the renderer is
   ready), or expand the richText editor with image/list/quote/callout/embed blocks so
   a single body can carry a richer page. Pick one deliberately; today neither exists.
5. **F-017**: make the renderer actually consume a theme (fonts, palette, component
   overrides), and ship a real default design layer instead of stock Tailmind defaults.
6. **F-018**: stop rendering an article date on standalone pages.

### Severity tally

- BUG: F-015 (visitor-facing), F-016 (serious)
- GAP: F-012 (headline), F-013, F-017
- FRICTION/GAP: F-014
- POLISH: F-018

### Evidence

`dogfood-output/round2/screenshots/`: `baseline-home`, `baseline-home-2`,
`baseline-blog`, `baseline-pricing`, `baseline-post` (the functional Round 1 site);
`post-editor`, `post-editor-fields`, `cover-image-field` (the editor and the
"Asset id" media field); `media-vault`, `vault-after-upload` (the Vault);
`issue-save-step1..step4` (the Save-unpublishes repro).
`dogfood-output/round2/videos/issue-save-unpublishes-repro.webm` (the F-016 repro).

---

## Resolution (2026-06-07)

All seven findings were fixed on branch `fix/dogfood-round2`, TDD where there was
testable logic, with the full monorepo suite green (11/11 turbo tasks) and the
integrated stack re-verified through the real dev orchestrator. After/before:
`fix-landing-hero.png` + `fix-landing-features.png` (a real hero + CTA + feature-grid
landing page) vs `baseline-home.png` (the flat prose wall); `fix-theme-home.png` (the
warm, serif-led brand) vs the stock-Tailwind baseline; `fix-media-picker-grid.png` (the
Vault picker) vs `cover-image-field.png` (the "Asset id" box); `fix-post-cover.png`
(a rendered cover hero).

| Finding | Resolution |
|---|---|
| F-012 | The editor's block system gains authorable `hero`, `cta`, and `featureGrid` section blocks (slash commands + NodeView forms) that round-trip through Portable Text and render as styled marketing sections. A hero-led page suppresses its duplicate auto-title. The homepage is now a real landing page built entirely from these blocks. |
| F-013 | Added a `Callout` slash command (the node was registered but uninsertable) and an inline `Image` block with a Vault picker. The renderer already supported these Portable Text blocks; verified an inline image renders on the public site. |
| F-014 | The `media` field is now a real Vault picker (thumbnail preview, "Choose from Vault", inline upload, clear) instead of a bare "Asset id" text box, reusing the existing media library. |
| F-015 | `mediaUrl()` resolves a media field to an absolute public URL; the cover image now renders as a hero on the post page and a thumbnail on the blog index. Verified the previously-dropped cover now appears. |
| F-016 | "Save" (the `save_draft` workflow action) no longer transitions a published document to draft. Saving edits to a live document preserves its public status; only the explicit Review / Publish / Archive actions change it. Guarded by a unit test. |
| F-017 | The renderer ships a real, theme-driven design layer: `defaultTheme` (warm paper palette, single accent, Fraunces/Inter pairing) is emitted as `:root` CSS variables via `themeToCssVariables()` and applied across the layout, typography plugin, and chrome. Editing the theme now rebrands the site. |
| F-018 | The shared page/post template renders a published date only for the `blog_post` collection, so evergreen pages (About, Pricing) no longer carry an article date. |

Residual / deferred (from the side observations, not fixed here):

- First-run roles: a fresh magic-link user is still a `viewer` with no in-UI path to
  elevation; the admin is seeded in `_user_roles`. Worth a dedicated onboarding pass.
- The `gallery` block still fetches media from the admin origin (`listMediaItems("")`)
  rather than the configured API base, so its picker is unreliable cross-origin; the
  new image block uses `getAdminApiBase()` and should be the template for fixing it.
- Orphaned renderer code (`defaults/blocks/*.astro`, the `isPageLayout` /
  `renderPageLayout` path) remains; the section-block approach in F-012 supersedes the
  old layout-field path, so that dead code can be removed in a cleanup pass.
