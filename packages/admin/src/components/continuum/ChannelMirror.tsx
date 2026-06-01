import { useEffect, useMemo, useRef, useState } from "react"
import { renderPortableText } from "@not-a-cms/renderer/web"
import { adminApiFetch } from "../../lib/api"

type Channel = "web" | "email" | "rss"

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
  const previousChannel = useRef<Channel>(initialChannel)
  const bodyHtml = useMemo(
    () => channel === "email" ? "" : renderPortableText(blocks, channel === "rss" ? "rss" : "web"),
    [blocks, channel],
  )

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
        {channel === "email" ? (
          emailHtml ? (
            <iframe
              className="cn-mirror-email-frame"
              title="Email preview"
              srcDoc={emailHtml}
            />
          ) : (
            <div className="cn-mirror-loading">{emailLoading && !emailError ? "Rendering..." : "Email preview unavailable"}</div>
          )
        ) : (
          <article className="cn-render" data-channel={channel}>
            <h1 className="cn-render-title">{title}</h1>
            {byline && <p className="cn-render-byline">{byline}</p>}
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </article>
        )}
      </div>
    </div>
  )
}
