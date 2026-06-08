import type { CollabConfig } from "@not-a-cms/editor"
import { Editor } from "@not-a-cms/editor"
import { brandCss, resolveActiveThemeCss } from "@not-a-cms/renderer/theme"
import { useEffect, useState } from "react"
import { continuumSlashCommands } from "../blocks"
import { scopeThemeVariables } from "./scope-theme"
import { visualBlocks } from "./visual-blocks"

type PortableTextBlock = { type: string; [key: string]: unknown }

type Props = {
  content?: PortableTextBlock[]
  onChange?: (blocks: PortableTextBlock[]) => void
  apiBase?: string
  collaboration?: CollabConfig
}

/**
 * Visual editing canvas: the same Tiptap Editor and Portable Text body as Document
 * mode, rendered as a brand-styled page. The site's theme variables are fetched from
 * /api/_theme (same source as the channel mirror) and scoped to `.cn-visual` so they
 * cannot leak into the admin shell; brandCss is class-scoped already. Sections render
 * read-only via the visual block set; prose stays natively editable.
 */
export function VisualCanvas({ content, onChange, apiBase = "", collaboration }: Props) {
  const [theme, setTheme] = useState(() => resolveActiveThemeCss(null))

  useEffect(() => {
    let active = true
    fetch(`${apiBase}/api/_theme`)
      .then((res) => (res.ok ? res.json() : null))
      .then((apiTheme) => {
        if (active) setTheme(resolveActiveThemeCss(apiTheme))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [apiBase])

  const scopedVariables = scopeThemeVariables(theme.variables, ".cn-visual")

  return (
    <div className="cn-visual">
      <style>{scopedVariables}</style>
      <style>{brandCss}</style>
      {theme.fontImport ? <link rel="stylesheet" href={theme.fontImport} /> : null}
      <article className="cn-visual-page prose">
        <Editor
          content={content}
          blocks={visualBlocks}
          slashCommands={continuumSlashCommands}
          placeholder="Type / to insert a section, or just start writing..."
          collaboration={collaboration}
          onChange={onChange}
        />
      </article>
    </div>
  )
}
