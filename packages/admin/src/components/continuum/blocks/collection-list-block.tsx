import { NodeViewWrapper } from "@tiptap/react"
import { Checkbox } from "../../ui/Checkbox"
import { Select } from "../../ui/Select"

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
      <label className="cn-section-control" htmlFor="cn-collection-list-layout">
        Layout
        <Select
          id="cn-collection-list-layout"
          value={layout}
          onValueChange={(value) => updateAttributes({ layout: value })}
          ariaLabel="Layout"
          options={[
            { value: "grid", label: "Grid" },
            { value: "list", label: "List" },
            { value: "cards", label: "Cards" },
          ]}
        />
      </label>
      <div className="cn-toggle-row">
        <Checkbox
          label="Show cover image"
          checked={showCover}
          onCheckedChange={(value) => updateAttributes({ showCover: value })}
        />
        <Checkbox
          label="Show excerpt"
          checked={showExcerpt}
          onCheckedChange={(value) => updateAttributes({ showExcerpt: value })}
        />
        <Checkbox
          label="Show date"
          checked={showDate}
          onCheckedChange={(value) => updateAttributes({ showDate: value })}
        />
      </div>
    </NodeViewWrapper>
  )
}
