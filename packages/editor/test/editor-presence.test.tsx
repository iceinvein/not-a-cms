import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Editor } from "../src/editor"

describe("Editor presence props", () => {
  test("accepts presence='headless' and presence callbacks, SSR-safe", () => {
    let html = ""
    expect(() => {
      html = renderToString(
        <Editor
          content={[]}
          presence="headless"
          onPresenceChange={() => {}}
          onRemoteCursorsChange={() => {}}
        />,
      )
    }).not.toThrow()
    expect(typeof html).toBe("string")
  })

  test("defaults to inline presence and renders without throwing", () => {
    expect(() => renderToString(<Editor content={[]} />)).not.toThrow()
  })
})
