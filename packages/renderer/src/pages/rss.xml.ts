import { renderRSSFeed, portableTextToHtml } from "../runtime/channel"
import { createContentFetcher } from "../runtime/content-fetcher"
import type { APIRoute } from "astro"

export const GET: APIRoute = async () => {
  const apiBase = import.meta.env.PUBLIC_API_BASE || "http://localhost:4321"
  const siteUrl = import.meta.env.SITE || "http://localhost:3000"
  const fetcher = createContentFetcher({ apiBase })

  let items: Array<{
    title: string
    link: string
    description: string
    pubDate: string
    guid: string
  }> = []

  try {
    const posts = await fetcher.list("blog_post", { limit: 50 })
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
      return {
        title: String(post.title || "Untitled"),
        link: `${siteUrl}/${slug}`,
        description,
        pubDate: new Date(String(post.published_at || post.created_at || "")).toUTCString(),
        guid: `${siteUrl}/${slug}`,
      }
    })
  } catch {
    // API unavailable — return empty feed
  }

  const xml = renderRSSFeed(
    {
      title: "not-a-cms",
      description: "A site powered by not-a-cms",
      siteUrl,
    },
    items,
  )

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
