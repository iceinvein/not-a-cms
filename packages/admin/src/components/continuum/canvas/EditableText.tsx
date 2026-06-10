import { Component, createRef, type JSX, type KeyboardEvent, type ClipboardEvent, type ReactElement } from "react"

type Props = {
  /** The element tag to render, matching the production markup (e.g. "h1", "p", "span"). */
  as: string
  className?: string
  value: string
  placeholder?: string
  /** Called with the new plain-text value on every input. */
  onChange: (value: string) => void
  /** Editable on the canvas (default). When false, renders static markup for parity/empty holes. */
  editable?: boolean
  /** Allow newlines. Single-line holes (default) ignore Enter so headings stay one line. */
  multiline?: boolean
  /** Called when the hole gains focus, so the node-view can mark its block selected. */
  onFocusHole?: () => void
}

/**
 * Caret-stable inline text editor for the Visual canvas. Visible section text (headlines,
 * labels, item titles) is rendered through this so authors type on the rendered page.
 *
 * It is a class component on purpose: `shouldComponentUpdate` skips re-render while the
 * incoming value already matches the DOM (i.e. the user is typing locally), which is the
 * only reliable way to keep a React-controlled contentEditable from resetting the caret.
 * External changes (collaboration, undo, inspector edits) DO differ from the DOM, so they
 * re-render and `componentDidUpdate` syncs the text.
 */
export class EditableText extends Component<Props> {
  private ref = createRef<HTMLElement>()

  shouldComponentUpdate(next: Props): boolean {
    const el = this.ref.current
    if (!el) return true
    return (
      next.value !== el.textContent ||
      next.editable !== this.props.editable ||
      next.className !== this.props.className ||
      next.placeholder !== this.props.placeholder ||
      next.as !== this.props.as
    )
  }

  componentDidUpdate(): void {
    const el = this.ref.current
    if (el && this.props.value !== el.textContent) el.textContent = this.props.value
  }

  private handleInput = (): void => {
    const el = this.ref.current
    if (el) this.props.onChange(el.textContent ?? "")
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    // Keep ProseMirror from intercepting keystrokes meant for this DOM-only hole.
    event.stopPropagation()
    if (!this.props.multiline && event.key === "Enter") event.preventDefault()
  }

  private handlePaste = (event: ClipboardEvent): void => {
    // Force plain text: section holes are single strings, never rich HTML.
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
  }

  render(): ReactElement | null {
    const { as, className, value, placeholder, editable = true, onFocusHole } = this.props
    const Tag = as as keyof JSX.IntrinsicElements

    if (!editable) {
      if (!value) return null
      // biome-ignore lint/suspicious/noExplicitAny: dynamic tag name is validated by the caller against the production markup
      return <Tag className={className}>{value}</Tag> as any
    }

    // biome-ignore lint/suspicious/noExplicitAny: dynamic tag narrowed to "div" so JSX resolves a concrete element type; runtime value is whatever the caller passed
    const T = Tag as "div"
    return (
      <T
        ref={this.ref as any}
        className={className}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={this.handleInput}
        onKeyDown={this.handleKeyDown}
        onPaste={this.handlePaste}
        onFocus={onFocusHole}
      >
        {value}
      </T>
    )
  }
}
