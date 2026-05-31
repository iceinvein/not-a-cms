import type { CollectionDef } from "../types"

type PTBlock = { type: string; [key: string]: any }

type WXRContentItem = {
  title: string
  slug: string
  status: string
  body: PTBlock[]
  type: string
  author?: string
  tags: string[]
  categories: string[]
}

type WXRMediaItem = {
  title: string
  slug: string
  status: string
  type: "attachment"
  url: string
  mimeType?: string
}

type WXRAuthor = {
  login: string
  email?: string
  displayName: string
}

type WXRTerm = {
  id?: string
  taxonomy: string
  slug: string
  name: string
}

type WXRResult = {
  posts: WXRContentItem[]
  pages: WXRContentItem[]
  media: WXRMediaItem[]
  authors: WXRAuthor[]
  tags: WXRTerm[]
  categories: WXRTerm[]
}

type ImportPlanEntry = {
  collection: string
  sourceType: "post" | "page" | "media" | "author" | "tag" | "category"
  data: Record<string, unknown>
}

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

export function parseWXR(xml: string): WXRResult {
  const posts: WXRContentItem[] = []
  const pages: WXRContentItem[] = []
  const media: WXRMediaItem[] = []
  const authors = parseAuthors(xml)
  const terms = parseTerms(xml)
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractTag(item, "title") || "Untitled"
    const slug = extractTag(item, "wp:post_name") || ""
    const type = extractTag(item, "wp:post_type") || "post"
    const wpStatus = extractTag(item, "wp:status") || "draft"
    const content = extractCDATA(item, "content:encoded") || ""
    const author = extractTag(item, "dc:creator") || undefined
    const itemTerms = parseItemTerms(item)

    const status = wpStatus === "publish" ? "published" : wpStatus === "draft" ? "draft" : "archived"
    const body = htmlToPortableText(content)

    if (type === "attachment") {
      media.push({
        title,
        slug,
        status,
        type: "attachment",
        url: extractTag(item, "wp:attachment_url") || "",
        mimeType: extractTag(item, "wp:post_mime_type") || undefined,
      })
      continue
    }

    const entry = {
      title,
      slug,
      status,
      body,
      type,
      author,
      tags: itemTerms.filter((term) => term.taxonomy === "post_tag").map((term) => term.name),
      categories: itemTerms.filter((term) => term.taxonomy === "category").map((term) => term.name),
    }

    if (type === "page") pages.push(entry)
    else posts.push(entry)
  }

  return {
    posts,
    pages,
    media,
    authors,
    tags: terms.filter((term) => term.taxonomy === "post_tag"),
    categories: terms.filter((term) => term.taxonomy === "category"),
  }
}

