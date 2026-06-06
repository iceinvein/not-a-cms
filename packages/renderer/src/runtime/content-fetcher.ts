type FetchConfig = {
  apiBase: string
  routes?: RouteConfig[]
  fetch?: typeof fetch
}

type ContentItem = {
  id: string
  title?: string
  slug?: string
  body?: string
  status?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

type ListResponse = {
  data: ContentItem[]
}

type RouteConfig = {
  collection: string
  path: string
  slug?: string
}

type RouteMatch = {
  collection: string
  path: string
  params: Record<string, string>
  slug?: string
}

type ResolvedRoute = RouteMatch & {
  document: ContentItem
}

const DEFAULT_ROUTES: RouteConfig[] = [
  { collection: "page", path: "/", slug: "home" },
  { collection: "blog_post", path: "/blog/:slug" },
  { collection: "page", path: "/:slug" },
]

export function createContentFetcher(config: FetchConfig) {
  const { apiBase } = config
  const fetchImpl = config.fetch ?? fetch
  const routes = config.routes ?? DEFAULT_ROUTES

  return {
    async list(collection: string, opts?: {
      limit?: number
      offset?: number
      where?: Record<string, unknown>
      search?: string
    }): Promise<ContentItem[]> {
      const params = new URLSearchParams()
      if (opts?.limit) params.set("limit", String(opts.limit))
      if (opts?.offset) params.set("offset", String(opts.offset))
      if (opts?.search) params.set("search", opts.search)
      if (opts?.where) {
        for (const [key, value] of Object.entries(opts.where)) {
          params.set(`where[${key}]`, String(value))
        }
      }

      const url = `${apiBase}/api/${collection}${params.toString() ? "?" + params.toString() : ""}`
      const res = await fetchImpl(url)
      if (!res.ok) throw new Error(`Failed to fetch ${collection}: ${res.status}`)
      const data: ListResponse = await res.json()
      return data.data
    },

    async getById(collection: string, id: string): Promise<ContentItem | null> {
      const res = await fetchImpl(`${apiBase}/api/${collection}/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Failed to fetch ${collection}/${id}: ${res.status}`)
      return res.json()
    },

    async getBySlug(collection: string, slug: string): Promise<ContentItem | null> {
      const res = await fetchImpl(`${apiBase}/api/${collection}/slug/${slug}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Failed to fetch ${collection}/slug/${slug}: ${res.status}`)
      return res.json()
    },

    async resolvePath(pathname: string): Promise<ResolvedRoute | null> {
      const match = resolveRouteMatch(pathname, routes)
      if (!match?.slug) return null

      const documents = await this.list(match.collection, {
        limit: 1,
        where: { slug: match.slug, status: "published" },
      })
      const document = documents.find((item) => item.status === "published") ?? null
      return document ? { ...match, document } : null
    },
  }
}

/**
 * Build the public path for a document, the inverse of resolveRouteMatch.
 * Prefers a fixed-slug route whose slug matches the document (e.g. the homepage),
 * then falls back to the first variable (`:slug`) route for the collection.
 * Returns null when the collection has no route or a variable route has no slug to fill.
 */
export function documentPath(
  collection: string,
  doc: { slug?: string | null },
  routes: RouteConfig[] = DEFAULT_ROUTES,
): string | null {
  const candidates = routes.filter((route) => route.collection === collection)
  if (candidates.length === 0) return null

  const fixed = candidates.find((route) => route.slug && route.slug === doc.slug)
  if (fixed) return fixed.path

  const variable = candidates.find((route) => route.path.includes(":slug"))
  if (variable && doc.slug) return variable.path.replace(":slug", doc.slug)

  return null
}

export type NavItem = { label: string; href: string }

/**
 * Build top-level navigation from the published pages: one link per page
 * (excluding the homepage), with a Blog link appended by default. Keeps a
 * brand-new site navigable without requiring explicit nav configuration.
 */
export function buildNav(
  pages: Array<{ title?: string; slug?: string | null }>,
  opts: { includeBlog?: boolean; routes?: RouteConfig[] } = {},
): NavItem[] {
  const routes = opts.routes ?? DEFAULT_ROUTES
  const items: NavItem[] = []
  for (const page of pages) {
    if (!page.slug || page.slug === "home") continue
    const href = documentPath("page", page, routes)
    if (href) items.push({ label: page.title ?? page.slug, href })
  }
  if (opts.includeBlog !== false) items.push({ label: "Blog", href: "/blog" })
  return items
}

export function resolveRouteMatch(pathname: string, routes: RouteConfig[]): RouteMatch | null {
  const normalizedPath = normalizePath(pathname)
  for (const route of routes) {
    const params = matchRoutePath(normalizedPath, route.path)
    if (!params) continue
    return {
      collection: route.collection,
      path: route.path,
      params,
      slug: route.slug ?? params.slug,
    }
  }
  return null
}

function matchRoutePath(pathname: string, pattern: string): Record<string, string> | null {
  const pathParts = splitPath(pathname)
  const patternParts = splitPath(pattern)
  if (pathParts.length !== patternParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const pathPart = pathParts[i]
    if (patternPart?.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart ?? "")
    } else if (patternPart !== pathPart) {
      return null
    }
  }

  return params
}

function normalizePath(pathname: string): string {
  const pathOnly = pathname.split("?")[0]?.split("#")[0] ?? "/"
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : "/"
}

function splitPath(pathname: string): string[] {
  const normalized = normalizePath(pathname)
  if (normalized === "/") return []
  return normalized.slice(1).split("/")
}

export type ContentFetcher = ReturnType<typeof createContentFetcher>
export type { ContentItem, FetchConfig, RouteConfig, RouteMatch, ResolvedRoute }
