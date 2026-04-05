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
  content: TiptapNode[]
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

function convertPTMark(mark: PTMark): TiptapMark {
  if (typeof mark === "string") {
    return { type: mark }
  }
  // Complex mark: extract type, put the rest into attrs
  const { type, ...rest } = mark
  return { type, attrs: rest }
}

function convertPTTextNode(node: PTTextNode): TiptapNode {
  const result: TiptapNode = {
    type: "text",
    text: node.value,
  }
  if (node.marks && node.marks.length > 0) {
    result.marks = node.marks.map(convertPTMark)
  }
  return result
}

function convertPTChildren(children: PTTextNode[]): TiptapNode[] {
  return children.map(convertPTTextNode)
}

function convertPTBlock(block: PTBlock): TiptapNode | null {
  switch (block.type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: convertPTChildren(block.children ?? []),
      }

    case "heading":
      return {
        type: "heading",
        attrs: { level: block.level ?? 1 },
        content: convertPTChildren(block.children ?? []),
      }

    case "blockquote":
      return {
        type: "blockquote",
        content: (block.children as PTBlock[]).map(convertPTBlock).filter((n): n is TiptapNode => n !== null),
      }

    case "bulletList":
    case "orderedList": {
      const listItems: TiptapNode[] = (block.items as PTBlock[][]).map((itemBlocks) => ({
        type: "listItem",
        content: itemBlocks.map(convertPTBlock).filter((n): n is TiptapNode => n !== null),
      }))
      return {
        type: block.type,
        content: listItems,
      }
    }

    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: block.language ?? null },
        content: [{ type: "text", text: block.code ?? "" }],
      }

    case "divider":
      return { type: "horizontalRule" }

    default:
      return null
  }
}

export function fromPortableText(blocks: PTBlock[]): TiptapDoc {
  return {
    type: "doc",
    content: blocks.map(convertPTBlock).filter((n): n is TiptapNode => n !== null),
  }
}
