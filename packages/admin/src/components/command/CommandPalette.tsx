import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Icon } from "../ui/Icon"
import { parseDocContext } from "../../lib/command/doc-context"
import {
  buildDoCommands,
  buildJumpCommands,
  rankCommands,
  type CommandRunContext,
  type CommandScope,
} from "../../lib/command/commands"
import { searchContent, type ContentHit } from "../../lib/command/content-search"

type CollectionLike = {
  name: string
  label?: string
  labels?: { singular: string; plural: string }
  fields?: Record<string, unknown>
}

type Props = {
  apiBase: string
  siteBase: string
  collections: CollectionLike[]
  pathname: string
  defaultOpen?: boolean
}

const SCOPES: { key: CommandScope; label: string }[] = [
  { key: "jump", label: "Jump to" },
  { key: "do", label: "Do" },
  { key: "find", label: "Find in content" },
  { key: "ask", label: "Ask" },
]

export function CommandPalette({ apiBase, siteBase, collections, pathname, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<CommandScope>("jump")
  const [active, setActive] = useState(0)
  const [hits, setHits] = useState<ContentHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const context = useMemo(() => parseDocContext(pathname), [pathname])
  const commands = useMemo(
    () => [...buildDoCommands(context), ...buildJumpCommands(collections)],
    [context, collections],
  )

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("nacms:command-open", onOpen)
    return () => window.removeEventListener("nacms:command-open", onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery("")
    setScope(context.documentId ? "do" : "jump")
    setActive(0)
    queueMicrotask(() => inputRef.current?.focus())
  }, [open, context.documentId])

  useEffect(() => {
    if (!open || (scope !== "find" && scope !== "ask")) return
    const handle = setTimeout(() => {
      searchContent(apiBase, collections, query).then(setHits).catch(() => setHits([]))
    }, 200)
    return () => clearTimeout(handle)
  }, [open, scope, query, apiBase, collections])

  const navigate = useCallback((href: string) => {
    window.location.href = href
  }, [])

  const notify = useCallback((message: string) => {
    if (typeof console !== "undefined") console.info(`[command] ${message}`)
  }, [])

  const runCtx: CommandRunContext = { apiBase, siteBase, context, navigate, notify }
  const visibleCommands = useMemo(() => {
    if (scope === "find" || scope === "ask") return []
    return rankCommands(query, commands.filter((c) => c.scope === scope))
  }, [commands, scope, query])

  const rows = scope === "find" || scope === "ask" ? hits : visibleCommands
  const rowCount = rows.length
  const close = useCallback(() => setOpen(false), [])

  const choose = useCallback(
    (index: number) => {
      if (scope === "find" || scope === "ask") {
        const hit = hits[index]
        if (hit) navigate(hit.href)
        return
      }

      const cmd = visibleCommands[index]
      if (!cmd) return
      if (cmd.href) navigate(cmd.href)
      else cmd.run?.(runCtx)
      close()
    },
    [scope, hits, visibleCommands, navigate, runCtx, close],
  )

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") return close()

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, Math.max(rowCount - 1, 0)))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === "Tab") {
      event.preventDefault()
      const order = SCOPES.map((s) => s.key)
      const offset = event.shiftKey ? order.length - 1 : 1
      const next = order[(order.indexOf(scope) + offset) % order.length]
      setScope(next)
      setActive(0)
    } else if (event.key === "Enter") {
      event.preventDefault()
      choose(active)
    }
  }

  if (!open) return null

  return (
    <div className="cmd-overlay" onClick={close} role="presentation">
      <div className="cmd-panel" onClick={(event) => event.stopPropagation()}>
        <div className="cmd-search">
          <Icon name="search" size={20} className="cmd-search-icon" />
          {context.documentId && <span className="cmd-ctx">{context.collection}</span>}
          <input
            ref={inputRef}
            className="cmd-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-listbox"
            aria-activedescendant={rowCount ? `cmd-row-${active}` : undefined}
            placeholder="Go anywhere, do anything..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
          <span className="cmd-esc">esc</span>
        </div>

        <div className="cmd-scopes" role="tablist">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={scope === s.key}
              className={scope === s.key ? "cmd-scope cmd-scope-on" : "cmd-scope"}
              onClick={() => {
                setScope(s.key)
                setActive(0)
              }}
            >
              {s.label}
              {s.key === "ask" && <span className="cmd-soon">full-text</span>}
            </button>
          ))}
        </div>

        <ul id="cmd-listbox" role="listbox" className="cmd-results">
          {rowCount === 0 && <li className="cmd-empty">No matches</li>}
          {scope !== "find" && scope !== "ask"
            ? visibleCommands.map((cmd, index) => (
                <li
                  key={cmd.id}
                  id={`cmd-row-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "cmd-row cmd-row-on" : "cmd-row"}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <Icon name={cmd.icon} size={16} className="cmd-row-icon" />
                  <span className="cmd-row-main">
                    <span className="cmd-row-title">{cmd.title}</span>
                    {cmd.sub && <span className="cmd-row-sub">{cmd.sub}</span>}
                  </span>
                  {cmd.hint && <span className="cmd-row-hint">{cmd.hint}</span>}
                </li>
              ))
            : hits.map((hit, index) => (
                <li
                  key={`${hit.collection}-${hit.documentId}`}
                  id={`cmd-row-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "cmd-row cmd-row-on" : "cmd-row"}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <Icon name="collection" size={16} className="cmd-row-icon" />
                  <span className="cmd-row-main">
                    <span className="cmd-row-title">{hit.title}</span>
                    <span className="cmd-row-sub">{hit.collectionLabel}</span>
                  </span>
                </li>
              ))}
        </ul>

        <div className="cmd-foot">
          <span><kbd>up/down</kbd> navigate</span>
          <span><kbd>enter</kbd> open</span>
          <span><kbd>tab</kbd> scope</span>
          <span className="cmd-brand">COMMAND DECK</span>
        </div>
      </div>
    </div>
  )
}
