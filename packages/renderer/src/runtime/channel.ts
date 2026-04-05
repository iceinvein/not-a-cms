import type { PTBlock, PTTextNode } from "./block-renderer"
import { renderTextChildren } from "./block-renderer"

// --- RSS Channel ---

type RSSItem = {
  title: string
  link: string
  description: string
  pubDate: string
  guid: string
}

type RSSFeedConfig = {
  title: string
  description: string
  siteUrl: string
  language?: string
}

export function renderRSSFeed(config: RSSFeedConfig, items: RSSItem[]): string {
  const itemsXml = items
    .map(
      (item) => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${escapeXml(item.link)}</link>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <guid>${escapeXml(item.guid)}</guid>
    </item>`,
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${config.title}]]></title>
    <description><![CDATA[${config.description}]]></description>
    <link>${escapeXml(config.siteUrl)}</link>
    <language>${config.language || "en"}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`
}

// --- Portable Text to HTML (for RSS descriptions) ---

export function portableTextToHtml(blocks: PTBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return `<p>${renderTextChildren((block.children || []) as PTTextNode[])}</p>`
        case "heading": {
          const level = block.level || 1
          const html = renderTextChildren((block.children || []) as PTTextNode[])
          return `<h${level}>${html}</h${level}>`
        }
        case "blockquote":
          return `<blockquote>${portableTextToHtml(block.children as PTBlock[])}</blockquote>`
        case "bulletList":
          return `<ul>${(block.items as PTBlock[][]).map((item) => `<li>${portableTextToHtml(item)}</li>`).join("")}</ul>`
        case "orderedList":
          return `<ol>${(block.items as PTBlock[][]).map((item) => `<li>${portableTextToHtml(item)}</li>`).join("")}</ol>`
        case "codeBlock":
          return `<pre><code>${escapeXml(String(block.code || ""))}</code></pre>`
        case "divider":
          return "<hr />"
        case "image":
          return `<img src="${escapeXml(String(block.src || block.url || ""))}" alt="${escapeXml(String(block.alt || ""))}" />`
        default:
          return ""
      }
    })
    .filter(Boolean)
    .join("\n")
}

// --- JSON Channel (passthrough, but typed) ---

export function renderJSONChannel(blocks: PTBlock[]): string {
  return JSON.stringify(blocks, null, 2)
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export type { RSSItem, RSSFeedConfig }
