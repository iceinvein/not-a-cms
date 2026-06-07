# Example sites

Two complete, contrasting example sites, each a real `loadConfig` project (its own
`not-a-cms.config.ts`, theme, and database) rendered by the one shared engine. They are
loadable examples: pick one with the dev orchestrator's `--site=<name>` selector, which
maps to `dogfood-sites/<name>/not-a-cms.config.ts` and the database named in that config.

## not-a-cms (warm, serif, light)

The product's own marketing site. Warm-paper palette, Fraunces/Inter pairing.

- Collections: `blog_post`, `author`, `page`.
- Pages: a composed homepage (hero, stats, feature grid, testimonial, a live
  "From the blog" list, CTA), `about`, and a `pricing` page rendered as real pricing
  cards plus an FAQ.
- A blog with three posts and tag-based "More from the blog" related links.
- Database: `dogfood.db` (already seeded).

```bash
bun scripts/dev.ts --site=not-a-cms
```

Re-apply the enriched home + pricing pages at any time:

```bash
E2E_TEST_AUTH=1 bun scripts/dev.ts --site=not-a-cms   # in one shell
bun scripts/seed-notacms.ts                            # in another
```

## studio / Atelier (dark, grotesk, bold)

A fictional creative studio, the deliberate inverse of not-a-cms: near-black palette,
Space Grotesk display, an acid-lime accent. Proves the theme tokens span light to dark
from config alone.

- Collections: `project` (a portfolio item that carries its own case study), `blog_post`
  (a Journal), `page`.
- A dark landing composed of a hero, a stats band, a live portfolio grid
  (`collectionList` over `project`), a services grid, a testimonial, and a CTA.
- Custom routing: `routes: [{ collection: "project", path: "/work/:slug" }]`, so the
  portfolio cards link to real case-study pages at `/work/<slug>`, with a `/work` index.
- Database: `studio.db` (gitignored; create it by seeding).

```bash
# Boot (alt ports so it does not clash with the marketing site)
E2E_TEST_AUTH=1 bun scripts/dev.ts --site=studio --port=4341 --admin-port=4342 --renderer-port=3001
# Then, in another shell, seed the content:
bun scripts/seed-studio.ts
```

The first magic-link login on a fresh `studio.db` is auto-promoted to admin.

## How site selection works

`scripts/dev-site.ts` resolves `--site=<name>` (or the `SITE` env var) to
`dogfood-sites/<name>/not-a-cms.config.ts` and sets `CONFIG_PATH` for the API server;
the server loads that config via the standard `loadConfig` path. Adding a third example
is just a new `dogfood-sites/<name>/` directory with its own config, theme, and
`database.url`.
