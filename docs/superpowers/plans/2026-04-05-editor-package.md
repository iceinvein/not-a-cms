# Editor Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `@not-a-cms/editor` package — a React component library providing a Tiptap-based editor with slash commands, bubble menu, Portable Text serialization, custom block API, and Y.js collaboration.

**Architecture:** React component library built on Tiptap v3 + ProseMirror. Exports a composable `<Editor />` component and a `defineBlock()` API for custom blocks. Content serializes bidirectionally between Tiptap JSON and Portable Text format. Y.js integration for real-time collaboration connects to the server package's WebSocket endpoint.

**Tech Stack:** Tiptap v3, React 19, ProseMirror (via @tiptap/pm), Y.js, @tiptap/suggestion (slash commands), @floating-ui/dom (bubble menu)

---

## File Structure

```
packages/editor/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                      Public API re-exports
│   ├── editor.tsx                    Main <Editor /> React component
│   ├── extensions/
│   │   ├── slash-command.ts          Slash command extension (/ menu)
│   │   ├── slash-command-list.tsx    Slash menu popup React component
│   │   └── slash-render.tsx         Suggestion render bridge (ReactRenderer + popup)
│   ├── menus/
│   │   └── bubble-menu.tsx          Contextual toolbar on text selection
│   ├── blocks/
│   │   ├── define-block.ts          defineBlock() API for custom blocks
│   │   ├── callout.ts               Callout block extension
│   │   ├── callout-view.tsx         Callout React NodeView component
│   │   └── index.ts                 Built-in block re-exports
│   ├── portable-text/
│   │   ├── to-portable-text.ts      Tiptap JSON → Portable Text
│   │   ├── from-portable-text.ts    Portable Text → Tiptap JSON
│   │   └── index.ts                 Re-exports
│   └── collaboration/
│       ├── provider.tsx              Y.js provider React component/hook
│       └── index.ts                 Re-exports
└── test/
    ├── portable-text/
    │   ├── to-portable-text.test.ts
    │   └── from-portable-text.test.ts
    ├── blocks/
    │   └── define-block.test.ts
    └── extensions/
        └── slash-command.test.ts
```

---

## Task 1: Editor Package Scaffolding

**Files:**
- Create: `packages/editor/package.json`
- Create: `packages/editor/tsconfig.json`

- [ ] **Step 1: Create packages/editor/package.json**

- [ ] **Step 2: Create packages/editor/tsconfig.json** extending root, adding `"jsx": "react-jsx"` for React JSX transform

- [ ] **Step 3: Run bun install from monorepo root**

Run: `cd /Users/dikrana/Documents/workspace/not-a-cms && bun install`
Expected: Clean install, all Tiptap packages resolve

- [ ] **Step 4: Commit**

```bash
git add packages/editor/package.json packages/editor/tsconfig.json
git commit -m "chore(editor): scaffold editor package with Tiptap v3 dependencies"
```

### Package.json contents

```json
{
  "name": "@not-a-cms/editor",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./blocks": "./src/blocks/index.ts",
    "./portable-text": "./src/portable-text/index.ts",
    "./collaboration": "./src/collaboration/index.ts"
  },
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  },
  "dependencies": {
    "@tiptap/react": "^3.0.0",
    "@tiptap/pm": "^3.0.0",
    "@tiptap/starter-kit": "^3.0.0",
    "@tiptap/extensions": "^3.0.0",
    "@tiptap/extension-typography": "^3.0.0",
    "@tiptap/extension-collaboration": "^3.0.0",
    "@tiptap/extension-collaboration-caret": "^3.0.0",
    "@tiptap/suggestion": "^3.0.0",
    "@floating-ui/dom": "^1.6.0",
    "yjs": "^13.6.0",
    "y-websocket": "^2.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

### tsconfig.json contents

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
}
```

---

## Task 2: Portable Text Serialization (Tiptap JSON to Portable Text)

**Files:**
- Create: `packages/editor/src/portable-text/to-portable-text.ts`
- Test: `packages/editor/test/portable-text/to-portable-text.test.ts`

This is the most critical piece — it converts Tiptap's internal JSON format to our storage format.

- [ ] **Step 1: Write failing test for toPortableText**

