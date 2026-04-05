import { forwardRef, useImperativeHandle, useState, useEffect } from "react"
import type { SlashCommandItem } from "./slash-command"

export type SlashCommandListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

type Props = {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export const SlashCommandList = forwardRef<SlashCommandListRef, Props>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

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
          if (items[selectedIndex]) {
            command(items[selectedIndex])
          }
          return true
        }
        return false
      },
    }))

    if (!items.length) return null

    return (
      <div style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        padding: "4px",
        maxHeight: "320px",
        overflowY: "auto",
        width: "280px",
      }}>
        {items.map((item, i) => (
          <button
            key={item.title}
            onClick={() => command(item)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 12px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: i === selectedIndex ? "#f1f5f9" : "transparent",
            }}
          >
            <div style={{ fontWeight: 500, fontSize: "14px" }}>{item.title}</div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>{item.description}</div>
          </button>
        ))}
      </div>
    )
  }
)
