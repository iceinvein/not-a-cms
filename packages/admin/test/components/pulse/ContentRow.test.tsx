import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { ContentRow } from "../../../src/components/ContentRow"

const NOW = Date.parse("2026-06-16T12:00:00.000Z")

function render(node: React.ReactNode) {
  // wrap so the <tr> sits in valid table markup
  return renderToString(
    <table>
      <tbody>{node}</tbody>
    </table>,
  )
}

const noop = () => {}

describe("ContentRow", () => {
  test("a recently-edited published row shows freshness, a published signal, and a sparkline", () => {
    const html = render(
      <ContentRow
        collection="page"
        item={{
          id: "home",
          title: "Home",
          status: "published",
          updated_at: "2026-06-16T11:30:00.000Z",
        }}
        presence={[]}
        views={{ total: 200, today: 18, series: [1, 2, 3, 4, 5, 6, 7] }}
        now={NOW}
        selected={false}
        onToggleSelect={noop}
        onDelete={noop}
      />,
    )
    expect(html).toContain("Home")
    expect(html).toContain("pulse-fresh") // edited 30m ago -> fresh
    expect(html).toContain("pulse-signal-published")
    expect(html).toContain("+18 today") // momentum delta
    expect(html).toContain("<polyline") // sparkline
  })

  test("a scheduled row shows a live countdown; a dormant row dims", () => {
    const scheduled = render(
      <ContentRow
        collection="page"
        item={{
          id: "s",
          title: "Launch",
          status: "scheduled",
          updated_at: "2026-06-16T11:00:00.000Z",
          publishedAt: "2026-06-16T14:14:09.000Z",
        }}
        presence={[]}
        views={null}
        now={NOW}
        selected={false}
        onToggleSelect={noop}
        onDelete={noop}
      />,
    )
    expect(scheduled).toContain("live in 02:14:09")

    const dormant = render(
      <ContentRow
        collection="page"
        item={{
          id: "old",
          title: "Old",
          status: "published",
          updated_at: "2026-04-01T00:00:00.000Z",
        }}
        presence={[]}
        views={null}
        now={NOW}
        selected={false}
        onToggleSelect={noop}
        onDelete={noop}
      />,
    )
    expect(dormant).toContain("pulse-dormant")
  })

  test("renders presence avatars when someone is editing the row", () => {
    const html = render(
      <ContentRow
        collection="page"
        item={{
          id: "home",
          title: "Home",
          status: "draft",
          updated_at: "2026-06-16T11:59:00.000Z",
        }}
        presence={[{ id: "Maya", name: "Maya", color: "#6ea8fe" }]}
        views={null}
        now={NOW}
        selected={false}
        onToggleSelect={noop}
        onDelete={noop}
      />,
    )
    expect(html).toContain("pulse-presence")
    expect(html).toContain(">M<")
  })
})
