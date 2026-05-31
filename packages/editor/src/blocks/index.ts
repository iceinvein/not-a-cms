import type { DefinedBlock } from "./define-block"

export { defineBlock } from "./define-block"
export type { BlockDefinition, BlockFieldDef, BlockSchema, DefinedBlock } from "./define-block"
export { CalloutExtension } from "./callout"
export { CalloutView } from "./callout-view"

type EditorBlockManifest = {
  blocks?: DefinedBlock[]
  editor?: {
    blocks?: DefinedBlock[]
  }
}

export function resolveEditorBlocksFromExtensions(extensions: EditorBlockManifest[] = []): DefinedBlock[] {
  const blocks: DefinedBlock[] = []
  const seen = new Set<string>()

  for (const extension of extensions) {
    for (const block of [...(extension.blocks ?? []), ...(extension.editor?.blocks ?? [])]) {
      if (seen.has(block.name)) continue
      seen.add(block.name)
      blocks.push(block)
    }
  }

  return blocks
}

export function collectManifestBlockExtensions(extensions: EditorBlockManifest[] = []) {
  return resolveEditorBlocksFromExtensions(extensions).map((block) => block.extension)
}
