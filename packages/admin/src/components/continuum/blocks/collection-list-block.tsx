import { NodeViewWrapper } from "@tiptap/react"

/**
 * Collection list block: shows config for a live collection query.
 * No fetching here; data is resolved at render time by the public renderer.
 */
export function CollectionListBlockView({ node, updateAttributes }: any) {
  const collection = String(node.attrs.collection ?? "blog_post")
  const limit = Number(node.attrs.limit ?? 3)
  const filterTag = String(node.attrs.filterTag ?? "")
  const layout = String(node.attrs.layout ?? "grid")
  const showCover = node.attrs.showCover !== false
  const showExcerpt = node.attrs.showExcerpt !== false
  const showDate = node.attrs.showDate !== false
  const heading = String(node.attrs.heading ?? "")

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <span className="cn-block-label">collection list</span>
      <label className="cn-section-control">
        Heading
        <input
          className="cn-block-input"
          value={heading}
          placeholder="Section heading (optional)"
          onChange={(e) => updateAttributes({ heading: e.target.value })}
        />
      </label>
      <label className="cn-section-control">
        Collection
        <input
          className="cn-block-input"
          value={collection}
          placeholder="e.g. blog_post"
          onChange={(e) => updateAttributes({ collection: e.target.value })}
        />
      </label>
      <label className="cn-section-control">
        Limit
        <input
          type="number"
          className="cn-block-input"
          value={limit}
          min={1}
          max={50}
          onChange={(e) => updateAttributes({ limit: Number(e.target.value) })}
        />
      </label>
      <label className="cn-section-control">
        Filter by tag
        <input
          className="cn-block-input"
          value={filterTag}
          placeholder="Tag name (optional)"
          onChange={(e) => updateAttributes({ filterTag: e.target.value })}
        />
      </label>
      <label className="cn-section-control">
        Layout
        <select value={layout} onChange={(e) => updateAttributes({ layout: e.target.value })}>
          <option value="grid">Grid</option>
          <option value="list">List</option>
          <option value="cards">Cards</option>
        </select>
      </label>
      <div className="cn-section-control">
        <label>
          <input
            type="checkbox"
            checked={showCover}
            onChange={(e) => updateAttributes({ showCover: e.target.checked })}
          />
          {" "}Show cover image
        </label>
        <label>
          <input
            type="checkbox"
            checked={showExcerpt}
            onChange={(e) => updateAttributes({ showExcerpt: e.target.checked })}
          />
          {" "}Show excerpt
        </label>
        <label>
          <input
            type="checkbox"
            checked={showDate}
            onChange={(e) => updateAttributes({ showDate: e.target.checked })}
          />
          {" "}Show date
        </label>
      </div>
    </NodeViewWrapper>
  )
}
