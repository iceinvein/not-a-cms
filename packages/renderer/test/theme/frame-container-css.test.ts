import { describe, expect, test } from "bun:test"
import { brandCss } from "../../src/theme/brand-css"
import { frameContainerCss } from "../../src/theme/frame-container-css"

const norm = (s: string) => s.replace(/\s+/g, " ").trim()

/** Extract the body of each `@media (max-width: Npx) { ... }` block (balanced braces). */
function widthMediaBodies(css: string): Array<{ width: string; body: string }> {
  const out: Array<{ width: string; body: string }> = []
  const re = /@media\s*\(max-width:\s*(\d+)px\)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    let depth = 1
    let i = re.lastIndex
    const start = i
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++
      else if (css[i] === "}") depth--
      i++
    }
    out.push({ width: m[1], body: css.slice(start, i - 1) })
  }
  return out
}

describe("frameContainerCss mirrors brandCss width breakpoints", () => {
  const media = widthMediaBodies(brandCss)

  test("there is at least one width breakpoint to mirror", () => {
    expect(media.length).toBeGreaterThan(0)
  })

  test("every width-based @media block has a matching @container block", () => {
    const container = norm(frameContainerCss)
    for (const { width, body } of media) {
      expect(container).toContain(norm(`@container (max-width: ${width}px) { ${body} }`))
    }
  })

  test("frameContainerCss uses @container, not @media", () => {
    expect(frameContainerCss).toContain("@container")
    expect(frameContainerCss).not.toContain("@media")
  })
})