Test cases:
1. Converts a paragraph with plain text
2. Converts a paragraph with bold and italic marks
3. Converts a heading with level attribute
4. Converts a blockquote
5. Converts a bullet list
6. Converts a code block with language
7. Converts a horizontal rule (divider)
8. Handles empty document
9. Preserves link marks with href

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement toPortableText**

The function takes a Tiptap JSON document (`{ type: "doc", content: [...] }`) and returns a Portable Text array (`[{ type: "paragraph", children: [...] }, ...]`).

Mapping:
- `doc.content` → flat array of blocks
- `paragraph` → `{ type: "paragraph", children: [...textNodes] }`
- `heading` → `{ type: "heading", level: attrs.level, children: [...textNodes] }`
- `blockquote` → `{ type: "blockquote", children: [...] }` (flatten nested paragraphs)
- `bulletList` / `orderedList` → `{ type: "bulletList"/"orderedList", items: [...] }`
- `codeBlock` → `{ type: "codeBlock", language: attrs.language, code: textContent }`
- `horizontalRule` → `{ type: "divider" }`
- Text nodes: `{ type: "text", value: text }` with `marks` array from Tiptap marks
- Mark mapping: `bold` → `"bold"`, `italic` → `"italic"`, `code` → `"code"`, `link` → `{ type: "link", href: attrs.href }`

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(editor): add Tiptap JSON to Portable Text serialization"
```

---

## Task 3: Portable Text to Tiptap JSON (reverse direction)

**Files:**
- Create: `packages/editor/src/portable-text/from-portable-text.ts`
- Create: `packages/editor/src/portable-text/index.ts`
- Test: `packages/editor/test/portable-text/from-portable-text.test.ts`

- [ ] **Step 1: Write failing test for fromPortableText**

Mirror the toPortableText tests — convert Portable Text back to Tiptap JSON and verify round-trip fidelity.

Test cases:
1. Converts a paragraph with plain text back to Tiptap JSON
2. Converts marks (bold, italic, link) back
3. Converts heading back with level
4. Converts blockquote back
5. Converts bullet/ordered list back
6. Converts code block back with language
7. Converts divider back to horizontalRule
8. Round-trip test: toPortableText(fromPortableText(pt)) === pt

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement fromPortableText**

Takes a Portable Text array and returns Tiptap JSON `{ type: "doc", content: [...] }`.

Reverse the mapping from Task 2.

- [ ] **Step 4: Create portable-text/index.ts re-export**

```typescript
export { toPortableText } from "./to-portable-text"
export { fromPortableText } from "./from-portable-text"
```

- [ ] **Step 5: Run test to verify it passes**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(editor): add Portable Text to Tiptap JSON deserialization"
```

---

## Task 4: Define Block API

**Files:**
- Create: `packages/editor/src/blocks/define-block.ts`
- Test: `packages/editor/test/blocks/define-block.test.ts`

- [ ] **Step 1: Write failing test for defineBlock**

Test cases:
1. defineBlock returns a Tiptap Node extension with the correct name
2. The extension has the specified attributes from schema
3. The extension belongs to the 'block' group
4. toPortableText function is stored on the definition
5. Multiple blocks can be defined without conflicts

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement defineBlock**

```typescript
import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { ComponentType } from "react"

type BlockSchema = Record<string, {
  type: "text" | "number" | "boolean" | "select"
  default?: unknown
  options?: string[]
}>

type BlockDefinition = {
  name: string
  label: string
  icon?: string
  group?: string
  schema: BlockSchema
  editor: ComponentType<any>
  toPortableText?: (attrs: Record<string, unknown>) => Record<string, unknown>
}

export function defineBlock(def: BlockDefinition) {
  const extension = Node.create({
    name: def.name,
    group: "block",
    atom: true,  // not editable inline — has its own React NodeView
    
    addAttributes() {
      const attrs: Record<string, any> = {}
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

  return {
    ...def,
    extension,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(editor): add defineBlock API for custom editor blocks"
```

---

## Task 5: Callout Block (first built-in custom block)

**Files:**
- Create: `packages/editor/src/blocks/callout.ts`
- Create: `packages/editor/src/blocks/callout-view.tsx`
- Create: `packages/editor/src/blocks/index.ts`

