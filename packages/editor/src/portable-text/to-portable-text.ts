type TiptapMark = {
  type: string
  attrs?: Record<string, any>
}

type TiptapNode = {
  type: string
  attrs?: Record<string, any>
  content?: TiptapNode[]
  text?: string
  marks?: TiptapMark[]
}

type TiptapDoc = {
  type: "doc"
  content?: TiptapNode[]
}

type PTMark = string | { type: string; [key: string]: any }

type PTTextNode = {
  type: "text"
  value: string
  marks?: PTMark[]
}

type PTBlock = {
  type: string
  [key: string]: any
}

const SIMPLE_MARKS = new Set(["bold", "italic", "code", "underline", "strike"])

function convertMark(mark: TiptapMark): PTMark {
  if (SIMPLE_MARKS.has(mark.type)) {
    return mark.type
  }
  // Complex mark: flatten attrs into the object
  return { type: mark.type, ...(mark.attrs ?? {}) }
}

function convertTextNode(node: TiptapNode): PTTextNode {
  const result: PTTextNode = {
    type: "text",
    value: node.text ?? "",
  }
  if (node.marks && node.marks.length > 0) {
    result.marks = node.marks.map(convertMark)
  }
  return result
}

function convertInlineContent(content: TiptapNode[] | undefined): Array<PTTextNode | { type: "break" }> {
  if (!content || content.length === 0) return []
  return content.map((node) => {
    if (node.type === "hardBreak") {
      return { type: "break" as const }
    }
    return convertTextNode(node)
  })
}

function convertBlock(node: TiptapNode): PTBlock | null {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        children: convertInlineContent(node.content),
      }

    case "heading":
      return {
        type: "heading",
        level: node.attrs?.level ?? 1,
        children: convertInlineContent(node.content),
      }

    case "blockquote":
      return {
        type: "blockquote",
        children: (node.content ?? []).map(convertBlock).filter((b): b is PTBlock => b !== null),
      }

    case "bulletList":
    case "orderedList": {
      const items = (node.content ?? []).map((listItem) =>
        (listItem.content ?? []).map(convertBlock).filter((b): b is PTBlock => b !== null)
      )
      return {
        type: node.type,
        items,
      }
    }

    case "codeBlock": {
      const code = (node.content ?? [])
        .filter((n) => n.type === "text")
        .map((n) => n.text ?? "")
        .join("")
      return {
        type: "codeBlock",
        language: node.attrs?.language ?? null,
        code,
      }
    }

    case "horizontalRule":
      return { type: "divider" }

    default:
      return null
  }
}

export function toPortableText(doc: TiptapDoc): PTBlock[] {
  if (!doc.content) return []
  return doc.content.map(convertBlock).filter((b): b is PTBlock => b !== null)
}
