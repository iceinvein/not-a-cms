import { defineBlock, type DefinedBlock, type SlashCommandItem } from "@not-a-cms/editor"
import { AuthorBlockView } from "./author-block"
import { GalleryBlockView } from "./gallery-block"
import { SeoBlockView } from "./seo-block"

export const continuumBlocks: DefinedBlock[] = [
  defineBlock({
    name: "author",
    label: "Author",
    schema: {
      name: { type: "text", default: "" },
      role: { type: "text", default: "" },
    },
    editor: AuthorBlockView,
  }),
  defineBlock({
    name: "gallery",
    label: "Gallery",
    schema: {
      images: { type: "array", default: [] },
    },
    editor: GalleryBlockView,
  }),
  defineBlock({
    name: "seo",
    label: "SEO & meta",
    schema: {
      metaTitle: { type: "text", default: "" },
      metaDescription: { type: "text", default: "" },
    },
    editor: SeoBlockView,
  }),
]

const insert = (name: string) => (editor: any, range: any) =>
  editor.chain().focus().deleteRange(range).insertContent({ type: name }).run()

export const continuumSlashCommands: SlashCommandItem[] = [
  { title: "Author", description: "Structured byline", group: "fields", command: insert("author") },
  { title: "Gallery", description: "Images from the library", group: "fields", command: insert("gallery") },
  { title: "SEO & meta", description: "Title, description", group: "fields", command: insert("seo") },
]
