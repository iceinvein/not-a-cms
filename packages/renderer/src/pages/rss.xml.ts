import {
  buildChannelItemLink,
  parseChannelConfig,
  renderRSSFeed,
  resolveChannelConfig,
  portableTextToHtml,
} from "../runtime/channel"
import { createContentFetcher } from "../runtime/content-fetcher"
import type { APIRoute } from "astro"

export const GET: APIRoute = async () => {
  const apiBase = import.meta.env.PUBLIC_API_BASE || "http://localhost:4321"
  const configured = parseChannelConfig(import.meta.env.NOT_A_CMS_CHANNEL_CONFIG)
  const siteUrl = import.meta.env.SITE || import.meta.env.PUBLIC_SITE_BASE || configured.site?.url || "http://localhost:3000"
  const settings = await fetchChannelSettings(apiBase)
  const channelConfig = resolveChannelConfig(
    {
      ...configured,
      site: {
        ...configured.site,
        url: siteUrl,
      },
    },
    settings,
  )
  const fetcher = createContentFetcher({ apiBase })

  let items: Array<{
    title: string
    link: string
    description: string
    pubDate: string
    guid: string
  }> = []

  try {
    const posts = await fetcher.list(channelConfig.rss.collection, { limit: 50 })
    const published = posts.filter((p) => p.status === "published")

    items = published.map((post) => {
      let description = ""
      if (post.body) {
        try {
          const blocks = typeof post.body === "string" ? JSON.parse(post.body) : post.body
          description = portableTextToHtml(blocks)
        } catch {
          description = String(post.excerpt || post.title || "")
        }
      }

      const slug = post.slug || post.id
      const link = buildChannelItemLink(channelConfig.siteUrl, channelConfig.rss.itemPath, {
        id: String(post.id),
        slug: String(slug),
      })
      return {
        title: String(post.title || "Untitled"),
        link,
        description,
        pubDate: new Date(String(post.published_at || post.created_at || "")).toUTCString(),
        guid: link,
      }
    })
  } catch {
    // API unavailable — return empty feed
  }

  const xml = renderRSSFeed(
    {
      title: channelConfig.rss.title,
      description: channelConfig.rss.description,
      language: channelConfig.rss.language,
      siteUrl: channelConfig.siteUrl,
    },
    items,
  )

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}

async function fetchChannelSettings(apiBase: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${apiBase}/api/_channel-settings`)
    if (!res.ok) return {}
    const body = await res.json()
    return body.data && typeof body.data === "object" ? body.data : {}
  } catch {
    return {}
  }
}
