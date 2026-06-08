import type { ContentItem, RouteConfig } from "./content-fetcher"
import { documentPath, mediaUrl } from "./content-fetcher"

export type ChannelKind = "web" | "rss"
type PTMark = string | { type: string; [key: string]: unknown }
type PTTextNode = { type: "text"; value: string; marks?: PTMark[] }
type PTBlock = { type: string; [key: string]: any }

// CollectionEntry aliases ContentItem; the index signature covers excerpt, coverImage, publishedAt.
type CollectionEntry = ContentItem

type RenderOpts = {
  apiBase?: string
  collectionData?: Record<number, CollectionEntry[]>
  routes?: RouteConfig[]
}

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

/**
 * Make a sanitized URL safe to embed inside a CSS url('...') value by stripping the
 * characters that could close the quote/paren or inject further declarations.
 */
function cssUrl(value: string): string {
  return value.replace(/['"()\\;{}]/g, "").trim()
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

function imageSource(value: unknown): { url: string; id?: string; alt?: string } {
  if (typeof value === "string") return { url: value }
  if (value && typeof value === "object") {
    const image = value as {
      id?: unknown
      mediaId?: unknown
      url?: unknown
      src?: unknown
      alt?: unknown
    }
    return {
      url: String(image.url ?? image.src ?? ""),
      id:
        image.id !== undefined
          ? String(image.id)
          : image.mediaId !== undefined
            ? String(image.mediaId)
            : undefined,
      alt: image.alt !== undefined ? String(image.alt) : undefined,
    }
  }
  return { url: "" }
}

function mediaIdAttribute(id: string | undefined): string {
  return id ? ` data-media-id="${escapeHtml(id)}"` : ""
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function renderBlock(block: PTBlock, index: number, opts?: RenderOpts): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${renderText((block.children || []) as PTTextNode[])}</p>`
    case "heading": {
      const level = block.level || 1
      const html = renderText((block.children || []) as PTTextNode[])
      return `<h${level}>${html}</h${level}>`
    }
    case "blockquote":
      // opts not forwarded: collectionList is a top-level atom and cannot nest here.
      return `<blockquote>${renderPortableText(block.children as PTBlock[])}</blockquote>`
    case "bulletList":
      // opts not forwarded: collectionList is a top-level atom and cannot nest here.
      return `<ul>${(block.items as PTBlock[][]).map((item) => `<li>${renderPortableText(item)}</li>`).join("")}</ul>`
    case "orderedList":
      // opts not forwarded: collectionList is a top-level atom and cannot nest here.
      return `<ol>${(block.items as PTBlock[][]).map((item) => `<li>${renderPortableText(item)}</li>`).join("")}</ol>`
    case "codeBlock":
      return `<pre><code>${escapeXml(String(block.code || ""))}</code></pre>`
    case "divider":
      return "<hr />"
    case "image": {
      const image = imageSource(block)
      return `<img src="${escapeXml(sanitizeUrl(image.url, { allowDataImage: true }))}" alt="${escapeXml(String(image.alt ?? block.alt ?? ""))}"${mediaIdAttribute(image.id)} />`
    }
    case "callout":
      return `<div data-callout data-variant="${escapeHtml(String(block.variant ?? "info"))}">${renderText((block.children || []) as PTTextNode[])}</div>`
    case "hero": {
      const align = block.align === "left" ? "left" : "center"
      const eyebrow = block.eyebrow
        ? `<p class="nac-hero-eyebrow">${escapeHtml(String(block.eyebrow))}</p>`
        : ""
      const headline = block.headline
        ? `<h1 class="nac-hero-headline">${escapeHtml(String(block.headline))}</h1>`
        : ""
      const sub = block.subheadline
        ? `<p class="nac-hero-sub">${escapeHtml(String(block.subheadline))}</p>`
        : ""
      const bgRaw = block.backgroundImage ? imageSource(block.backgroundImage).url : ""
      const bgSanitized = bgRaw ? sanitizeUrl(bgRaw, { allowDataImage: true }) : ""
      const bgUrl = bgSanitized && bgSanitized !== "#" ? cssUrl(bgSanitized) : ""
      const hasBg = Boolean(bgUrl)
      const overlay = hasBg && block.overlay !== false
      const style = hasBg ? ` style="background-image:url('${bgUrl}')"` : ""
      return `<section class="nac-band nac-hero not-prose" data-align="${align}" data-has-bg="${hasBg}" data-overlay="${overlay}"${style}><div class="nac-container">${eyebrow}${headline}${sub}</div></section>`
    }
    case "cta": {
      const variant =
        block.variant === "outline"
          ? "outline"
          : block.variant === "secondary"
            ? "secondary"
            : "primary"
      const href = escapeHtml(sanitizeUrl(block.url))
      const label = escapeHtml(String(block.label ?? "Learn more"))
      return `<div class="nac-band nac-cta not-prose"><div class="nac-container"><a class="nac-cta-btn" data-variant="${variant}" href="${href}">${label}</a></div></div>`
    }
    case "featureGrid": {
      const items = Array.isArray(block.items) ? block.items : []
      const columns = [2, 3, 4].includes(Number(block.columns)) ? Number(block.columns) : 3
      const cards = items
        .map((entry: unknown) => {
          const item = (entry ?? {}) as { icon?: unknown; title?: unknown; text?: unknown }
          const icon = item.icon
            ? `<div class="nac-feature-icon">${escapeHtml(String(item.icon))}</div>`
            : ""
          const title = item.title
            ? `<h3 class="nac-feature-title">${escapeHtml(String(item.title))}</h3>`
            : ""
          const text = item.text
            ? `<p class="nac-feature-text">${escapeHtml(String(item.text))}</p>`
            : ""
          return `<div class="nac-feature">${icon}${title}${text}</div>`
        })
        .join("")
      return `<section class="nac-band nac-features not-prose"><div class="nac-container"><div class="nac-feature-grid" data-columns="${columns}">${cards}</div></div></section>`
    }
    case "stats": {
      const items = Array.isArray(block.items) ? block.items : []
      const columns = [2, 3, 4].includes(Number(block.columns)) ? Number(block.columns) : 3
      const stats = items
        .map((entry: unknown) => {
          const item = (entry ?? {}) as { value?: unknown; label?: unknown }
          const value = item.value
            ? `<div class="nac-stat-value">${escapeHtml(String(item.value))}</div>`
            : ""
          const label = item.label
            ? `<div class="nac-stat-label">${escapeHtml(String(item.label))}</div>`
            : ""
          return `<div class="nac-stat">${value}${label}</div>`
        })
        .join("")
      return `<section class="nac-band nac-stats not-prose"><div class="nac-container"><div class="nac-stat-grid" data-columns="${columns}">${stats}</div></div></section>`
    }
    case "logoCloud": {
      const logos = Array.isArray(block.logos) ? block.logos : []
      const eyebrow = block.eyebrow
        ? `<p class="nac-eyebrow">${escapeHtml(String(block.eyebrow))}</p>`
        : ""
      const logoImgs = logos
        .map((entry: unknown) => {
          const logo = (entry ?? {}) as { url?: unknown; mediaId?: unknown; alt?: unknown }
          const src = imageSource(logo)
          const alt = escapeHtml(String(logo.alt ?? src.alt ?? ""))
          return `<img class="nac-logo" src="${escapeHtml(sanitizeUrl(src.url, { allowDataImage: true }))}" alt="${alt}"${mediaIdAttribute(src.id)} />`
        })
        .join("")
      return `<section class="nac-band nac-logo-cloud not-prose"><div class="nac-container">${eyebrow}<div class="nac-logo-row">${logoImgs}</div></div></section>`
    }
    case "splitMedia": {
      const side = block.side === "right" ? "right" : "left"
      const mediaSrc = imageSource(block.media)
      const mediaImg = mediaSrc.url
        ? `<img src="${escapeHtml(sanitizeUrl(mediaSrc.url, { allowDataImage: true }))}" alt=""${mediaIdAttribute(mediaSrc.id)} />`
        : ""
      const heading = block.heading
        ? `<h2 class="nac-split-heading">${escapeHtml(String(block.heading))}</h2>`
        : ""
      const bodyText = block.body
        ? `<p class="nac-split-text">${escapeHtml(String(block.body))}</p>`
        : ""
      const ctaLabel = String(block.ctaLabel ?? "").trim()
      const cta = ctaLabel
        ? `<a class="nac-cta-btn" data-variant="primary" href="${escapeHtml(sanitizeUrl(block.ctaUrl))}">${escapeHtml(ctaLabel)}</a>`
        : ""
      return `<section class="nac-band nac-split-block not-prose"><div class="nac-container"><div class="nac-split" data-side="${side}"><div class="nac-split-media">${mediaImg}</div><div class="nac-split-body">${heading}${bodyText}${cta}</div></div></div></section>`
    }
    case "testimonial": {
      const quote = escapeHtml(String(block.quote ?? ""))
      const name = escapeHtml(String(block.name ?? ""))
      const role = block.role
        ? `<span class="nac-quote-role">${escapeHtml(String(block.role))}</span>`
        : ""
      const avatarSrc = String(block.avatar ?? "").trim()
      const avatarImg = avatarSrc
        ? `<img class="nac-quote-avatar" src="${escapeHtml(sanitizeUrl(avatarSrc, { allowDataImage: true }))}" alt="" />`
        : ""
      const figcaption = `<figcaption class="nac-quote-by">${avatarImg}<span class="nac-quote-name">${name}</span>${role}</figcaption>`
      return `<section class="nac-band nac-testimonial-block not-prose"><div class="nac-container"><figure class="nac-testimonial"><blockquote class="nac-quote"><p>${quote}</p></blockquote>${figcaption}</figure></div></section>`
    }
    case "pricingCards": {
      const pricingHeading = block.heading
        ? `<h2 class="nac-section-heading">${escapeHtml(String(block.heading))}</h2>`
        : ""
      const tierList = Array.isArray(block.tiers) ? block.tiers : []
      const tierCards = tierList
        .map((entry: unknown) => {
          const tier = (entry ?? {}) as {
            name?: unknown
            price?: unknown
            period?: unknown
            features?: unknown
            ctaLabel?: unknown
            ctaUrl?: unknown
            highlighted?: unknown
          }
          const name = escapeHtml(String(tier.name ?? ""))
          const price = escapeHtml(String(tier.price ?? ""))
          const period = String(tier.period ?? "").trim()
          const periodSpan = period
            ? `<span class="nac-tier-period">${escapeHtml(period)}</span>`
            : ""
          const features = Array.isArray(tier.features) ? tier.features : []
          const featureItems = features
            .map((f: unknown) => `<li>${escapeHtml(String(f ?? ""))}</li>`)
            .join("")
          const ctaLabel = String(tier.ctaLabel ?? "").trim()
          const cta = ctaLabel
            ? `<a class="nac-cta-btn" data-variant="primary" href="${escapeHtml(sanitizeUrl(tier.ctaUrl))}">${escapeHtml(ctaLabel)}</a>`
            : ""
          const highlight = Boolean(tier.highlighted)
          return `<div class="nac-tier" data-highlight="${highlight}"><h3 class="nac-tier-name">${name}</h3><div class="nac-tier-price">${price}${periodSpan}</div><ul class="nac-tier-features">${featureItems}</ul>${cta}</div>`
        })
        .join("")
      return `<section class="nac-band nac-pricing-cards not-prose"><div class="nac-container">${pricingHeading}<div class="nac-pricing">${tierCards}</div></div></section>`
    }
    case "faq": {
      const faqHeading = block.heading
        ? `<h2 class="nac-section-heading">${escapeHtml(String(block.heading))}</h2>`
        : ""
      const faqItems = Array.isArray(block.items) ? block.items : []
      const details = faqItems
        .map((entry: unknown) => {
          const item = (entry ?? {}) as { question?: unknown; answer?: unknown }
          const question = escapeHtml(String(item.question ?? ""))
          const answer = escapeHtml(String(item.answer ?? ""))
          return `<details class="nac-faq-item"><summary class="nac-faq-q">${question}</summary><div class="nac-faq-a">${answer}</div></details>`
        })
        .join("")
      return `<section class="nac-band nac-faq-block not-prose"><div class="nac-container">${faqHeading}<div class="nac-faq">${details}</div></div></section>`
    }
    case "author":
      return `<div data-author><span data-author-name>${escapeHtml(String(block.name ?? ""))}</span>${block.role ? `<span data-author-role>${escapeHtml(String(block.role))}</span>` : ""}</div>`
    case "gallery": {
      const images = Array.isArray(block.images) ? block.images : []
      return `<div data-gallery>${images
        .map((entry: unknown) => {
          const image = imageSource(entry)
          return `<img src="${escapeHtml(sanitizeUrl(image.url, { allowDataImage: true }))}" alt="${escapeHtml(image.alt ?? "")}"${mediaIdAttribute(image.id)} />`
        })
        .join("")}</div>`
    }
    case "seo":
      return ""
    case "collectionList": {
      const layout = ["grid", "list", "cards"].includes(String(block.layout))
        ? String(block.layout)
        : "grid"
      const heading = block.heading
        ? `<h2 class="nac-section-heading">${escapeHtml(String(block.heading))}</h2>`
        : ""
      const entries = opts?.collectionData?.[index] ?? []
      const showCover = block.showCover !== false
      const showExcerpt = block.showExcerpt !== false
      const showDate = block.showDate !== false
      const apiBase = opts?.apiBase ?? ""

      const cards = entries
        .map((entry) => {
          const href = escapeHtml(
            documentPath(String(block.collection ?? ""), entry, opts?.routes) ?? "#",
          )
          const coverSrc = showCover ? mediaUrl(apiBase, entry.coverImage) : null
          const coverImg = coverSrc
            ? `<img class="nac-collection-cover" src="${escapeHtml(coverSrc)}" alt="" />`
            : ""
          const title = `<h3 class="nac-collection-title">${escapeHtml(String(entry.title ?? ""))}</h3>`
          const excerptHtml =
            showExcerpt && entry.excerpt
              ? `<p class="nac-collection-excerpt">${escapeHtml(String(entry.excerpt))}</p>`
              : ""
          const dateValue = entry.publishedAt ?? entry.created_at
          const dateHtml =
            showDate && dateValue
              ? `<time class="nac-collection-date">${escapeHtml(formatDate(String(dateValue)))}</time>`
              : ""
          return `<a class="nac-collection-card" href="${href}">${coverImg}${title}${excerptHtml}${dateHtml}</a>`
        })
        .join("")

      return `<section class="nac-band nac-collection-block not-prose"><div class="nac-container">${heading}<div class="nac-collection" data-layout="${layout}">${cards}</div></div></section>`
    }
    default:
      return ""
  }
}

export function renderPortableText(
  blocks: PTBlock[],
  _channel: ChannelKind = "web",
  opts?: RenderOpts,
): string {
  if (!Array.isArray(blocks)) return ""
  return blocks
    .map((b, i) => renderBlock(b, i, opts))
    .filter(Boolean)
    .join("\n")
}