export function createWordPressImportPlan(parsed: WXRResult, collections: CollectionDef[]) {
  const entries: ImportPlanEntry[] = []
  const authorByLogin = new Map(parsed.authors.map((author) => [author.login, author]))

  const postCollection = findCollection(collections, ["blog_post", "post", "posts"])
  const pageCollection = findCollection(collections, ["page", "pages"])
  const mediaCollection = findCollection(collections, ["media", "attachment", "asset", "assets"])
  const authorCollection = findCollection(collections, ["author", "authors", "user", "users"])
  const tagCollection = findCollection(collections, ["tag", "tags"])
  const categoryCollection = findCollection(collections, ["category", "categories"])

  for (const post of parsed.posts) {
    if (!postCollection) continue
    const author = post.author ? authorByLogin.get(post.author) : undefined
    entries.push({
      collection: postCollection.name,
      sourceType: "post",
      data: filterDataForCollection(postCollection, {
        title: post.title,
        slug: post.slug,
        body: post.body,
        status: post.status,
        author: author?.displayName ?? post.author,
        tags: post.tags,
        categories: post.categories,
      }),
    })
  }

  for (const page of parsed.pages) {
    if (!pageCollection) continue
    entries.push({
      collection: pageCollection.name,
      sourceType: "page",
      data: filterDataForCollection(pageCollection, {
        title: page.title,
        slug: page.slug,
        body: page.body,
        status: page.status,
      }),
    })
  }

  for (const item of parsed.media) {
    if (!mediaCollection) continue
    entries.push({
      collection: mediaCollection.name,
      sourceType: "media",
      data: filterDataForCollection(mediaCollection, {
        title: item.title,
        slug: item.slug,
        status: item.status,
        url: item.url,
        mimeType: item.mimeType,
      }),
    })
  }

  for (const author of parsed.authors) {
    if (!authorCollection) continue
    entries.push({
      collection: authorCollection.name,
      sourceType: "author",
      data: filterDataForCollection(authorCollection, {
        name: author.displayName,
        slug: author.login,
        email: author.email,
      }),
    })
  }

  for (const tag of parsed.tags) {
    if (!tagCollection) continue
    entries.push({
      collection: tagCollection.name,
      sourceType: "tag",
      data: filterDataForCollection(tagCollection, {
        name: tag.name,
        slug: tag.slug,
      }),
    })
  }

  for (const category of parsed.categories) {
    if (!categoryCollection) continue
    entries.push({
      collection: categoryCollection.name,
      sourceType: "category",
      data: filterDataForCollection(categoryCollection, {
        name: category.name,
        slug: category.slug,
      }),
    })
  }

  return {
    entries,
    counts: entries.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.collection] = (counts[entry.collection] ?? 0) + 1
      return counts
    }, {}),
  }
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function parseAuthors(xml: string): WXRAuthor[] {
  const authors: WXRAuthor[] = []
  const authorRegex = /<wp:author>([\s\S]*?)<\/wp:author>/gi
  let match
  while ((match = authorRegex.exec(xml)) !== null) {
    const author = match[1]
    const login = extractTag(author, "wp:author_login") || ""
    if (!login) continue
    authors.push({
      login,
      email: extractTag(author, "wp:author_email") || undefined,
      displayName: extractTag(author, "wp:author_display_name") || login,
    })
  }
  return authors
}

function parseTerms(xml: string): WXRTerm[] {
  const terms: WXRTerm[] = []
  const termRegex = /<wp:term>([\s\S]*?)<\/wp:term>/gi
  let match
  while ((match = termRegex.exec(xml)) !== null) {
    const term = match[1]
    const taxonomy = extractTag(term, "wp:term_taxonomy") || ""
    const slug = extractTag(term, "wp:term_slug") || ""
    const name = extractTag(term, "wp:term_name") || slug
    if (!taxonomy || !slug) continue
    terms.push({
      id: extractTag(term, "wp:term_id") || undefined,
      taxonomy,
      slug,
      name,
    })
  }
  return terms
}

function parseItemTerms(xml: string): Array<{ taxonomy: string; slug: string; name: string }> {
  const terms: Array<{ taxonomy: string; slug: string; name: string }> = []
  const categoryRegex = /<category([^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/gi
  let match
  while ((match = categoryRegex.exec(xml)) !== null) {
    const attrs = match[1] || ""
    const taxonomy = attr(attrs, "domain") || ""
    const slug = attr(attrs, "nicename") || ""
    const name = (match[2] || slug).trim()
    if (!taxonomy || !slug) continue
    terms.push({ taxonomy, slug, name })
  }
  return terms
}

function attr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, "i"))
  return match?.[1] ?? null
}

function extractCDATA(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")
  const match = xml.match(regex)
  return match ? match[1] : null
}

function findCollection(collections: CollectionDef[], names: string[]): CollectionDef | undefined {
  return names.map((name) => collections.find((collection) => collection.name === name)).find(Boolean)
}

function filterDataForCollection(collection: CollectionDef, data: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    if (collection.fields[key]) filtered[key] = value
  }
  return filtered
}
