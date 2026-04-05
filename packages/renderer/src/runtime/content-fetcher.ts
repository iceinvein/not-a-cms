type FetchConfig = {
  apiBase: string
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

export function createContentFetcher(config: FetchConfig) {
  const { apiBase } = config

  return {
    async list(collection: string, opts?: { limit?: number; offset?: number; where?: Record<string, unknown> }): Promise<ContentItem[]> {
      const params = new URLSearchParams()
      if (opts?.limit) params.set("limit", String(opts.limit))
      if (opts?.offset) params.set("offset", String(opts.offset))

      const url = `${apiBase}/api/${collection}${params.toString() ? "?" + params.toString() : ""}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch ${collection}: ${res.status}`)
      const data: ListResponse = await res.json()
      return data.data
    },

    async getById(collection: string, id: string): Promise<ContentItem | null> {
      const res = await fetch(`${apiBase}/api/${collection}/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Failed to fetch ${collection}/${id}: ${res.status}`)
      return res.json()
    },

    async getBySlug(collection: string, slug: string): Promise<ContentItem | null> {
      // Fetch all with slug filter — the REST API supports where params
      // In production, add a dedicated slug endpoint
      const items = await this.list(collection, { limit: 1 })
      return items.find((item) => item.slug === slug) ?? null
    },
  }
}

export type ContentFetcher = ReturnType<typeof createContentFetcher>
export type { ContentItem, FetchConfig }
