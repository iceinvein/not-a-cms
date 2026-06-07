import { useEffect, useMemo, useRef, useState } from "react"
import { renderPortableText } from "@not-a-cms/renderer/web"
import { brandCss, resolveActiveThemeCss } from "@not-a-cms/renderer/theme"
import { adminApiFetch } from "../../lib/api"

type Channel = "web" | "email" | "rss"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Minimal readable base for the iframe preview (the public site gets these from the
// Tailwind typography plugin, which is not loaded here); brandCss layers the actual
// brand styling and section blocks on top, so sections preview exactly as published.
const PREVIEW_BASE_CSS = `
  body { margin: 0; }
  .nac-preview { max-width: 56rem; margin: 0 auto; padding: 2rem 1.25rem; }
  .prose { color: var(--body, #44403c); line-height: 1.7; }
  .prose p { margin: 1em 0; }
  .prose h2 { font-size: 1.6rem; margin: 1.5em 0 0.5em; color: var(--ink); }
  .prose h3 { font-size: 1.25rem; margin: 1.3em 0 0.4em; color: var(--ink); }
  .prose ul, .prose ol { margin: 1em 0; padding-left: 1.5em; }
  .prose li { margin: 0.35em 0; }
  .prose a { color: var(--accent); }
  .prose blockquote { border-left: 3px solid var(--accent); padding-left: 1em; margin: 1.25em 0; color: var(--ink); }
  .prose img { max-width: 100%; border-radius: 8px; }
  .prose pre { background: #1c1917; color: #fafaf9; padding: 1em; border-radius: 8px; overflow: auto; }
  .prose hr { border: 0; border-top: 1px solid var(--border); margin: 2em 0; }
  .nac-preview-title { font-size: 2.25rem; margin: 0 0 0.5rem; color: var(--ink); }
  .nac-preview-byline { color: var(--muted); margin: 0 0 1.5rem; }
`

/**
 * Build the self-contained HTML document for the web preview iframe: the active theme's
 * CSS variables, the webfont link, the readable base, and the brand stylesheet, around
 * the rendered body. A hero-led page drops the duplicate title, matching the public site.
 */
export function buildWebPreviewDoc(opts: {
  body: string
  title: string
  byline?: string
  leadsWithHero?: boolean
  variables: string
  fontImport?: string
}): string {
  const { body, title, byline, leadsWithHero, variables, fontImport } = opts
  const fontLink = fontImport ? `<link rel="stylesheet" href="${escapeHtml(fontImport)}">` : ""
  const heading = leadsWithHero ? "" : `<h1 class="nac-preview-title">${escapeHtml(title)}</h1>`
  const bylineHtml = byline ? `<p class="nac-preview-byline">${escapeHtml(byline)}</p>` : ""
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>${variables}</style>${fontLink}
<style>${PREVIEW_BASE_CSS}</style>
<style>${brandCss}</style>
</head><body>
<main class="nac-preview"><article class="prose">${heading}${bylineHtml}${body}</article></main>
</body></html>`
}

export function ChannelMirror({
  apiBase = "",
  blocks,
  title,
  byline,
  initialChannel = "web",
  initialEmailHtml = "",
}: {
  apiBase?: string
  blocks: any[]
  title: string
  byline?: string
  initialChannel?: Channel
  initialEmailHtml?: string
}) {
  const [channel, setChannel] = useState<Channel>(initialChannel)
  const [emailHtml, setEmailHtml] = useState(initialEmailHtml)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [theme, setTheme] = useState(() => resolveActiveThemeCss(null))
  const previousChannel = useRef<Channel>(initialChannel)

  // Brand the web preview from the project's theme (same source the public site uses).
  useEffect(() => {
    let active = true
    fetch(`${apiBase}/api/_theme`)
      .then((res) => (res.ok ? res.json() : null))
      .then((apiTheme) => {
        if (active) setTheme(resolveActiveThemeCss(apiTheme))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [apiBase])

  const rssHtml = useMemo(() => (channel === "rss" ? renderPortableText(blocks, "rss") : ""), [blocks, channel])
  const webDoc = useMemo(() => {
    if (channel !== "web") return ""
    return buildWebPreviewDoc({
      body: renderPortableText(blocks, "web"),
      title,
      byline,
      leadsWithHero: Array.isArray(blocks) && blocks[0]?.type === "hero",
      variables: theme.variables,
      fontImport: theme.fontImport,
    })
  }, [blocks, channel, title, byline, theme])

  useEffect(() => {
    if (channel !== "email") {
      previousChannel.current = channel
      return
    }

    const controller = new AbortController()
    const delay = previousChannel.current === "email" ? 400 : 0
    previousChannel.current = channel
    const timer = window.setTimeout(async () => {
      setEmailLoading(true)
      setEmailError(false)
      try {
        const res = await adminApiFetch(apiBase, "/api/_email-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks, title, byline }),
          signal: controller.signal,
        })
        if (!res.ok) {
          setEmailError(true)
          return
        }
        const body = await res.json() as { html?: string }
        if (typeof body.html === "string") setEmailHtml(body.html)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setEmailError(true)
      } finally {
        if (!controller.signal.aborted) setEmailLoading(false)
      }
    }, delay)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [apiBase, blocks, byline, channel, title])

  return (
    <div className="cn-mirror">
      <div className="cn-mirror-head">
        <span className="cn-mirror-title">Channel mirror · live</span>
        <div className="cn-mirror-tabs" role="tablist">
          {(["web", "email", "rss"] as Channel[]).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={channel === candidate}
              className={channel === candidate ? "cn-tab cn-tab-on" : "cn-tab"}
              onClick={() => setChannel(candidate)}
            >
              {candidate === "web" ? "Web" : candidate === "email" ? "Email" : "RSS"}
            </button>
          ))}
        </div>
      </div>
      <div className="cn-mirror-scroll">
        {channel === "web" ? (
          <iframe className="cn-mirror-web-frame" title="Web preview" srcDoc={webDoc} />
        ) : channel === "email" ? (
          emailHtml ? (
            <iframe className="cn-mirror-email-frame" title="Email preview" srcDoc={emailHtml} />
          ) : (
            <div className="cn-mirror-loading">{emailLoading && !emailError ? "Rendering..." : "Email preview unavailable"}</div>
          )
        ) : (
          <article className="cn-render" data-channel="rss">
            <h1 className="cn-render-title">{title}</h1>
            {byline && <p className="cn-render-byline">{byline}</p>}
            <div dangerouslySetInnerHTML={{ __html: rssHtml }} />
          </article>
        )}
      </div>
    </div>
  )
}
