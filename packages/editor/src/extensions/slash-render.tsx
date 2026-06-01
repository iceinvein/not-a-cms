import { ReactRenderer } from "@tiptap/react"
import { SlashCommandList, type SlashCommandListRef } from "./slash-command-list"

const MENU_WIDTH = 300
const MENU_MAX_HEIGHT = 320
const GAP = 6

export function renderSlashSuggestion() {
  let component: ReactRenderer<SlashCommandListRef> | null = null
  let popup: HTMLDivElement | null = null

  function place(props: any) {
    if (!popup) return
    const rect = props.clientRect?.()
    if (!rect) return

    // Anchor below the caret; flip above and clamp to the viewport so the menu
    // is always on-screen near the cursor (replaces the previous no-op stub).
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < MENU_MAX_HEIGHT && rect.top > spaceBelow
    const top = openUp ? rect.top - GAP : rect.bottom + GAP
    const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - GAP)

    popup.style.left = `${Math.max(GAP, left)}px`
    popup.style.top = `${top}px`
    popup.style.transform = openUp ? "translateY(-100%)" : "none"
  }

  return {
    onStart(props: any) {
      component = new ReactRenderer(SlashCommandList, {
        props,
        editor: props.editor,
      })

      popup = document.createElement("div")
      popup.setAttribute("data-slash-popup", "")
      popup.style.position = "fixed"
      popup.style.zIndex = "50"
      popup.style.width = `${MENU_WIDTH}px`
      document.body.appendChild(popup)

      if (component.element) {
        popup.appendChild(component.element)
      }

      place(props)
    },

    onUpdate(props: any) {
      component?.updateProps(props)
      place(props)
    },

    onKeyDown(props: any) {
      if (props.event.key === "Escape") {
        popup?.remove()
        popup = null
        return true
      }
      return component?.ref?.onKeyDown(props) ?? false
    },

    onExit() {
      popup?.remove()
      popup = null
      component?.destroy()
      component = null
    },
  }
}