- [ ] **Step 1: Create the callout Tiptap extension**

A Node extension with:
- name: "callout"
- group: "block"
- content: "inline*" (allows text inside)
- attributes: `variant` (default "info", options: "info", "warning", "success", "error")
- parseHTML: `div[data-callout]`
- React NodeView via ReactNodeViewRenderer

- [ ] **Step 2: Create the callout React NodeView component**

Uses `NodeViewWrapper` and `NodeViewContent` from `@tiptap/react`. Shows a variant selector (dropdown or buttons) and editable content area.

- [ ] **Step 3: Create blocks/index.ts re-export**

```typescript
export { CalloutExtension } from "./callout"
export { CalloutView } from "./callout-view"
export { defineBlock } from "./define-block"
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(editor): add callout block extension with React NodeView"
```

---

## Task 6: Slash Command Extension

**Files:**
- Create: `packages/editor/src/extensions/slash-command.ts`
- Create: `packages/editor/src/extensions/slash-command-list.tsx`
- Create: `packages/editor/src/extensions/slash-render.tsx`
- Test: `packages/editor/test/extensions/slash-command.test.ts`

- [ ] **Step 1: Write failing test for slash command items filtering**

Test the command list filtering logic (the non-React part):
1. filterCommands("") returns all commands
2. filterCommands("head") returns heading commands
3. filterCommands("xyz") returns empty array
4. Default commands include: Heading 1, Heading 2, Heading 3, Bullet List, Ordered List, Blockquote, Code Block, Divider, Callout

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement slash command extension**

The extension uses `@tiptap/suggestion` to create a `/` triggered menu. It exports:
- `SlashExtension` — the Tiptap extension
- `DEFAULT_COMMANDS` — the default slash command items
- `filterCommands(query, commands)` — filter function (testable without React)

Each command item: `{ title, description, icon?, group?, command: (editor, range) => void }`

The `command` function uses `editor.chain().focus().deleteRange(range).setHeading/toggleBulletList/etc.run()`.

- [ ] **Step 4: Create slash-command-list.tsx** — React component for the popup menu. Uses forwardRef + useImperativeHandle for keyboard navigation (ArrowUp, ArrowDown, Enter). Renders items with title and description.

- [ ] **Step 5: Create slash-render.tsx** — Bridge between Tiptap Suggestion and React. Uses `ReactRenderer` from `@tiptap/react` and DOM positioning (create a positioned div, use `@floating-ui/dom` for placement near the cursor).

- [ ] **Step 6: Run test to verify it passes**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(editor): add slash command extension with filterable menu"
```

---

## Task 7: Bubble Menu (Contextual Toolbar)

**Files:**
- Create: `packages/editor/src/menus/bubble-menu.tsx`

- [ ] **Step 1: Create the BubbleToolbar component**

A React component that wraps Tiptap's `BubbleMenu` from `@tiptap/react/menus`. Shows formatting buttons on text selection:
- Bold (toggleBold)
- Italic (toggleItalic)
- Code (toggleCode)
- Link (setLink — prompt for URL)
- Heading 1/2/3 (setHeading)

Uses `useEditorState` to reactively track which marks are active.

`shouldShow` — only when there's a real text selection (from !== to) and not inside a code block.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(editor): add bubble menu toolbar for text selection"
```

---

## Task 8: Y.js Collaboration Provider

**Files:**
- Create: `packages/editor/src/collaboration/provider.tsx`
- Create: `packages/editor/src/collaboration/index.ts`

- [ ] **Step 1: Create useCollaboration hook**

A React hook that:
- Creates a Y.Doc and WebsocketProvider
- Returns the ydoc, provider, and Tiptap extensions array (Collaboration + CollaborationCaret)
- Accepts config: `{ serverUrl, documentId, user: { name, color } }`
- Cleans up (destroys provider and ydoc) on unmount
- Disables StarterKit's undoRedo when collaboration is active

