import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react"

type Props = {
  header: string
  footer: string
  children: ReactNode
}

/** Take focusable chrome anchors out of the tab order (canvas-only; the shared renderer
 * must keep the public site's links focusable, so this is applied here after injection). */
function makeInert(root: HTMLElement | null) {
  if (!root) return
  for (const a of root.querySelectorAll("a")) a.setAttribute("tabindex", "-1")
}

/**
 * Wraps the editable body with the real site header/footer (read-only) for the Visual
 * canvas. The chrome markup comes from the renderer's renderSiteChrome and is injected
 * via dangerouslySetInnerHTML (renderer-produced, hrefs already sanitized). Chrome is
 * display-only: anchor clicks are swallowed and chrome links are removed from the tab
 * order, while the hamburger toggles the mobile nav so the responsive preview is
 * demonstrable. The body is the only interactive region.
 */
export function CanvasChrome({ header, footer, children }: Props) {
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)

  // Re-run whenever the injected markup changes (chrome arrives after the /api/_site fetch).
  // header/footer are props (reactive), not outer-scope refs, so they are valid triggers here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: header/footer are props that drive re-injection; refs are stable
  useEffect(() => {
    makeInert(headerRef.current)
    makeInert(footerRef.current)
  }, [header, footer])

  const onChromeClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const toggle = target.closest(".nac-nav-toggle")
    if (toggle) {
      const headerEl = toggle.closest(".nac-header")
      if (headerEl) {
        const open = headerEl.hasAttribute("data-open")
        if (open) headerEl.removeAttribute("data-open")
        else headerEl.setAttribute("data-open", "")
        toggle.setAttribute("aria-expanded", open ? "false" : "true")
      }
      e.preventDefault()
      return
    }
    if (target.closest("a")) {
      // Read-only preview: links never navigate away from the editor.
      e.preventDefault()
    }
  }, [])

  const onChromeKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return
    const headerEl = e.currentTarget.querySelector(".nac-header[data-open]")
    if (headerEl) {
      headerEl.removeAttribute("data-open")
      headerEl.querySelector(".nac-nav-toggle")?.setAttribute("aria-expanded", "false")
    }
  }, [])

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: chrome is inert; handlers only neutralize/toggle */}
      <div
        ref={headerRef}
        className="cn-chrome cn-chrome-header"
        onClick={onChromeClick}
        onKeyDown={onChromeKeyDown}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: renderer-produced, sanitized markup
        dangerouslySetInnerHTML={{ __html: header }}
      />
      {children}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: chrome is inert; click handler only swallows link navigation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: footer chrome has no keyboard-navigable interactions */}
      <div
        ref={footerRef}
        className="cn-chrome cn-chrome-footer"
        onClick={onChromeClick}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: renderer-produced, sanitized markup
        dangerouslySetInnerHTML={{ __html: footer }}
      />
    </>
  )
}
