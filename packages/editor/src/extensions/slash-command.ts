import { Extension } from "@tiptap/core"
import Suggestion from "@tiptap/suggestion"
import type { Editor, Range } from "@tiptap/core"
import { renderSlashSuggestion } from "./slash-render"

export type SlashCommandItem = {
  title: string
  description: string
  icon?: string
  group?: string
  command: (editor: Editor, range: Range) => void
}

export const DEFAULT_COMMANDS: SlashCommandItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    group: "headings",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    group: "headings",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    group: "headings",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    description: "Create an unordered list",
    group: "lists",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Ordered List",
    description: "Create a numbered list",
    group: "lists",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Blockquote",
    description: "Add a quote block",
    group: "blocks",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setBlockquote().run(),
  },
  {
    title: "Code Block",
    description: "Insert a code block",
    group: "blocks",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "Insert a horizontal line",
    group: "blocks",
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
]

export function filterCommands(query: string, commands: SlashCommandItem[] = DEFAULT_COMMANDS): SlashCommandItem[] {
  if (!query) return commands
  const lower = query.toLowerCase()
  return commands.filter(
    (item) =>
      item.title.toLowerCase().includes(lower) ||
      item.description.toLowerCase().includes(lower)
  )
}

export const SlashExtension = Extension.create<{ commands: SlashCommandItem[] }>({
  name: "slashCommand",

  addOptions() {
    return { commands: DEFAULT_COMMANDS }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }: { query: string }) => filterCommands(query, this.options.commands),
        command: ({ editor, range, props }: any) => {
          props.command(editor, range)
        },
        render: renderSlashSuggestion,
      }),
    ]
  },
})
