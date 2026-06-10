import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Editor } from "../src/editor"

describe("Editor onReady", () => {
  test("accepts an onReady prop and renders without throwing", () => {
    // Under renderToString the editor is not created (immediatelyRender:false), so onReady
    // does not fire server-side; this asserts the prop is wired and SSR-safe. Live firing is
    // covered by the canvas E2E.
    let html = ""
    expect(() => {
      html = renderToString(<Editor content={[]} onReady={() => {}} />)
    }).not.toThrow()
    expect(typeof html).toBe("string")
  })
})
