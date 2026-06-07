import type { CollectionDef } from "../types"
import { slugify } from "./slugify"

/**
 * Fill slug fields from their configured source field when the slug is empty.
 *
 * Runs on create and update so a document authored without an explicit slug
 * (the common case, since editors rarely expose the slug field) still gets a
 * usable URL. An explicitly provided slug is always respected. Returns a new
 * document; the input is not mutated.
 */
export function applyGeneratedSlugs(
  collection: CollectionDef,
  doc: Record<string, unknown>,
): Record<string, unknown> {
  let result = doc
  for (const [name, fieldDef] of Object.entries(collection.fields)) {
    if (fieldDef.type !== "slug") continue

    const current = result[name]
    const hasValue = typeof current === "string" && current.trim() !== ""
    if (hasValue) continue

    const source = result[fieldDef.from]
    if (typeof source !== "string" || source.trim() === "") continue

    const generated = slugify(source)
    if (!generated) continue

    if (result === doc) result = { ...doc }
    result[name] = generated
  }
  return result
}
