type PTBlock = {
  type: string
  [key: string]: unknown
}

type PTTextNode = {
  type: "text"
  value: string
  marks?: Array<string | { type: string; [key: string]: any }>
}

type BlockComponentMap = Record<string, string>

const DEFAULT_BLOCK_MAP: BlockComponentMap = {
  paragraph: "Paragraph",
  heading: "Heading",
  blockquote: "Blockquote",
  bulletList: "BulletList",
  orderedList: "OrderedList",
  codeBlock: "CodeBlock",
  divider: "Divider",
  callout: "Callout",
  image: "Image",
}

export function resolveBlockComponent(
  block: PTBlock,
  customMap: BlockComponentMap = {},
): string | null {
  const map = { ...DEFAULT_BLOCK_MAP, ...customMap }
  return map[block.type] ?? null
}

export function renderTextChildren(children: PTTextNode[]): string {
  return children
    .map((child) => {
      if (child.type !== "text") return ""
      let html = escapeHtml(child.value)

      if (child.marks) {
        for (const mark of child.marks) {
          if (typeof mark === "string") {
            switch (mark) {
              case "bold":
                html = `<strong>${html}</strong>`
                break
              case "italic":
                html = `<em>${html}</em>`
                break
              case "code":
                html = `<code>${html}</code>`
                break
              case "underline":
                html = `<u>${html}</u>`
                break
              case "strike":
                html = `<s>${html}</s>`
                break
            }
          } else if (mark.type === "link") {
            const href = escapeHtml(sanitizeUrl(mark.href || ""))
            const target = mark.target ? ` target="${escapeHtml(mark.target)}"` : ""
            html = `<a href="${href}"${target}>${html}</a>`
          }
        }
      }

      return html
    })
    .join("")
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function sanitizeUrl(value: unknown, opts: { allowDataImage?: boolean } = {}): string {
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

export { DEFAULT_BLOCK_MAP, type PTBlock, type PTTextNode, type BlockComponentMap }
