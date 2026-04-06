import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { CalloutView } from "./callout-view"

export const CalloutExtension = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-variant") || "info",
        renderHTML: (attrs: Record<string, any>) => ({ "data-variant": attrs.variant }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }]
  },

  renderHTML({ HTMLAttributes }: any) {
    return ["div", mergeAttributes({ "data-callout": "" }, HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})