```typescript
export function useCollaboration(config: CollabConfig) {
  const ydoc = useRef(new Y.Doc()).current
  const provider = useRef(
    new WebsocketProvider(config.serverUrl, config.documentId, ydoc)
  ).current

  useEffect(() => {
    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [])

  const extensions = useMemo(() => [
    Collaboration.configure({ document: ydoc }),
    CollaborationCaret.configure({
      provider,
      user: config.user,
    }),
  ], [])

  return { ydoc, provider, extensions }
}
```

- [ ] **Step 2: Create collaboration/index.ts re-export**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(editor): add Y.js collaboration hook and provider"
```

---

## Task 9: Main Editor Component

**Files:**
- Create: `packages/editor/src/editor.tsx`

- [ ] **Step 1: Create the Editor component**

The main React component that assembles everything:

```tsx
type EditorProps = {
  content?: PortableTextBlock[]  // initial content as Portable Text
  onChange?: (content: PortableTextBlock[]) => void
  placeholder?: string
  editable?: boolean
  collaboration?: { serverUrl: string; documentId: string; user: { name: string; color: string } }
  extensions?: any[]  // additional Tiptap extensions (custom blocks, etc.)
}
```

The component:
1. Converts initial Portable Text content to Tiptap JSON via fromPortableText
2. Sets up useEditor with StarterKit (undoRedo disabled if collab), Placeholder, Typography, SlashExtension, CalloutExtension, and any extra extensions
3. If collaboration config is provided, adds Y.js extensions via useCollaboration
4. On content change, converts Tiptap JSON to Portable Text via toPortableText and calls onChange
5. Renders BubbleToolbar + EditorContent

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(editor): add main Editor component assembling all extensions"
```

---

## Task 10: Public API and Full Test Run

**Files:**
- Create: `packages/editor/src/index.ts`

- [ ] **Step 1: Create index.ts with all public exports**

```typescript
// Main component
export { Editor, type EditorProps } from "./editor"

// Block API
export { defineBlock } from "./blocks/define-block"
export { CalloutExtension } from "./blocks/callout"

// Portable Text
export { toPortableText } from "./portable-text/to-portable-text"
export { fromPortableText } from "./portable-text/from-portable-text"

// Collaboration
export { useCollaboration } from "./collaboration/provider"

// Extensions (for advanced users who want to compose their own editor)
export { SlashExtension, DEFAULT_COMMANDS } from "./extensions/slash-command"
```

- [ ] **Step 2: Run all editor tests**

Run: `cd packages/editor && bun test`
Expected: All tests pass

- [ ] **Step 3: Run full monorepo tests**

Run: `cd /Users/dikrana/Documents/workspace/not-a-cms && bun run test`
Expected: All tests pass across core, server, and editor packages

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(editor): add public API exports"
```

---

## Coverage vs Spec

| Spec Requirement | Task | Status |
|---|---|---|
| Tiptap/ProseMirror editor | Task 9 | Covered |
| Slash commands (/) | Task 6 | Covered |
| Markdown shortcuts | Task 9 (StarterKit includes these) | Covered |
| Contextual toolbar on selection | Task 7 | Covered |
| Portable Text serialization | Tasks 2-3 | Covered |
| Custom block API (defineBlock) | Task 4 | Covered |
| Callout block | Task 5 | Covered |
| Y.js collaboration | Task 8 | Covered |
| URL auto-embed | Deferred | Future (requires oEmbed fetching) |
| Drag handles | Deferred | Future |
| Image/Gallery/Embed blocks | Deferred | Future (need media upload integration) |
| Code block with syntax highlighting | Deferred | Future (need Shiki integration) |
| Table block | Deferred | Future |
| Live preview | Deferred | Requires renderer package |

## Notes for Implementers

- **Tiptap v3 breaking changes:** `undoRedo` replaces `history` in StarterKit config. `collaboration-caret` replaces `collaboration-cursor`. BubbleMenu imports from `@tiptap/react/menus`. `getPos()` can return undefined.
- **Testing React components:** Most tests focus on the non-React logic (serialization, filtering, block definitions). React component rendering tests require a DOM environment — use `bun test` with `happy-dom` or skip to integration testing.
- **Portable Text format:** Our PT format is simpler than Sanity's (no `_key` or `_type` prefix, no separate `markDefs`). Marks are inline on text nodes. This is intentional — we can always add complexity later.
