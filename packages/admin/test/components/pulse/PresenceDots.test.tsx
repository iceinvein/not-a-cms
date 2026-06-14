import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { PresenceDots } from "../../../src/components/pulse/PresenceDots"

const people = [
  { id: "1", name: "Maya", color: "#6ea8fe" },
  { id: "2", name: "James", color: "#f472b6" },
  { id: "3", name: "Ada", color: "#a78bfa" },
  { id: "4", name: "Ben", color: "#fb923c" },
  { id: "5", name: "Cy", color: "#2dd4bf" },
  { id: "6", name: "Dee", color: "#6ea8fe" },
]

describe("PresenceDots", () => {
  test("shows initials up to max and an overflow count", () => {
    const html = renderToString(<PresenceDots people={people} max={4} />)
    expect(html).toContain(">M<")
    expect(html).toContain(">J<")
    expect(html).toContain(">+<!-- -->2<")
    expect(html).toContain('aria-label="6 people here"')
  })

  test("singular label for one person, no overflow", () => {
    const html = renderToString(<PresenceDots people={[people[0]]} />)
    expect(html).toContain('aria-label="1 person here"')
    expect(html).not.toContain("+")
  })
})
