export type SiteRoute = { collection: string; path: string; slug?: string }

/**
 * Substitute :slug / :id into a route path and join it to the site base. A local copy of
 * the renderer's `buildChannelItemLink` (packages/renderer/src/runtime/channel.ts): the
 * admin island must not import the renderer package in the browser (its barrel pulls in
 * server runtime that references `process` and breaks hydration), and the logic is small
 * and stable. Keep the two in sync if the route-token format ever changes.
 */
function buildItemLink(siteUrl: string, itemPath: string, item: { id?: string; slug?: string }) {
  const base = siteUrl.replace(/\/+$/, "")
  const path = itemPath.startsWith("/") ? itemPath : `/${itemPath}`
  const slug = encodeURIComponent(String(item.slug || item.id || ""))
  const id = encodeURIComponent(String(item.id || item.slug || ""))
  return `${base}${path.replace(/:slug\b/g, slug).replace(/:id\b/g, id)}`
}

/**
 * The canonical public URL of a document, built from the site's route table (the same
 * `{collection, path, slug}` records the renderer uses) so the editor's "View live" link
 * matches exactly what visitors hit. Returns null when the collection has no public route
 * or the route table is unavailable, so callers can hide the affordance instead of linking
 * to a broken path.
 */
export function liveUrlForDocument(input: {
  routes: SiteRoute[] | null | undefined
  collection: string
  doc: Record<string, unknown>
  siteBase: string
}): string | null {
  const { routes, collection, doc, siteBase } = input
  if (!routes) return null

  const route = routes.find((r) => r.collection === collection)
  if (!route) return null

  const slugField = route.slug ?? "slug"
  const slug = doc[slugField]
  return buildItemLink(siteBase, route.path, {
    slug: slug != null ? String(slug) : undefined,
    id: doc.id != null ? String(doc.id) : undefined,
  })
}
