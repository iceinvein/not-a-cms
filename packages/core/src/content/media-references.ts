import type { CollectionDef } from "../types"

export type MediaReference = { assetId: string; field: string; label: string }

function label(doc: Record<string, unknown>): string {
  return String(doc.title || doc.name || doc.slug || doc.id || "")
}

function collectRichTextMediaIds(value: unknown, out: Set<string>): void {
  let blocks: unknown = value
  if (typeof blocks === "string") {
    try {
      blocks = JSON.parse(blocks)
    } catch {
      return
    }
  }
  walk(blocks, out)
}

function walk(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out)
    return
  }
  if (!node || typeof node !== "object") return
  const block = node as Record<string, unknown>

  if (block.type === "image") {
    const id = block.id ?? block.mediaId
    if (id) out.add(String(id))
    return
  }
  if (block.type === "gallery" && Array.isArray(block.images)) {
    for (const image of block.images) {
      if (image && typeof image === "object") {
        const id =
          (image as Record<string, unknown>).id ?? (image as Record<string, unknown>).mediaId
        if (id) out.add(String(id))
      }
    }
    return
  }

  for (const value of Object.values(block)) {
    if (Array.isArray(value) || (value && typeof value === "object")) walk(value, out)
  }
}

export function extractMediaReferences(
  collection: CollectionDef,
  doc: Record<string, unknown>,
): MediaReference[] {
  const refs: MediaReference[] = []
  const lbl = label(doc)

  for (const [name, fieldDef] of Object.entries(collection.fields)) {
    if (fieldDef.type === "media") {
      const value = doc[name]
      if (typeof value === "string" && value) refs.push({ assetId: value, field: name, label: lbl })
    } else if (fieldDef.type === "richText") {
      const ids = new Set<string>()
      collectRichTextMediaIds(doc[name], ids)
      for (const assetId of ids) refs.push({ assetId, field: name, label: lbl })
    }
  }

  return refs
}
