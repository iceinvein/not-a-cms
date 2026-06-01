import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { ComponentType } from "react"

export type BlockFieldDef = {
  type: "text" | "number" | "boolean" | "select" | "media" | "relation" | "array"
  default?: unknown
  options?: string[]
  target?: string
  accept?: string[]
}

export type BlockSchema = Record<string, BlockFieldDef>

export type BlockDefinition = {
  name: string
  label: string
  icon?: string
  group?: string
  schema: BlockSchema
  editor: ComponentType<any>
  toPortableText?: (attrs: Record<string, unknown>) => Record<string, unknown>
}

export type DefinedBlock = BlockDefinition & {
  extension: ReturnType<typeof Node.create>
}

export function defineBlock(def: BlockDefinition): DefinedBlock {
  const extension = Node.create({
    name: def.name,
    group: "block",
    atom: true,

    addAttributes() {
      const attrs: Record<string, { default: unknown }> = {}
      for (const [key, fieldDef] of Object.entries(def.schema)) {
        attrs[key] = { default: fieldDef.default ?? null }
      }
      return attrs
    },

    parseHTML() {
      return [{ tag: `div[data-block="${def.name}"]` }]
    },

    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes({ "data-block": def.name }, HTMLAttributes)]
    },

    addNodeView() {
      return ReactNodeViewRenderer(def.editor)
    },
  })

  return { ...def, extension }
}
