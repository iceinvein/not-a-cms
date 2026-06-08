import { NodeViewWrapper } from "@tiptap/react"
import { MediaPicker } from "./media-picker"

type LogoItem = { url: string; mediaId: string; alt: string }

function logoItems(value: unknown): LogoItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const logo = (item ?? {}) as Partial<LogoItem>
    return {
      url: String(logo.url ?? ""),
      mediaId: String(logo.mediaId ?? ""),
      alt: String(logo.alt ?? ""),
    }
  })
}

/**
 * Logo cloud section block: an optional eyebrow label followed by a row of partner
 * or customer logos picked from the Vault. Each logo is a separate media item.
 */
export function LogoCloudBlockView({ node, updateAttributes }: any) {
  const eyebrow = String(node.attrs.eyebrow ?? "")
  const logos = logoItems(node.attrs.logos)

  const updateLogos = (next: LogoItem[]) => updateAttributes({ logos: next })

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <input
        className="cn-block-input"
        value={eyebrow}
        placeholder="Eyebrow label (e.g. Trusted by)"
        onChange={(event) => updateAttributes({ eyebrow: event.target.value })}
      />
      <div className="cn-feature-cards">
        {logos.map((logo, index) => (
          <div key={index} className="cn-feature-card">
            <MediaPicker
              value={logo.url}
              chooseLabel="Choose logo"
              onSelect={(item) =>
                updateLogos(
                  logos.map((l, i) =>
                    i === index ? { url: item.url, mediaId: item.id, alt: l.alt } : l,
                  ),
                )
              }
              onClear={() =>
                updateLogos(
                  logos.map((l, i) => (i === index ? { url: "", mediaId: "", alt: l.alt } : l)),
                )
              }
            />
            <input
              className="cn-block-input"
              value={logo.alt}
              placeholder="Alt text (company name)"
              onChange={(event) =>
                updateLogos(
                  logos.map((l, i) => (i === index ? { ...l, alt: event.target.value } : l)),
                )
              }
            />
            <button
              type="button"
              className="cn-block-action"
              onClick={() => updateLogos(logos.filter((_, i) => i !== index))}
            >
              Remove logo
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="cn-block-action cn-block-cta"
        onClick={() => updateLogos([...logos, { url: "", mediaId: "", alt: "" }])}
      >
        + Add logo
      </button>
      <span className="cn-block-label">logo cloud</span>
    </NodeViewWrapper>
  )
}
