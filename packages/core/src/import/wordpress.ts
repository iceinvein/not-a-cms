type PTBlock = { type: string; [key: string]: any }

export function htmlToPortableText(html: string): PTBlock[] {
  const blocks: PTBlock[] = []
  const cleaned = html.trim()

  const blockRegex = /<(p|h[1-6]|blockquote|ul|ol|pre|img|hr)[^>]*>([\s\S]*?)<\/\1>|<(img|hr)\s[^>]*\/?>/gi
  let match

  while ((match = blockRegex.exec(cleaned)) !== null) {
    const tag = (match[1] || match[3] || "").toLowerCase()
    const content = match[2] || ""

    if (tag === "p") {
      blocks.push({ type: "paragraph", children: parseInlineContent(content) })
    } else if (tag.match(/^h[1-6]$/)) {
      blocks.push({ type: "heading", level: parseInt(tag[1]), children: parseInlineContent(content) })
    } else if (tag === "blockquote") {
      blocks.push({ type: "blockquote", children: htmlToPortableText(content) })
    } else if (tag === "ul") {
      blocks.push({ type: "bulletList", items: parseListItems(content) })
    } else if (tag === "ol") {
      blocks.push({ type: "orderedList", items: parseListItems(content) })
    } else if (tag === "pre") {
      const code = content
        .replace(/<\/?code[^>]*>/gi, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
      blocks.push({ type: "codeBlock", code })
    } else if (tag === "img") {
      const srcMatch = match[0].match(/src="([^"]*)"/)
      const altMatch = match[0].match(/alt="([^"]*)"/)
      blocks.push({ type: "image", src: srcMatch?.[1] || "", alt: altMatch?.[1] || "" })
    } else if (tag === "hr") {
      blocks.push({ type: "divider" })
    }
  }

  if (blocks.length === 0 && cleaned) {
    blocks.push({ type: "paragraph", children: parseInlineContent(cleaned) })
  }

  return blocks
}

function parseInlineContent(html: string): Array<{ type: "text"; value: string; marks?: string[] }> {
  const nodes: Array<{ type: "text"; value: string; marks?: string[] }> = []
  const inlineRegex = /<(strong|b|em|i|code|a)[^>]*>([\s\S]*?)<\/\1>|([^<]+)/gi
  let match

  while ((match = inlineRegex.exec(html)) !== null) {
    const tag = (match[1] || "").toLowerCase()
    const content = match[2] || match[3] || ""
    const text = content
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")

    if (!text.trim() && !text) continue

    if (tag === "strong" || tag === "b") {
      nodes.push({ type: "text", value: text, marks: ["bold"] })
    } else if (tag === "em" || tag === "i") {
      nodes.push({ type: "text", value: text, marks: ["italic"] })
    } else if (tag === "code") {
      nodes.push({ type: "text", value: text, marks: ["code"] })
    } else if (tag === "a") {
      const hrefMatch = match[0].match(/href="([^"]*)"/)
      nodes.push({ type: "text", value: text, marks: [{ type: "link", href: hrefMatch?.[1] || "" } as any] })
    } else {
      nodes.push({ type: "text", value: text })
    }
  }

  return nodes.length > 0 ? nodes : [{ type: "text", value: "" }]
}

function parseListItems(html: string): PTBlock[][] {
  const items: PTBlock[][] = []
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let match
  while ((match = liRegex.exec(html)) !== null) {
    items.push([{ type: "paragraph", children: parseInlineContent(match[1]) }])
  }
  return items
}

type WXRResult = {
  posts: Array<{
    title: string
    slug: string
    status: string
    body: PTBlock[]
    type: string
  }>
}

export function parseWXR(xml: string): WXRResult {
  const posts: WXRResult["posts"] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractTag(item, "title") || "Untitled"
    const slug = extractTag(item, "wp:post_name") || ""
    const type = extractTag(item, "wp:post_type") || "post"
    const wpStatus = extractTag(item, "wp:status") || "draft"
    const content = extractCDATA(item, "content:encoded") || ""

    const status = wpStatus === "publish" ? "published" : wpStatus === "draft" ? "draft" : "archived"
    const body = htmlToPortableText(content)

    posts.push({ title, slug, status, body, type })
  }

  return { posts }
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function extractCDATA(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")
  const match = xml.match(regex)
  return match ? match[1] : null
}
