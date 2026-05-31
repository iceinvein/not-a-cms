// Main component
export { Editor, type EditorProps } from "./editor"

// Block API
export {
  collectManifestBlockExtensions,
  defineBlock,
  resolveEditorBlocksFromExtensions,
  type BlockDefinition,
  type BlockFieldDef,
  type BlockSchema,
  type DefinedBlock,
} from "./blocks"
export { CalloutExtension } from "./blocks/callout"

// Portable Text
export { toPortableText } from "./portable-text/to-portable-text"
export { fromPortableText } from "./portable-text/from-portable-text"

// Collaboration
export { useCollaboration, type CollabConfig, type CollabUser } from "./collaboration/provider"

// Extensions
export { SlashExtension, DEFAULT_COMMANDS, filterCommands } from "./extensions/slash-command"

// Menus
export { BubbleToolbar } from "./menus/bubble-menu"
