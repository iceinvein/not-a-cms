import type { PTBlock } from "./block-renderer"
import { renderPortableText } from "./portable-text-html"
import type { ChannelConfig } from "@not-a-cms/core"
import type { ContentItem } from "./content-fetcher"

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

type ChannelRuntimeInput = {
  site?: {
    name?: string
    url?: string
  }
  channels?: ChannelConfig
}

type ResolvedChannelConfig = {
  siteUrl: string
  rss: Required<NonNullable<ChannelConfig["rss"]>>
}

const DEFAULT_RSS = {
  title: "not-a-cms",
  description: "A site powered by not-a-cms",
  language: "en",
  collection: "blog_post",
  itemPath: "/blog/:slug",
}

const SETTING_KEYS = {
  rssTitle: "channel.rss.title",
  rssDescription: "channel.rss.description",
  rssLanguage: "channel.rss.language",
  rssCollection: "channel.rss.collection",
  rssItemPath: "channel.rss.itemPath",
} as const

export function resolveChannelConfig(
  input: ChannelRuntimeInput = {},
  settings: Record<string, string> = {},
): ResolvedChannelConfig {
  const configured = input.channels?.rss ?? {}
  const siteUrl = normalizeSiteUrl(input.site?.url ?? "http://localhost:3000")
  return {
    siteUrl,
    rss: {
      title: settingOrConfig(settings, SETTING_KEYS.rssTitle, configured.title, input.site?.name ?? DEFAULT_RSS.title),
      description: settingOrConfig(settings, SETTING_KEYS.rssDescription, configured.description, DEFAULT_RSS.description),
      language: settingOrConfig(settings, SETTING_KEYS.rssLanguage, configured.language, DEFAULT_RSS.language),
      collection: settingOrConfig(settings, SETTING_KEYS.rssCollection, configured.collection, DEFAULT_RSS.collection),
      itemPath: settingOrConfig(settings, SETTING_KEYS.rssItemPath, configured.itemPath, DEFAULT_RSS.itemPath),
    },
  }
}

export function parseChannelConfig(value: string | undefined): ChannelRuntimeInput {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed as ChannelRuntimeInput : {}
  } catch {
    return {}
  }
}

export function buildChannelItemLink(siteUrl: string, itemPath: string, item: { id?: string; slug?: string }): string {
  const base = normalizeSiteUrl(siteUrl)
  const path = itemPath.startsWith("/") ? itemPath : `/${itemPath}`
  const slug = encodeURIComponent(String(item.slug || item.id || ""))
  const id = encodeURIComponent(String(item.id || item.slug || ""))
  const rendered = path
    .replace(/:slug\b/g, slug)
    .replace(/:id\b/g, id)
  return `${base}${rendered}`
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

export function portableTextToHtml(blocks: PTBlock[], opts?: { apiBase?: string; collectionData?: Record<number, ContentItem[]> }): string {
  return renderPortableText(blocks, "web", opts)
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

function settingOrConfig(
  settings: Record<string, string>,
  key: string,
  configured: string | undefined,
  fallback: string,
): string {
  const value = settings[key] ?? configured ?? fallback
  return String(value).trim() || fallback
}

function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim() || "http://localhost:3000"
  return trimmed.replace(/\/+$/, "")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export type { RSSItem, RSSFeedConfig, ChannelRuntimeInput, ResolvedChannelConfig }
