export type ChannelKind = "web" | "rss"
type PTMark = string | { type: string; [key: string]: unknown }
type PTTextNode = { type: "text"; value: string; marks?: PTMark[] }
type PTBlock = { type: string; [key: string]: any }

const MARK_TAG: Record<string, string> = {
  bold: "strong",
  italic: "em",
  code: "code",
  underline: "u",
  strike: "s",
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeXml(value: string): string {
  return escapeHtml(value).replace(/'/g, "&apos;")
}

function sanitizeUrl(value: unknown, opts: { allowDataImage?: boolean } = {}): string {
  const url = String(value ?? "").trim()
  if (!url) return "#"
  if (url.startsWith("/") || url.startsWith("#") || url.startsWith("./") || url.startsWith("../")) {
    return url
  }
  if (opts.allowDataImage && /^data:image\/[a-z0-9.+-]+;base64,/i.test(url)) {
    return url
  }

  try {
    const parsed = new URL(url)
    if (["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) {
      return url
    }
  } catch {
    return "#"
  }

  return "#"
}

function renderText(children: PTTextNode[] = []): string {
  return children
    .map((node) => {
      if (node.type !== "text") return ""
      let html = escapeHtml(node.value ?? "")
      for (const mark of node.marks ?? []) {
        if (typeof mark === "string" && MARK_TAG[mark]) {
          html = `<${MARK_TAG[mark]}>${html}</${MARK_TAG[mark]}>`
        } else if (typeof mark === "object" && mark.type === "link") {
          const href = escapeHtml(sanitizeUrl(mark.href || ""))
          const target = mark.target ? ` target="${escapeHtml(String(mark.target))}"` : ""
          html = `<a href="${href}"${target}>${html}</a>`
        }
      }
      return html
    })
    .join("")
}

function renderBlock(block: PTBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${renderText((block.children || []) as PTTextNode[])}</p>`
    case "heading": {
      const level = block.level || 1
      const html = renderText((block.children || []) as PTTextNode[])
      return `<h${level}>${html}</h${level}>`
    }
    case "blockquote":
      return `<blockquote>${renderPortableText(block.children as PTBlock[])}</blockquote>`
    case "bulletList":
      return `<ul>${(block.items as PTBlock[][]).map((item) => `<li>${renderPortableText(item)}</li>`).join("")}</ul>`
    case "orderedList":
      return `<ol>${(block.items as PTBlock[][]).map((item) => `<li>${renderPortableText(item)}</li>`).join("")}</ol>`
    case "codeBlock":
      return `<pre><code>${escapeXml(String(block.code || ""))}</code></pre>`
    case "divider":
      return "<hr />"
    case "image":
      return `<img src="${escapeXml(sanitizeUrl(block.src || block.url || "", { allowDataImage: true }))}" alt="${escapeXml(String(block.alt || ""))}" />`
    case "callout":
      return `<div data-callout data-variant="${escapeHtml(String(block.variant ?? "info"))}">${renderText((block.children || []) as PTTextNode[])}</div>`
    case "author":
      return `<div data-author><span data-author-name>${escapeHtml(String(block.name ?? ""))}</span>${block.role ? `<span data-author-role>${escapeHtml(String(block.role))}</span>` : ""}</div>`
    case "gallery": {
      const images = Array.isArray(block.images) ? block.images : []
      return `<div data-gallery>${images.map((src: unknown) => `<img src="${escapeHtml(sanitizeUrl(src, { allowDataImage: true }))}" alt="" />`).join("")}</div>`
    }
    case "seo":
      return ""
    default:
      return ""
  }
}

export function renderPortableText(blocks: PTBlock[], _channel: ChannelKind = "web"): string {
  if (!Array.isArray(blocks)) return ""
  return blocks.map(renderBlock).filter(Boolean).join("\n")
}
