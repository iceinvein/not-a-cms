import { useMemo, useState } from "react"
import { renderPortableText } from "@not-a-cms/renderer/web"

type Channel = "web" | "email" | "rss"

export function ChannelMirror({
  blocks,
  title,
  byline,
}: {
  blocks: any[]
  title: string
  byline?: string
}) {
  const [channel, setChannel] = useState<Channel>("web")
  const bodyHtml = useMemo(
    () => renderPortableText(blocks, channel === "rss" ? "rss" : "web"),
    [blocks, channel],
  )

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
        <article className="cn-render" data-channel={channel}>
          <h1 className="cn-render-title">{title}</h1>
          {byline && <p className="cn-render-byline">{byline}</p>}
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>
        {channel === "email" && (
          <p className="cn-mirror-note">Email is an approximation; final styling is rendered server-side.</p>
        )}
      </div>
    </div>
  )
}
