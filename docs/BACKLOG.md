# Backlog

Tracked, open work for not-a-cms. This is the canonical list; the per-feature
specs and plans (when present) live in `docs/superpowers/` (local-only, gitignored).

**Status legend:** `next` (queued for the next cycle), `later` (agreed but unscheduled),
`idea` (captured, not yet committed to).

## Features

### sqlite-vec embedding search
**Status:** later
Replace NL Ask's in-memory cosine similarity (`packages/core/src/content/embeddings.ts`,
which loads all vectors and sorts in JS) with the sqlite-vec extension so vector
search scales beyond small catalogs. Touches the AI/search layer; adds the sqlite-vec
extension as a dependency. NL Ask still falls back to FTS when no `AskProvider` is
configured, so this is a scale optimization, not a correctness fix.

## Hardening follow-ups

All four follow-ups from the `media_references` index review (2026-06-03) are done;
see "Recently shipped" below.

## Deferred enhancements

Captured during the media tags/folders work as explicitly out of scope. Revisit if
demand appears.

### Media / Vault
- Bulk **delete** of selected assets (today's bulk bar only adds/removes tags + moves). `idea`
- Dangling-reference cleanup when an asset is deleted (refs simply stop being queried). `idea`
- Drag-and-drop asset move between folders (today: explicit "Move to"). `idea`
- Recursive "include subfolders" view (a folder shows only its direct assets in v1). `idea`
- Contextual, filter-aware tag chip counts (counts are global per tag today). `idea`

### Tags
- Multi-tag **OR** filtering (only AND is built). `idea`
- Tag descriptions, tag groups/namespaces, and tag merging. `idea`
- Range / shift-click selection in the grid. `idea`

### Folders
- Folder colors / icons and per-folder permissions. `idea`
- Folder reordering beyond name sort. `idea`

## Recently shipped (context)

For reference, not action. Detailed specs/plans were in `docs/superpowers/`.

- Media tags: per-asset tags, filter bar (2026-06-02).
- Media tags filtering & bulk: Untagged filter, multi-tag AND, bulk tagging (2026-06-02).
- Tag entities + colors: registry, recolor, global rename/delete, TagManager (2026-06-02).
- Media folders: folder tree, breadcrumb, move, reparenting delete (2026-06-02).
- Persisted `media_references` index: write-hook + boot-rebuild reverse index replacing
  the per-request usage scan (2026-06-03).
- Automation dry-run ("test rule"): `engine.dryRun` simulates a flow with zero side
  effects via a shared `walk` + swappable recorder; `POST /api/_flows/dry-run` (ephemeral,
  flow-in-body); admin TestPanel + `RunInspector` with simulated badges (2026-06-03).
- Automation live run streaming: SSE `GET /api/_flows/runs/stream` pushes
  run.started/step/completed from the live `storeRecorder` via an in-process
  `RunEventBus`; the Console subscribes with `EventSource` and falls back to the
  2s poll on failure (2026-06-05).
- `media_references` hardening: `replaceForDocument` now does an atomic
  delete+reinsert in one transaction; a `media_references_unique` index enforces
  `UNIQUE(collection, document_id, field, asset_id)` (added in both `bootstrap.ts`
  and `schema-generator.ts`); system index DDL in `schema-generator.ts` is guarded
  by a new `indexExists` helper; and `rebuild` documents that it indexes drafts
  intentionally (2026-06-05).
