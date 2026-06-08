import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { SlashCommandItem } from "./slash-command"

export type SlashCommandListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

type Props = {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

function groupLabel(group?: string): string {
  if (!group) return "Blocks"
  return group.charAt(0).toUpperCase() + group.slice(1)
}

/** A short glyph for the icon chip: the item's own icon, or its leading letter. */
function itemGlyph(item: SlashCommandItem): string {
  if (item.icon) return item.icon
  const letter = item.title.match(/[a-z0-9]/i)
  return (letter?.[0] ?? "•").toUpperCase()
}

export const SlashCommandList = forwardRef<SlashCommandListRef, Props>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

    // biome-ignore lint/correctness/useExhaustiveDependencies: reset the highlight to the top whenever the filtered item set changes, so items must remain a trigger
    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    // Keep the highlighted row visible as arrow keys move past the fold.
    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" })
    }, [selectedIndex])

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }) {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length)
          return true
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex]
          if (item) command(item)
          return true
        }
        return false
      },
    }))

    if (!items.length) {
      return (
        <div className="cn-slash">
          <div className="cn-slash-empty">No matching blocks</div>
        </div>
      )
    }

    // Group by `item.group`, preserving first-appearance order. The button index
    // `i` stays the flat index into `items`, so keyboard nav and clicks align.
    const groups: string[] = []
    for (const item of items) {
      const key = item.group ?? "__default"
      if (!groups.includes(key)) groups.push(key)
    }

    return (
      <div className="cn-slash" role="listbox">
        {groups.map((key) => (
          <div key={key}>
            <div className="cn-slash-group">
              {groupLabel(key === "__default" ? undefined : key)}
            </div>
            {items.map((item, i) =>
              (item.group ?? "__default") !== key ? null : (
                <button
                  key={item.title}
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                  type="button"
                  role="option"
                  aria-selected={i === selectedIndex}
                  className={`cn-slash-item${i === selectedIndex ? " cn-slash-item-on" : ""}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => command(item)}
                >
                  <span className="cn-slash-icon" aria-hidden="true">
                    {itemGlyph(item)}
                  </span>
                  <span className="cn-slash-text">
                    <span className="cn-slash-title">{item.title}</span>
                    <span className="cn-slash-desc">{item.description}</span>
                  </span>
                </button>
              ),
            )}
          </div>
        ))}
      </div>
    )
  },
)
