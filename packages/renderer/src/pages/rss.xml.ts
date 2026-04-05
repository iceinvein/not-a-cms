import { renderRSSFeed } from "../runtime/channel"
import type { APIRoute } from "astro"

export const GET: APIRoute = async () => {
  // In production, fetch published posts from the API
  // For now, return an empty feed
  const xml = renderRSSFeed(
    {
      title: "not-a-cms",
      description: "A site powered by not-a-cms",
      siteUrl: "http://localhost:3000",
    },
    [],
  )

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
