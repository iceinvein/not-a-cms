import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { PulseSpine } from "../../../src/components/pulse/PulseSpine"

describe("PulseSpine (island)", () => {
  test("server-renders its initial empty state without touching EventSource", () => {
    // useEffect (where EventSource lives) does not run during renderToString,
    // so this verifies the island mounts to a calm idle spine on the server.
    const html = renderToString(<PulseSpine apiBase="http://localhost:4321" />)
    expect(html).toContain("idle")
    expect(html).toContain("All quiet")
  })
})
