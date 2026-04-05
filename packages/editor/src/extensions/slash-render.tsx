import { ReactRenderer } from "@tiptap/react"
import { SlashCommandList, type SlashCommandListRef } from "./slash-command-list"

export function renderSlashSuggestion() {
  let component: ReactRenderer<SlashCommandListRef> | null = null
  let popup: HTMLDivElement | null = null

  return {
    onStart(props: any) {
      component = new ReactRenderer(SlashCommandList, {
        props,
        editor: props.editor,
      })

      popup = document.createElement("div")
      popup.style.position = "absolute"
      popup.style.zIndex = "50"
      document.body.appendChild(popup)

      if (component.element) {
        popup.appendChild(component.element)
      }

      updatePosition(props)
    },

    onUpdate(props: any) {
      component?.updateProps(props)
      updatePosition(props)
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

function updatePosition(props: any) {
  const rect = props.clientRect?.()
  const popup = document.querySelector("[data-slash-popup]") as HTMLElement
  // Position handled by the popup div's absolute positioning
  // In production, use @floating-ui/dom for better positioning
}
