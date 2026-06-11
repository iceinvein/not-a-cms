import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { CanvasChrome } from "../../src/components/continuum/canvas/CanvasChrome"

describe("CanvasChrome", () => {
  test("renders the header before children and the footer after", () => {
    const html = renderToString(
      <CanvasChrome
        header="<header class='nac-header'>H</header>"
        footer="<footer class='nac-footer'>F</footer>"
      >
        <article id="body">BODY</article>
      </CanvasChrome>,
    )
    expect(html).toContain("cn-chrome-header")
    expect(html).toContain("cn-chrome-footer")
    expect(html).toContain('id="body"')
    expect(html.indexOf("cn-chrome-header")).toBeLessThan(html.indexOf('id="body"'))
    expect(html.indexOf('id="body"')).toBeLessThan(html.indexOf("cn-chrome-footer"))
  })

  test("injects the provided header/footer markup", () => {
    const html = renderToString(
      <CanvasChrome
        header="<header class='nac-header'>HELLO</header>"
        footer="<footer>BYE</footer>"
      >
        <div />
      </CanvasChrome>,
    )
    expect(html).toContain("HELLO")
    expect(html).toContain("BYE")
  })
})
